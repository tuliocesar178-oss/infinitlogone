create table if not exists public.works (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(user_id) on delete restrict,
  name text not null,
  code text,
  description text,
  address text,
  number text,
  complement text,
  neighborhood text,
  city text,
  state text,
  zip_code text,
  latitude double precision,
  longitude double precision,
  responsible_name text,
  responsible_phone text,
  responsible_whatsapp text,
  responsible_email text,
  status text not null default 'active'
    check (status in ('active', 'paused', 'finished', 'cancelled')),
  start_date date,
  expected_end_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists works_client_id_idx
  on public.works(client_id);

create index if not exists works_status_idx
  on public.works(status);

alter table public.orders
  add column if not exists work_id uuid references public.works(id) on delete restrict;

alter table public.orders
  add column if not exists recorded_distance_km numeric;

create index if not exists orders_work_id_idx
  on public.orders(work_id);

create or replace function public.validate_order_work_client()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  work_client_id uuid;
begin
  if new.work_id is null then
    return new;
  end if;

  select client_id
    into work_client_id
    from public.works
   where id = new.work_id;

  if work_client_id is null then
    raise exception 'A obra selecionada não existe';
  end if;

  if new.client_id is null then
    raise exception 'Um frete vinculado a uma obra precisa possuir cliente';
  end if;

  if work_client_id <> new.client_id then
    raise exception 'A obra selecionada não pertence ao cliente do frete';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_order_work_client_trigger on public.orders;

create trigger validate_order_work_client_trigger
before insert or update of client_id, work_id
on public.orders
for each row
execute function public.validate_order_work_client();

create or replace function public.set_works_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists works_updated_at_trigger on public.works;

create trigger works_updated_at_trigger
before update on public.works
for each row
execute function public.set_works_updated_at();

alter table public.works enable row level security;

create policy "staff can manage works"
on public.works
for all
to authenticated
using (
  public.is_staff(auth.uid())
)
with check (
  public.is_staff(auth.uid())
);

create policy "clients can view own works"
on public.works
for select
to authenticated
using (
  exists (
    select 1
      from public.clients c
     where c.user_id = works.client_id
       and c.user_id = auth.uid()
  )
);

create policy "clients can view own work orders"
on public.orders
for select
to authenticated
using (
  work_id is not null
  and exists (
    select 1
      from public.works w
      join public.clients c on c.user_id = w.client_id
     where w.id = orders.work_id
       and c.user_id = auth.uid()
  )
);