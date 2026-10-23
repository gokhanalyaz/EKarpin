-- Dijital Karpin - Arac silme: "karpin gecmisi kalsin" secenegi icin arac
-- tamamen silinmek yerine arsivlenir (listelerden kalkar, gecmis karpinleri
-- Gecmis sekmesinde gorunmeye devam eder).
alter table public.vehicles add column if not exists archived_at timestamptz;
