-- Dijital Karpin - secilebilir gider kategorileri

-- Arac sahibi, bu aracta hangi gider kategorilerinin soforun karsisina
-- cikacagini belirleyebilsin diye aractaki acik kategoriler listesi.
alter table public.vehicles
  add column if not exists enabled_expense_categories text[]
  not null default array['oto_yikama','durak_aidati','hgs_otoyol','tamir_bakim','diger'];

-- O vardiyada girilen gider kalemlerinin dokumu (kategori + tutar + varsa not).
alter table public.shifts add column if not exists expense_items jsonb;
