-- Dijital Karpin
-- 1) Bildirim silme duzeltmesi: arac sahibinin vehicle_alerts tablosunda
--    sadece "goruntuleme" (select) izni vardi, "silme" (delete) izni yoktu.
--    Bu yuzden silme islemi hata vermeden 0 satir siliyor, sayfa
--    yenilenince bildirim geri geliyordu.
drop policy if exists "Owners delete alerts of own vehicles" on public.vehicle_alerts;
create policy "Owners delete alerts of own vehicles"
  on public.vehicle_alerts for delete
  to authenticated
  using ( public.is_vehicle_owner(vehicle_alerts.vehicle_id) );

-- 2) Arac eklerken zorunlu ruhsat fotografi
alter table public.vehicles add column if not exists registration_photo_path text;

insert into storage.buckets (id, name, public)
values ('vehicle-documents', 'vehicle-documents', false)
on conflict (id) do nothing;

-- Dosya yolu: <vehicle_id>/ruhsat-<zaman>.jpg  -> klasor adi = arac id
drop policy if exists "Owners view own vehicle documents" on storage.objects;
create policy "Owners view own vehicle documents"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'vehicle-documents'
    and public.is_vehicle_owner( (storage.foldername(name))[1]::uuid )
  );

drop policy if exists "Owners upload own vehicle documents" on storage.objects;
create policy "Owners upload own vehicle documents"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'vehicle-documents'
    and public.is_vehicle_owner( (storage.foldername(name))[1]::uuid )
  );

drop policy if exists "Owners update own vehicle documents" on storage.objects;
create policy "Owners update own vehicle documents"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'vehicle-documents'
    and public.is_vehicle_owner( (storage.foldername(name))[1]::uuid )
  );
