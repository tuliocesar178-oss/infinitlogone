
CREATE TABLE IF NOT EXISTS public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read departments" ON public.departments FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'supervisor'::app_role));
CREATE POLICY "Admin manage departments" ON public.departments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

INSERT INTO public.departments (name) VALUES
  ('Logística'),('Financeiro'),('Comercial'),('Operacional'),
  ('Administrativo'),('Suporte'),('Gerência'),('Outros')
ON CONFLICT (name) DO NOTHING;

DO $$ BEGIN
  CREATE TYPE public.team_status AS ENUM ('ativo','bloqueado','convite_pendente','afastado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.team_members (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  cpf text,
  rg text,
  phone text,
  whatsapp text,
  birth_date date,
  address text,
  city text,
  state text,
  zip text,
  position text,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  admission_date date,
  photo_url text,
  notes text,
  status public.team_status NOT NULL DEFAULT 'convite_pendente',
  last_seen_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team read own or staff" ON public.team_members FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'supervisor'::app_role));
CREATE POLICY "Staff insert team" ON public.team_members FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'supervisor'::app_role));
CREATE POLICY "Staff or self update team" ON public.team_members FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'supervisor'::app_role) OR auth.uid() = user_id)
  WITH CHECK (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'supervisor'::app_role) OR auth.uid() = user_id);
CREATE POLICY "Admin delete team" ON public.team_members FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER trg_team_members_updated
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_departments_updated
  BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE IF NOT EXISTS public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name text,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read own or staff activity" ON public.activity_log FOR SELECT TO authenticated
  USING (actor_id = auth.uid() OR public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'supervisor'::app_role));
CREATE POLICY "Insert own or staff activity" ON public.activity_log FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE INDEX IF NOT EXISTS activity_log_actor_idx ON public.activity_log(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_log_entity_idx ON public.activity_log(entity_type, entity_id, created_at DESC);
