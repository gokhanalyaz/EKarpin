-- Dijital Karpin - Telefon numaralarini "90XXXXXXXXXX" kalibina normallestirir.
-- Eski surumde farkli formatlarda (basinda 0, +90 veya duz) kaydedilmis
-- numaralari tek bir kaliba cevirir ki eslesme (soför arama) her zaman calissin.

update public.profiles
set phone = case
  when phone ~ '^90\d{10}$' then phone
  when phone ~ '^0\d{10}$' then '90' || substring(phone from 2)
  when phone ~ '^\d{10}$' then '90' || phone
  else phone
end
where phone is not null and phone <> '';
