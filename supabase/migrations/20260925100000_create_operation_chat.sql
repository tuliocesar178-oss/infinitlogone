alter table public.chat_rooms
  add column if not exists conversation_type text not null default 'direct',
  add column if not exists title text,
  add column if not exists description text;

create table if not exists public.chat_room_members (
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index if not exists chat_room_members_user_id_idx
  on public.chat_room_members(user_id);

create index if not exists chat_rooms_conversation_type_idx
  on public.chat_rooms(conversation_type);

alter table public.chat_room_members enable row level security;

create or replace function public.can_access_staff_room(_room_id uuid, _user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chat_rooms r
    where r.id = _room_id
      and (
        (r.staff_a = _user and r.staff_b is not null)
        or (r.staff_b = _user and r.staff_a is not null)
        or exists (
          select 1
          from public.chat_room_members m
          where m.room_id = r.id
            and m.user_id = _user
        )
      )
  );
$$;

drop policy if exists "Members can view operation chat members" on public.chat_room_members;
create policy "Members can view operation chat members"
  on public.chat_room_members
  for select
  to authenticated
  using (public.can_access_staff_room(room_id, auth.uid()));

drop policy if exists "Members can read operation rooms" on public.chat_rooms;
create policy "Members can read operation rooms"
  on public.chat_rooms
  for select
  to authenticated
  using (
    conversation_type <> 'operation'
    or public.can_access_staff_room(id, auth.uid())
  );

create or replace function public.get_or_create_operation_room()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  room_id uuid;
begin
  if current_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = current_user_id
      and ur.role in ('admin', 'supervisor', 'logistics', 'operacional')
  ) then
    raise exception 'Acesso não autorizado';
  end if;

  select id
    into room_id
  from public.chat_rooms
  where conversation_type = 'operation'
  order by created_at
  limit 1;

  if room_id is null then
    insert into public.chat_rooms (
      conversation_type,
      title,
      description,
      last_message_at
    )
    values (
      'operation',
      'OPERAÇÃO',
      'Comunicação interna da equipe de operação da INFINITLOG.',
      now()
    )
    returning id into room_id;
  end if;

  insert into public.chat_room_members (room_id, user_id, role)
  select room_id, tm.user_id, 'member'
  from public.team_members tm
  join public.user_roles ur on ur.user_id = tm.user_id
  where tm.status = 'ativo'
    and ur.role in ('admin', 'supervisor', 'logistics', 'operacional')
  on conflict (room_id, user_id) do nothing;

  insert into public.chat_room_members (room_id, user_id, role)
  values (room_id, current_user_id, 'member')
  on conflict (room_id, user_id) do nothing;

  return room_id;
end;
$$;

revoke all on function public.get_or_create_operation_room() from public;
grant execute on function public.get_or_create_operation_room() to authenticated;