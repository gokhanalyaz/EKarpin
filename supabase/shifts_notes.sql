-- Dijital Karpin - Vardiya kapatirken "diger masraf" icin aciklama notu
-- ve genel not (araç sahibine iletilecek bilgi) icin ek kolon.

alter table public.shifts add column if not exists other_expenses_note text;
