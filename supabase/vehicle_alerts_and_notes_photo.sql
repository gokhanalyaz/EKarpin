-- Dijital Karpin - Sofor notuna fotograf ekleme + arac sahibine anlik
-- bildirim (uyari) ozelligi. Bu, normal karpin kapatma akisindan
-- bagimsiz, ekstra bir "araç sahibine bildir" kaydi.

alter table public.shifts add column if not exists notes_photo_url text;

create table if not exists public.vehicle_alerts (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  driver_id uuid not null references public.profiles(id) on delete cascade,
  shift_id uuid references public.shifts(id) on delete set null,
  note text not null,
  photo_url text,
  created_at timestamptz not null default now()
);

alter table public.vehicle_alerts enable row level security;

drop policy if exists "Owners view alerts of own vehicles" on public.vehicle_alerts;
create policy "Owners view alerts of own vehicles"
  on public.vehicle_alerts for select
  to authenticated
  using ( public.is_vehicle_owner(vehicle_alerts.vehicle_id) );

drop policy if exists "Drivers manage own alerts" on public.vehicle_alerts;
create policy "Drivers manage own alerts"
  on public.vehicle_alerts for all
  to authenticated
  using ( driver_id = auth.uid() )
  with check (
    driver_id = auth.uid()
    and public.is_assigned_driver(vehicle_alerts.vehicle_id)
  );
