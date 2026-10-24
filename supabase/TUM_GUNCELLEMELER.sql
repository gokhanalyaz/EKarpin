-- ============================================================
-- Dijital Karpin - TUM veritabani guncellemeleri (tek seferde)
-- Bu dosya daha once calistirilmis olsa bile tekrar calistirilabilir;
-- hicbir veriyi silmez, eksik olanlari ekler.
-- Supabase > SQL Editor'e tamamini yapistirip Run'a basin.
-- ============================================================


-- ---------- alerts_delete_and_vehicle_registration.sql ----------
-- Dijital Karpin
-- 1) Bildirim silme duzeltmesi: arac sahibinin vehicle_alerts tablosunda
--    sadece "goruntuleme" (select) izni vardi, "silme" (delete) izni yoktu.
--    Bu yuzden silme islemi hata vermeden 0 satir siliyor, sayfa
--    yenilenince bildirim geri geliyordu.
drop policy if exists "Owners delete alerts of own vehicles" on public.vehicle_alerts;
create policy "Owners delete alerts of own vehicles"
  on public.vehicle_alerts for delete
  to authenticated
  using ( public.is_vehicle_owner(vehicle_alerts.vehicle_id) );

-- 2) Arac eklerken zorunlu ruhsat fotografi
alter table public.vehicles add column if not exists registration_photo_path text;

insert into storage.buckets (id, name, public)
values ('vehicle-documents', 'vehicle-documents', false)
on conflict (id) do nothing;

-- Dosya yolu: <vehicle_id>/ruhsat-<zaman>.jpg  -> klasor adi = arac id
drop policy if exists "Owners view own vehicle documents" on storage.objects;
create policy "Owners view own vehicle documents"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'vehicle-documents'
    and public.is_vehicle_owner( (storage.foldername(name))[1]::uuid )
  );

drop policy if exists "Owners upload own vehicle documents" on storage.objects;
create policy "Owners upload own vehicle documents"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'vehicle-documents'
    and public.is_vehicle_owner( (storage.foldername(name))[1]::uuid )
  );

drop policy if exists "Owners update own vehicle documents" on storage.objects;
create policy "Owners update own vehicle documents"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'vehicle-documents'
    and public.is_vehicle_owner( (storage.foldername(name))[1]::uuid )
  );

-- ---------- vize_and_daily_reminders.sql ----------
-- Dijital Karpin - Vize tarihi + her sabah 09:00'da bakim/vize hatirlatma bildirimi
--
-- 1) Araca vize tarihi, kac gun once hatirlatilacagi ve bakim bildirimlerinin
--    soforlere de gidip gitmeyecegi bilgisi eklenir.
-- 2) send_maintenance_reminders(): zamani gelen/gecen bakimlari ve
--    yaklasan/gecen vizeleri bulur, arac sahibine (ve istenirse o an araca
--    ekli soforlere) Expo push bildirimi gonderir. Bakim yapildi olarak yeni
--    kayit girilene / vize tarihi guncellenene kadar her gun tekrarlanir.
-- 3) pg_cron ile her gun 06:00 UTC (= 09:00 Turkiye) calistirilir.

alter table public.vehicles add column if not exists inspection_due_date date;
alter table public.vehicles add column if not exists inspection_notice_days integer not null default 10;
alter table public.vehicles add column if not exists maintenance_notify_drivers boolean not null default false;

create extension if not exists pg_net;
create extension if not exists pg_cron;

create or replace function public.send_maintenance_reminders()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v record;
  r record;
  items text[];
  current_km numeric;
  remaining numeric;
  days_left integer;
  tokens text[];
  t text;
  messages jsonb := '[]'::jsonb;
  sent integer := 0;
  label text;
begin
  for v in select * from public.vehicles loop
    items := array[]::text[];
    current_km := null;

    select s.closing_km into current_km
      from public.shifts s
      where s.vehicle_id = v.id and s.status = 'closed' and s.closing_km is not null
      order by s.closed_at desc
      limit 1;

    if current_km is not null then
      for r in
        select distinct on (l.type) l.type, l.km_at_service, l.interval_km, l.reminder_buffer_km
          from public.vehicle_maintenance_logs l
          where l.vehicle_id = v.id
          order by l.type, l.created_at desc
      loop
        if r.interval_km is not null then
          remaining := (r.km_at_service + r.interval_km) - current_km;
          if remaining <= r.reminder_buffer_km then
            label := case r.type
              when 'lastik' then 'Lastik değişiminin'
              when 'yag' then 'Yağ bakımının'
              when 'periyodik' then 'Periyodik bakımın'
              when 'fren' then 'Fren bakımının'
              else 'Bakımın' end;
            items := items || (case
              when remaining <= 0 then label || ' zamanı geçti.'
              else label || ' zamanına ' || remaining::int || ' km kaldı.' end);
          end if;
        end if;
      end loop;
    end if;

    if v.inspection_due_date is not null then
      days_left := v.inspection_due_date - (now() at time zone 'Europe/Istanbul')::date;
      if days_left <= coalesce(v.inspection_notice_days, 10) then
        items := items || (case
          when days_left < 0 then 'Vize süresi ' || abs(days_left) || ' gün önce doldu.'
          when days_left = 0 then 'Vize için bugün son gün.'
          else 'Vizeye ' || days_left || ' gün kaldı.' end);
      end if;
    end if;

    continue when coalesce(array_length(items, 1), 0) = 0;

    select array_agg(distinct p.push_token) into tokens
      from public.profiles p
      where p.push_token is not null
        and (
          p.id = v.owner_id
          or (
            v.maintenance_notify_drivers
            and p.id in (select vd.driver_id from public.vehicle_drivers vd where vd.vehicle_id = v.id)
          )
        );
    continue when tokens is null;

    foreach t in array tokens loop
      messages := messages || jsonb_build_array(jsonb_build_object(
        'to', t,
        'sound', 'default',
        'title', v.plate_no || ' · Bakım Hatırlatması',
        'body', array_to_string(items, ' ') || ' Yapıldıysa uygulamadan işaretle.',
        'data', jsonb_build_object('type', 'maintenance_reminder', 'vehicleId', v.id)
      ));
      sent := sent + 1;
    end loop;
  end loop;

  -- Expo tek istekte en fazla 100 bildirim kabul ediyor.
  if sent > 0 then
    for i in 0 .. ((sent - 1) / 100) loop
      perform net.http_post(
        url := 'https://exp.host/--/api/v2/push/send',
        body := (
          select jsonb_agg(x.e)
          from jsonb_array_elements(messages) with ordinality as x(e, n)
          where x.n > i * 100 and x.n <= (i + 1) * 100
        ),
        headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
      );
    end loop;
  end if;

  return sent;
end;
$$;

-- Uygulama kullanicilari bu fonksiyonu kendileri tetikleyemesin (sadece zamanlayici).
revoke execute on function public.send_maintenance_reminders() from public, anon, authenticated;

-- Her gun 06:00 UTC = 09:00 Turkiye saati
select cron.unschedule(jobid) from cron.job where jobname = 'dijital-karpin-bakim-hatirlatma';
select cron.schedule(
  'dijital-karpin-bakim-hatirlatma',
  '0 6 * * *',
  $cron$select public.send_maintenance_reminders();$cron$
);

-- ---------- commissions_and_account_deletion.sql ----------
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

-- ---------- vehicle_archive.sql ----------
-- Dijital Karpin - Arac silme: "karpin gecmisi kalsin" secenegi icin arac
-- tamamen silinmek yerine arsivlenir (listelerden kalkar, gecmis karpinleri
-- Gecmis sekmesinde gorunmeye devam eder).
alter table public.vehicles add column if not exists archived_at timestamptz;

-- ---------- sms_password_reset.sql ----------
-- Dijital Karpin - SMS ile sifre sifirlama (6 haneli kod)
--
-- Akis: kullanici telefonunu girer -> request_password_reset() 6 haneli kod
-- uretir, sifreli (bcrypt) saklar ve SMS saglayicisi uzerinden gonderir ->
-- kullanici kodu + yeni sifreyi girer -> confirm_password_reset() kodu
-- dogrular ve sifreyi degistirir.
--
-- SMS saglayicisi (SenaGSM, HTTP GET API) bilgileri sms_provider_config tablosunda
-- tutulur; bu tablo uygulamadan OKUNAMAZ (RLS, politika yok). Saglayici
-- hesabi acilinca sadece bu tablo doldurulur, uygulama guncellemesi gerekmez.
-- enabled = false iken uygulama kullaniciyi WhatsApp destek hattina yonlendirir.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_net;

create table if not exists public.password_reset_codes (
  phone text primary key,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  sent_count integer not null default 1,
  window_start timestamptz not null default now(),
  last_sent_at timestamptz not null default now()
);
alter table public.password_reset_codes enable row level security;

create table if not exists public.sms_provider_config (
  id integer primary key default 1 check (id = 1),
  enabled boolean not null default false,
  -- SenaGSM HTTP GET adresi sablonu. Yer tutucular:
  -- {{phone}} = 905XXXXXXXXX, {{phone10}} = 5XXXXXXXXX, {{message}} = URL-kodlu mesaj
  url_template text
);
alter table public.sms_provider_config add column if not exists url_template text;
alter table public.sms_provider_config enable row level security;
insert into public.sms_provider_config (id) values (1) on conflict (id) do nothing;

create or replace function public.request_password_reset(p_phone text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  cfg public.sms_provider_config;
  rec public.password_reset_codes;
  v_code text;
  v_message text;
  v_url text;
begin
  select * into cfg from public.sms_provider_config where id = 1;
  if cfg is null or not cfg.enabled or cfg.url_template is null then
    return 'disabled';
  end if;

  if not exists (select 1 from public.profiles where phone = p_phone) then
    return 'not_found';
  end if;

  select * into rec from public.password_reset_codes where phone = p_phone;
  if rec is not null then
    if rec.last_sent_at > now() - interval '60 seconds' then
      return 'too_soon';
    end if;
    if rec.window_start > now() - interval '24 hours' and rec.sent_count >= 5 then
      return 'limit';
    end if;
  end if;

  v_code := lpad(floor(random() * 1000000)::int::text, 6, '0');

  insert into public.password_reset_codes (phone, code_hash, expires_at, attempts, sent_count, window_start, last_sent_at)
  values (p_phone, crypt(v_code, gen_salt('bf')), now() + interval '10 minutes', 0, 1, now(), now())
  on conflict (phone) do update set
    code_hash = excluded.code_hash,
    expires_at = excluded.expires_at,
    attempts = 0,
    sent_count = case when password_reset_codes.window_start > now() - interval '24 hours'
                      then password_reset_codes.sent_count + 1 else 1 end,
    window_start = case when password_reset_codes.window_start > now() - interval '24 hours'
                        then password_reset_codes.window_start else now() end,
    last_sent_at = now();

  -- Turkce karakter yok (tek SMS, Ingilizce karakter limiti); URL icin
  -- bosluk ve iki nokta kodlaniyor.
  v_message := 'Dijital Karpin sifre sifirlama kodunuz: ' || v_code || ' Kodu kimseyle paylasmayin.';
  v_message := replace(replace(v_message, ' ', '%20'), ':', '%3A');
  v_url := replace(replace(replace(cfg.url_template,
              '{{phone}}', p_phone),
              '{{phone10}}', right(p_phone, 10)),
              '{{message}}', v_message);

  perform net.http_get(url := v_url);
  return 'sent';
end;
$$;

create or replace function public.confirm_password_reset(p_phone text, p_code text, p_new_password text)
returns text
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
declare
  rec public.password_reset_codes;
  v_user uuid;
begin
  if p_new_password is null or length(p_new_password) < 6 then
    return 'weak';
  end if;

  select * into rec from public.password_reset_codes where phone = p_phone;
  if rec is null then
    return 'invalid';
  end if;
  if rec.expires_at < now() then
    delete from public.password_reset_codes where phone = p_phone;
    return 'expired';
  end if;
  if rec.attempts >= 5 then
    return 'too_many';
  end if;
  if crypt(p_code, rec.code_hash) <> rec.code_hash then
    update public.password_reset_codes set attempts = attempts + 1 where phone = p_phone;
    return 'invalid';
  end if;

  select id into v_user from public.profiles where phone = p_phone limit 1;
  if v_user is null then
    return 'invalid';
  end if;

  update auth.users
    set encrypted_password = crypt(p_new_password, gen_salt('bf')),
        updated_at = now()
    where id = v_user;
  delete from public.password_reset_codes where phone = p_phone;
  return 'ok';
end;
$$;

revoke execute on function public.request_password_reset(text) from public;
revoke execute on function public.confirm_password_reset(text, text, text) from public;
grant execute on function public.request_password_reset(text) to anon, authenticated;
grant execute on function public.confirm_password_reset(text, text, text) to anon, authenticated;
