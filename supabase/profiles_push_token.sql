-- Dijital Karpin - Push bildirimi gonderebilmek icin her kullanicinin
-- cihaz push token'ini saklayacagimiz kolon.
alter table public.profiles add column if not exists push_token text;
