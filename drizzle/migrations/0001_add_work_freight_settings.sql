alter table public.works
  add column if not exists allow_new_freights boolean not null default true;

create unique index if not exists works_client_code_unique
  on public.works (client_id, code)
  where code is not null and code <> '';