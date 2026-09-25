-- Dijital Karpin - Bir araca atanmis butun soforlerin, o aracin (kimin actigina
-- bakmaksizin) vardiyalarini gorebilmesi icin. Bu olmadan "arac su an baska
-- soforde acik" kontrolu calismaz, cunku RLS baskasinin satirini gizler.

drop policy if exists "Assigned drivers can view vehicle shifts" on public.shifts;
create policy "Assigned drivers can view vehicle shifts"
  on public.shifts for select
  to authenticated
  using ( public.is_assigned_driver(shifts.vehicle_id) );
