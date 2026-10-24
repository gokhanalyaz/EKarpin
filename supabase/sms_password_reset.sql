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
