-- 1. Versões das tabelas oficiais da ANTT
CREATE TABLE public.antt_rate_tables (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  resolucao text NOT NULL,
  anexo text,
  fonte text,
  vigencia_inicio date NOT NULL,
  vigencia_fim date,
  active boolean NOT NULL DEFAULT false,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.antt_rate_tables TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.antt_rate_tables TO authenticated;
GRANT ALL ON public.antt_rate_tables TO service_role;
ALTER TABLE public.antt_rate_tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "antt_tables_select" ON public.antt_rate_tables
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "antt_tables_admin_write" ON public.antt_rate_tables
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_antt_rate_tables_updated_at
  BEFORE UPDATE ON public.antt_rate_tables
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 2. Coeficientes (CCD/CC) por tabela, tipo de carga e eixos
CREATE TABLE public.antt_freight_rates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_id uuid NOT NULL REFERENCES public.antt_rate_tables(id) ON DELETE CASCADE,
  tabela text NOT NULL CHECK (tabela IN ('A','B','C','D')),
  tipo_carga text NOT NULL,
  codigo_tipo_carga text NOT NULL,
  eixos integer NOT NULL CHECK (eixos BETWEEN 2 AND 9),
  ccd numeric(12,4) NOT NULL CHECK (ccd >= 0),
  cc numeric(12,2) NOT NULL DEFAULT 0 CHECK (cc >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (table_id, tabela, codigo_tipo_carga, eixos)
);

CREATE INDEX idx_antt_rates_lookup
  ON public.antt_freight_rates (table_id, tabela, codigo_tipo_carga, eixos);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.antt_freight_rates TO authenticated;
GRANT ALL ON public.antt_freight_rates TO service_role;
ALTER TABLE public.antt_freight_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "antt_rates_select" ON public.antt_freight_rates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "antt_rates_admin_write" ON public.antt_freight_rates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_antt_freight_rates_updated_at
  BEFORE UPDATE ON public.antt_freight_rates
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3. Snapshot do cálculo no pedido (auditável, nunca recalculado)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS antt_applicable boolean,
  ADD COLUMN IF NOT EXISTS antt_cargo_class text,
  ADD COLUMN IF NOT EXISTS antt_axles integer,
  ADD COLUMN IF NOT EXISTS antt_contract_type text,
  ADD COLUMN IF NOT EXISTS antt_high_performance boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS antt_table text,
  ADD COLUMN IF NOT EXISTS antt_ccd numeric(12,4),
  ADD COLUMN IF NOT EXISTS antt_cc numeric(12,2),
  ADD COLUMN IF NOT EXISTS antt_distance_km numeric(12,2),
  ADD COLUMN IF NOT EXISTS antt_minimum_value numeric(12,2),
  ADD COLUMN IF NOT EXISTS antt_resolution text,
  ADD COLUMN IF NOT EXISTS antt_effective_date date,
  ADD COLUMN IF NOT EXISTS antt_calculated_at timestamptz,
  ADD COLUMN IF NOT EXISTS antt_rate_table_id uuid REFERENCES public.antt_rate_tables(id),
  ADD COLUMN IF NOT EXISTS antt_not_applicable_reason text,
  ADD COLUMN IF NOT EXISTS suggested_value numeric(12,2),
  ADD COLUMN IF NOT EXISTS margin_amount numeric(12,2);

-- 4. Auditoria de alterações financeiras/operacionais do frete
CREATE TABLE public.order_field_changes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id),
  actor_name text,
  field text NOT NULL,
  old_value text,
  new_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_field_changes_order ON public.order_field_changes (order_id, created_at DESC);

GRANT SELECT, INSERT ON public.order_field_changes TO authenticated;
GRANT ALL ON public.order_field_changes TO service_role;
ALTER TABLE public.order_field_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_changes_staff_select" ON public.order_field_changes
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR public.is_finance(auth.uid()));
CREATE POLICY "order_changes_insert" ON public.order_field_changes
  FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());