-- Dijital Karpin - KVKK onayinin ne zaman verildigini kanit olarak sakla

alter table public.profiles add column if not exists kvkk_accepted_at timestamptz;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, phone, kvkk_accepted_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'driver'),
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone',
    (new.raw_user_meta_data->>'kvkk_accepted_at')::timestamptz
  );
  return new;
end;
$$;
