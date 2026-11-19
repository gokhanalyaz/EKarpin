-- Dijital Karpin - Trafik cezasi kaydi
-- Arac sahibi, cezadaki tarih/saate gore o an calisan soforun karpinini
-- bulur; cezayi (tutar, fotograf, not) kaydeder ve sofore bildirir.
-- Sofor sadece kendisine atanan cezalari gorur.

create table if not exists public.traffic_fines (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  shift_id uuid references public.shifts(id) on delete set null,
  driver_id uuid references public.profiles(id) on delete set null,
  fine_at timestamptz not null,
  amount numeric(12,2),
  note text,
  photo_url text,
  paid_at timestamptz,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists traffic_fines_vehicle_idx on public.traffic_fines (vehicle_id, fine_at desc);
create index if not exists traffic_fines_driver_idx on public.traffic_fines (driver_id, fine_at desc);

alter table public.traffic_fines enable row level security;

drop policy if exists "Owners manage fines of own vehicles" on public.traffic_fines;
create policy "Owners manage fines of own vehicles"
  on public.traffic_fines for all
  to authenticated
  using ( public.is_vehicle_owner(traffic_fines.vehicle_id) )
  with check ( public.is_vehicle_owner(traffic_fines.vehicle_id) );

drop policy if exists "Drivers view own fines" on public.traffic_fines;
create policy "Drivers view own fines"
  on public.traffic_fines for select
  to authenticated
  using ( driver_id = auth.uid() );

-- Ceza fotograflari: traffic-fines/<arac_id>/<ceza_id>.jpg
insert into storage.buckets (id, name, public)
values ('traffic-fines', 'traffic-fines', false)
on conflict (id) do nothing;

create or replace function public.can_view_fine_photo(object_name text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.traffic_fines f
    where f.photo_url = object_name
      and (f.driver_id = auth.uid() or public.is_vehicle_owner(f.vehicle_id))
  );
$$;

drop policy if exists "Fine photos viewable by owner and driver" on storage.objects;
create policy "Fine photos viewable by owner and driver"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'traffic-fines'
    and (
      public.is_vehicle_owner( (storage.foldername(name))[1]::uuid )
      or public.can_view_fine_photo(name)
    )
  );

drop policy if exists "Owners upload fine photos" on storage.objects;
create policy "Owners upload fine photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'traffic-fines'
    and public.is_vehicle_owner( (storage.foldername(name))[1]::uuid )
  );

drop policy if exists "Owners update fine photos" on storage.objects;
create policy "Owners update fine photos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'traffic-fines'
    and public.is_vehicle_owner( (storage.foldername(name))[1]::uuid )
  );

drop policy if exists "Owners delete fine photos" on storage.objects;
create policy "Owners delete fine photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'traffic-fines'
    and public.is_vehicle_owner( (storage.foldername(name))[1]::uuid )
  );

-- Ceza kaydinda plaka da saklanir: sofor sonradan aractan ayrilsa da
-- (artik araci goremese de) kendi cezasinda plakayi gorebilsin.
alter table public.traffic_fines add column if not exists plate_no text;
update public.traffic_fines f set plate_no = v.plate_no
  from public.vehicles v where v.id = f.vehicle_id and f.plate_no is null;
