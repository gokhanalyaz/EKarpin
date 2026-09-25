-- Dijital Karpin - Ayni telefon numarasiyla birden fazla hesap acilmasini engeller.
-- (NULL telefonlu eski kayitlar bu kisitlamadan etkilenmez, Postgres NULL'lari
-- birbirine esit saymaz.)
alter table public.profiles
  add constraint profiles_phone_unique unique (phone);
