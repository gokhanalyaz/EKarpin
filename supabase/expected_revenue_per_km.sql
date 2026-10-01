-- Dijital Karpin - Km ile hasilat karsilastirmasi icin beklenen km basi hasilat

-- Arac sahibi, yuzdelik (ondalik) sistemli araclar icin "bu arac km basina
-- normal sartlarda ortalama ne kadar hasilat yapar" degerini girer. Vardiya
-- kapaninca, kat edilen km'ye gore beklenen hasilat ile gercek hasilat
-- karsilastirilip kar/zarar durumu gosterilir.
alter table public.vehicles add column if not exists expected_revenue_per_km numeric;
