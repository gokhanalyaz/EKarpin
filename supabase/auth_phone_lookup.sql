-- Dijital Karpin - Telefon numarasiyla giris yapabilmek icin
-- telefona kayitli e-posta adresini bulan fonksiyon.
-- Login ekraninda kullanici henuz giris yapmadigi icin bu fonksiyon
-- anon (giris yapmamis) kullanicilar tarafindan da cagrilabilmeli.

create or replace function public.get_email_by_phone(p_phone text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  select u.email into v_email
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.phone = p_phone
  limit 1;

  return v_email;
end;
$$;

grant execute on function public.get_email_by_phone(text) to anon, authenticated;
