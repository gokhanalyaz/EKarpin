-- Dijital Karpin
-- 1) Uygulama komisyonu: arac sahibi, her sofor icin komisyon girip
--    giremeyecegini belirleyebilsin (varsayilan: girebilir).
alter table public.vehicle_drivers add column if not exists can_enter_commission boolean not null default true;

-- 2) Hesabimi Sil (Apple sarti). Kullanici sadece KENDI hesabini silebilir.
--    - Arac sahibi: araclari ve araclara bagli tum kayitlar (karpinler,
--      bakimlar, bildirimler, sofor atamalari) silinir, hesap tamamen silinir.
--    - Sofor: arac sahiplerinin kayitlari kaybolmasin diye karpinleri
--      silinmez; sofor araclardan cikarilir, adi "Silinmiş Şoför" yapilir,
--      telefon/bildirim bilgileri silinir ve hesaba bir daha girilemez.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Oturum bulunamadı';
  end if;

  -- Arac sahibiyse araclarini (ve onlara bagli her seyi) sil
  delete from public.vehicles where owner_id = uid;

  -- Sofor tarafi: atamalar, ozel notlar, gonderdigi bildirimler
  delete from public.vehicle_drivers where driver_id = uid;
  delete from public.vehicle_alerts where driver_id = uid;
  delete from public.driver_private_notes where driver_id = uid;

  begin
    -- Baska kayitlar bu profile bagli degilse hesabi tamamen sil
    delete from auth.users where id = uid;
  exception when foreign_key_violation then
    -- Karpin kayitlari bu profile bagli (sofor): kisisel bilgileri sil,
    -- girisi kalici olarak kapat.
    update public.profiles
      set full_name = 'Silinmiş Şoför', phone = null, push_token = null
      where id = uid;
    update auth.users
      set email = 'silindi+' || uid::text || '@deleted.invalid',
          phone = null,
          encrypted_password = '',
          raw_user_meta_data = '{}'::jsonb,
          banned_until = 'infinity'
      where id = uid;
    delete from auth.sessions where user_id = uid;
  end;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
