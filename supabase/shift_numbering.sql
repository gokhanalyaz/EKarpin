-- Dijital Karpin - Her aracin kendi icinde 1'den baslayan karpin numarasi.

alter table public.shifts add column if not exists shift_no integer;

-- Mevcut kayitlari, arac bazinda acilis tarihine gore 1'den numaralandir.
with numbered as (
  select id, row_number() over (partition by vehicle_id order by opened_at asc) as rn
  from public.shifts
)
update public.shifts s
set shift_no = numbered.rn
from numbered
where s.id = numbered.id and s.shift_no is null;

create or replace function public.set_shift_no()
returns trigger
language plpgsql
as $$
begin
  if new.shift_no is null then
    select coalesce(max(shift_no), 0) + 1 into new.shift_no
    from public.shifts
    where vehicle_id = new.vehicle_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_shift_no on public.shifts;
create trigger trg_set_shift_no
  before insert on public.shifts
  for each row execute procedure public.set_shift_no();
