-- Dijital Karpin - Km dusum yetkisi + teslim/tahsilat takibi

-- 1) Km dusum yetkisi: arac sahibi bir soforu, o aracta gunluk en fazla
--    kac km dusum yapabilecegini belirleyerek yetkilendirebilir. NULL/0 =
--    yetki yok, sofor bu ozelligi hic gormez.
alter table public.vehicle_drivers add column if not exists daily_km_discount_limit numeric;

-- 2) O vardiyada gercekten kullanilan km dusumu ve zorunlu aciklamasi.
alter table public.shifts add column if not exists km_discount numeric;
alter table public.shifts add column if not exists km_discount_note text;

-- 3) Teslim / tahsilat takibi: sofor "teslim ettim" diyebilir, arac sahibi
--    bagimsiz olarak "teslim aldim" diyebilir. Geçerli/son durum arac
--    sahibinin onayidir.
alter table public.shifts add column if not exists driver_marked_delivered_at timestamptz;
alter table public.shifts add column if not exists owner_confirmed_received_at timestamptz;

-- Arac sahibi, kendi aracina ait kapanmis vardiyalarda "teslim aldim"
-- isaretleyebilsin diye guncelleme (update) yetkisi. (Simdiye kadar arac
-- sahibinin shifts uzerinde sadece SELECT yetkisi vardi.)
drop policy if exists "Owners can update shifts of own vehicles" on public.shifts;
create policy "Owners can update shifts of own vehicles"
  on public.shifts for update
  to authenticated
  using (
    exists (select 1 from public.vehicles v where v.id = shifts.vehicle_id and v.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.vehicles v where v.id = shifts.vehicle_id and v.owner_id = auth.uid())
  );
