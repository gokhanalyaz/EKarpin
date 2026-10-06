-- Dijital Karpin - Arac bakim/lastik degisimi takibi + km bazli hatirlatma

create table if not exists public.vehicle_maintenance_logs (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete set null,
  type text not null,
  km_at_service numeric not null,
  interval_km numeric,
  reminder_buffer_km numeric not null default 1000,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists vehicle_maintenance_logs_vehicle_id_idx
  on public.vehicle_maintenance_logs (vehicle_id, created_at desc);

alter table public.vehicle_maintenance_logs enable row level security;

drop policy if exists "Owners manage maintenance logs of own vehicles" on public.vehicle_maintenance_logs;
create policy "Owners manage maintenance logs of own vehicles"
  on public.vehicle_maintenance_logs for all
  to authenticated
  using ( public.is_vehicle_owner(vehicle_maintenance_logs.vehicle_id) )
  with check ( public.is_vehicle_owner(vehicle_maintenance_logs.vehicle_id) );
