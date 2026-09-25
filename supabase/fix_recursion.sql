-- Dijital Karpin - RLS sonsuz dongu (infinite recursion) duzeltmesi
create or replace function public.is_vehicle_owner(target_vehicle_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.vehicles v
    where v.id = target_vehicle_id and v.owner_id = auth.uid()
  );
$$;

create or replace function public.is_assigned_driver(target_vehicle_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.vehicle_drivers vd
    where vd.vehicle_id = target_vehicle_id and vd.driver_id = auth.uid()
  );
$$;

drop policy if exists "Assigned drivers can view vehicle" on public.vehicles;
create policy "Assigned drivers can view vehicle"
  on public.vehicles for select
  to authenticated
  using ( public.is_assigned_driver(vehicles.id) );

drop policy if exists "Owners manage driver assignments" on public.vehicle_drivers;
create policy "Owners manage driver assignments"
  on public.vehicle_drivers for all
  to authenticated
  using ( public.is_vehicle_owner(vehicle_drivers.vehicle_id) )
  with check ( public.is_vehicle_owner(vehicle_drivers.vehicle_id) );

drop policy if exists "Owners view shifts of own vehicles" on public.shifts;
create policy "Owners view shifts of own vehicles"
  on public.shifts for select
  to authenticated
  using ( public.is_vehicle_owner(shifts.vehicle_id) );

drop policy if exists "Drivers manage own shifts" on public.shifts;
create policy "Drivers manage own shifts"
  on public.shifts for all
  to authenticated
  using ( driver_id = auth.uid() )
  with check (
    driver_id = auth.uid()
    and public.is_assigned_driver(shifts.vehicle_id)
  );
