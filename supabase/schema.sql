-- Dijital Karpin - Veritabani Semasi (v1, duzeltilmis)

-- =========================================
-- 1) TUM TABLOLAR (once hepsi olusturulur)
-- =========================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','driver')),
  full_name text,
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  plate_no text not null,
  payment_model text not null default 'percentage' check (payment_model in ('percentage','km_based')),
  percentage_rate numeric default 25,
  km_rate numeric,
  created_at timestamptz not null default now()
);

create table if not exists public.vehicle_drivers (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  driver_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (vehicle_id, driver_id)
);

create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  driver_id uuid not null references public.profiles(id),
  payment_model text not null,
  status text not null default 'open' check (status in ('open','closed')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,

  opening_km numeric,
  opening_km_photo_url text,
  opening_km_confirmed boolean default false,

  closing_km numeric,
  closing_km_photo_url text,

  total_amount numeric,
  fuel_cost numeric default 0,
  other_expenses numeric default 0,
  driver_share numeric default 0,
  card_amount numeric default 0,

  net_cash numeric,
  owner_total numeric,

  km_total numeric,
  km_debt numeric,

  handed_to_driver_id uuid references public.profiles(id),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.driver_private_notes (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid references public.shifts(id) on delete cascade,
  driver_id uuid not null references public.profiles(id) on delete cascade,
  earning_amount numeric,
  note text,
  created_at timestamptz not null default now()
);

-- =========================================
-- 2) ROW LEVEL SECURITY ACIK
-- =========================================
alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.vehicle_drivers enable row level security;
alter table public.shifts enable row level security;
alter table public.driver_private_notes enable row level security;

-- =========================================
-- 3) POLICIES
-- =========================================
drop policy if exists "Profiles are viewable by authenticated users" on public.profiles;
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

drop policy if exists "Owners manage own vehicles" on public.vehicles;
create policy "Owners manage own vehicles"
  on public.vehicles for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "Assigned drivers can view vehicle" on public.vehicles;
create policy "Assigned drivers can view vehicle"
  on public.vehicles for select
  to authenticated
  using (
    exists (
      select 1 from public.vehicle_drivers vd
      where vd.vehicle_id = vehicles.id and vd.driver_id = auth.uid()
    )
  );

drop policy if exists "Owners manage driver assignments" on public.vehicle_drivers;
create policy "Owners manage driver assignments"
  on public.vehicle_drivers for all
  to authenticated
  using (
    exists (select 1 from public.vehicles v where v.id = vehicle_drivers.vehicle_id and v.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.vehicles v where v.id = vehicle_drivers.vehicle_id and v.owner_id = auth.uid())
  );

drop policy if exists "Drivers view own assignments" on public.vehicle_drivers;
create policy "Drivers view own assignments"
  on public.vehicle_drivers for select
  to authenticated
  using (driver_id = auth.uid());

drop policy if exists "Owners view shifts of own vehicles" on public.shifts;
create policy "Owners view shifts of own vehicles"
  on public.shifts for select
  to authenticated
  using (
    exists (select 1 from public.vehicles v where v.id = shifts.vehicle_id and v.owner_id = auth.uid())
  );

drop policy if exists "Drivers manage own shifts" on public.shifts;
create policy "Drivers manage own shifts"
  on public.shifts for all
  to authenticated
  using (driver_id = auth.uid())
  with check (
    driver_id = auth.uid()
    and exists (
      select 1 from public.vehicle_drivers vd
      where vd.vehicle_id = shifts.vehicle_id and vd.driver_id = auth.uid()
    )
  );

drop policy if exists "Drivers manage own private notes" on public.driver_private_notes;
create policy "Drivers manage own private notes"
  on public.driver_private_notes for all
  to authenticated
  using (driver_id = auth.uid())
  with check (driver_id = auth.uid());

-- =========================================
-- 4) KAYIT OLUNCA OTOMATIK PROFIL OLUSTURMA
-- =========================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'driver'),
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
