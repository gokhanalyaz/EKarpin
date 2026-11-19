-- "Karpin Sil" artik veriyi silmez: karpin sadece soforun ekranindan
-- kalkar, arac sahibinde ve trafik cezasi sorgusunda kalir.
alter table public.shifts add column if not exists hidden_from_driver_at timestamptz;
