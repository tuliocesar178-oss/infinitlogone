-- Permite que administradores e equipe operacional carreguem os clientes
-- usados nos filtros de relatórios, sem alterar os dados existentes.
do $$
begin
  if to_regclass('public.clients') is not null
     and not exists (
       select 1
       from pg_policies
       where schemaname = 'public'
         and tablename = 'clients'
         and policyname = 'Staff can view clients in reports'
     ) then
    create policy "Staff can view clients in reports"
      on public.clients
      for select
      to authenticated
      using (public.is_staff(auth.uid()));
  end if;

  if to_regclass('public.profiles') is not null
     and not exists (
       select 1
       from pg_policies
       where schemaname = 'public'
         and tablename = 'profiles'
         and policyname = 'Staff can view client profiles in reports'
     ) then
    create policy "Staff can view client profiles in reports"
      on public.profiles
      for select
      to authenticated
      using (
        public.is_staff(auth.uid())
        or id = auth.uid()
      );
  end if;
end
$$;