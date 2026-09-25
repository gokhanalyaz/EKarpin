-- Dijital Karpin - Vardiya fotograflari icin depolama alani (storage)
-- Acilis/kapanis km fotograflari icin 'shift-photos' bucket'i ve erisim kurallari.

insert into storage.buckets (id, name, public)
values ('shift-photos', 'shift-photos', false)
on conflict (id) do nothing;

create or replace function public.can_access_shift(target_shift_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.shifts s
    where s.id = target_shift_id
      and (s.driver_id = auth.uid() or public.is_vehicle_owner(s.vehicle_id))
  );
$$;

drop policy if exists "Shift participants can view photos" on storage.objects;
create policy "Shift participants can view photos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'shift-photos'
    and public.can_access_shift( (storage.foldername(name))[1]::uuid )
  );

drop policy if exists "Drivers can upload shift photos" on storage.objects;
create policy "Drivers can upload shift photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'shift-photos'
    and exists (
      select 1 from public.shifts s
      where s.id = (storage.foldername(name))[1]::uuid
        and s.driver_id = auth.uid()
    )
  );

drop policy if exists "Drivers can update own shift photos" on storage.objects;
create policy "Drivers can update own shift photos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'shift-photos'
    and exists (
      select 1 from public.shifts s
      where s.id = (storage.foldername(name))[1]::uuid
        and s.driver_id = auth.uid()
    )
  );
