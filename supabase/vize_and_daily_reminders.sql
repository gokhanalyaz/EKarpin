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
              when 'lastik' then 'Lastik Değişimi'
              when 'yag' then 'Yağ Bakımı'
              when 'periyodik' then 'Periyodik Bakım'
              when 'fren' then 'Fren Bakımı'
              else 'Bakım' end;
            items := items || (label || case
              when remaining <= 0 then ' (zamanı geçti)'
              else ' (' || remaining::int || ' km kaldı)' end);
          end if;
        end if;
      end loop;
    end if;

    if v.inspection_due_date is not null then
      days_left := v.inspection_due_date - (now() at time zone 'Europe/Istanbul')::date;
      if days_left <= coalesce(v.inspection_notice_days, 10) then
        items := items || (case
          when days_left < 0 then 'Vize (' || abs(days_left) || ' gün geçti)'
          when days_left = 0 then 'Vize (bugün son gün)'
          else 'Vize (' || days_left || ' gün kaldı)' end);
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
        'title', v.plate_no || ' - Bakım Hatırlatması',
        'body', array_to_string(items, ', ') || '. Yapıldıysa uygulamadan işaretlemeyi unutma.',
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
