
-- =====================================================================
-- Programação de Frete (PF) — schema + automação
-- =====================================================================

-- 1) drivers — cadastro financeiro/pessoal completo
CREATE TYPE public.driver_financial_status AS ENUM ('ativo','bloqueado','pagamento_pendente');
CREATE TYPE public.bank_account_type AS ENUM ('corrente','poupanca');
CREATE TYPE public.pix_key_type AS ENUM ('cpf','cnpj','email','phone','random');
CREATE TYPE public.payment_method_pref AS ENUM ('pix','ted','doc','boleto');

ALTER TABLE public.drivers
  ADD COLUMN cpf text,
  ADD COLUMN phone text,
  ADD COLUMN city text,
  ADD COLUMN photo_url text,
  ADD COLUMN rntrc text,
  ADD COLUMN cnh_expires_at date,
  ADD COLUMN bank_name text,
  ADD COLUMN bank_code text,
  ADD COLUMN bank_agency text,
  ADD COLUMN bank_account text,
  ADD COLUMN bank_account_digit text,
  ADD COLUMN bank_account_type public.bank_account_type,
  ADD COLUMN pix_key text,
  ADD COLUMN pix_key_type public.pix_key_type,
  ADD COLUMN favored_name text,
  ADD COLUMN favored_document text,
  ADD COLUMN preferred_payment_method public.payment_method_pref,
  ADD COLUMN payment_term_days integer,
  ADD COLUMN default_price_per_km numeric,
  ADD COLUMN min_freight_value numeric,
  ADD COLUMN financial_notes text,
  ADD COLUMN financial_status public.driver_financial_status NOT NULL DEFAULT 'ativo';

-- 2) orders — campos operacionais adicionais
ALTER TABLE public.orders
  ADD COLUMN origin_state text,
  ADD COLUMN origin_zip text,
  ADD COLUMN destination_state text,
  ADD COLUMN destination_zip text,
  ADD COLUMN cargo_volume_m3 numeric,
  ADD COLUMN invoice_value numeric,
  ADD COLUMN cargo_value_declared numeric,
  ADD COLUMN cte_number text,
  ADD COLUMN mdfe_number text,
  ADD COLUMN pickup_franchise_minutes integer,
  ADD COLUMN delivery_franchise_minutes integer;

-- 3) Programação de Frete
CREATE TYPE public.freight_program_status AS ENUM ('draft','sent','accepted','declined','cancelled');
CREATE TYPE public.freight_payment_method AS ENUM ('pix','ted','transferencia','boleto');
CREATE TYPE public.freight_payment_term AS ENUM ('a_vista','30d','45d','60d','90d');

CREATE SEQUENCE public.freight_program_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_pf_code()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE n bigint;
BEGIN
  n := nextval('public.freight_program_seq');
  RETURN 'PF-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 6, '0');
END;
$$;

CREATE TABLE public.freight_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  pf_code text NOT NULL UNIQUE DEFAULT public.generate_pf_code(),
  status public.freight_program_status NOT NULL DEFAULT 'draft',
  freight_value numeric,
  payment_method public.freight_payment_method,
  payment_term public.freight_payment_term,
  payment_notes text,
  responsible_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.freight_programs TO authenticated;
GRANT ALL ON public.freight_programs TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.freight_program_seq TO authenticated, service_role;

ALTER TABLE public.freight_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage freight programs"
  ON public.freight_programs FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Driver reads assigned sent program"
  ON public.freight_programs FOR SELECT
  TO authenticated
  USING (
    status IN ('sent','accepted')
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = freight_programs.order_id
        AND o.driver_id = auth.uid()
    )
  );

CREATE TRIGGER trg_freight_programs_updated_at
  BEFORE UPDATE ON public.freight_programs
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 4) Custos da operação
CREATE TYPE public.freight_cost_kind AS ENUM (
  'frete','pedagio','licenca','batedor','escolta','combustivel',
  'ajudante','estadia','diaria','outros'
);

CREATE TABLE public.freight_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.freight_programs(id) ON DELETE CASCADE,
  kind public.freight_cost_kind NOT NULL,
  label text,
  amount numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ix_freight_costs_program ON public.freight_costs(program_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.freight_costs TO authenticated;
GRANT ALL ON public.freight_costs TO service_role;

ALTER TABLE public.freight_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage freight costs"
  ON public.freight_costs FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Driver reads costs of sent program"
  ON public.freight_costs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.freight_programs p
      JOIN public.orders o ON o.id = p.order_id
      WHERE p.id = freight_costs.program_id
        AND p.status IN ('sent','accepted')
        AND o.driver_id = auth.uid()
    )
  );

-- 5) Trigger: criar PF automaticamente ao cadastrar um pedido
CREATE OR REPLACE FUNCTION public.create_freight_program_for_order()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.freight_programs (order_id, responsible_id)
  VALUES (NEW.id, NEW.created_by)
  ON CONFLICT (order_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_orders_create_pf
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.create_freight_program_for_order();

-- Preencher PFs para pedidos existentes
INSERT INTO public.freight_programs (order_id, responsible_id)
SELECT o.id, o.created_by
FROM public.orders o
WHERE NOT EXISTS (
  SELECT 1 FROM public.freight_programs p WHERE p.order_id = o.id
);

-- 6) RPC: enviar programação ao motorista
CREATE OR REPLACE FUNCTION public.send_program_to_driver(
  _program_id uuid,
  _driver_id uuid,
  _price numeric,
  _expires_minutes integer DEFAULT 15
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order_id uuid;
  v_offer_id uuid;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT order_id INTO v_order_id
  FROM public.freight_programs
  WHERE id = _program_id
  FOR UPDATE;
  IF v_order_id IS NULL THEN
    RAISE EXCEPTION 'programa nao encontrado';
  END IF;

  INSERT INTO public.freight_offers (order_id, driver_id, offered_price, status, expires_at)
  VALUES (v_order_id, _driver_id, _price, 'pending', now() + make_interval(mins => _expires_minutes))
  RETURNING id INTO v_offer_id;

  UPDATE public.freight_programs
     SET status = 'sent',
         sent_at = now(),
         freight_value = COALESCE(freight_value, _price),
         updated_at = now()
   WHERE id = _program_id;

  UPDATE public.orders
     SET status = CASE WHEN status = 'preparing' THEN 'awaiting_driver'::order_status ELSE status END,
         updated_at = now()
   WHERE id = v_order_id;

  INSERT INTO public.order_events (order_id, event_type, to_status, actor_id, payload)
  VALUES (v_order_id, 'program_sent', 'awaiting_driver',
          auth.uid(),
          jsonb_build_object('program_id', _program_id, 'driver_id', _driver_id, 'price', _price));

  RETURN v_offer_id;
END;
$$;

REVOKE ALL ON FUNCTION public.send_program_to_driver(uuid, uuid, numeric, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.send_program_to_driver(uuid, uuid, numeric, integer) TO authenticated;

-- 7) Trigger: quando uma oferta é aceita, PF => accepted e pedido => driver_assigned
CREATE OR REPLACE FUNCTION public.on_offer_accepted()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM 'accepted' THEN
    UPDATE public.orders
       SET driver_id = NEW.driver_id,
           status = 'driver_assigned',
           price = COALESCE(price, NEW.offered_price),
           updated_at = now()
     WHERE id = NEW.order_id;

    UPDATE public.freight_programs
       SET status = 'accepted',
           updated_at = now()
     WHERE order_id = NEW.order_id;

    -- cancela demais ofertas do mesmo pedido
    UPDATE public.freight_offers
       SET status = 'cancelled'
     WHERE order_id = NEW.order_id
       AND id <> NEW.id
       AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_offer_accepted ON public.freight_offers;
CREATE TRIGGER trg_offer_accepted
  AFTER UPDATE ON public.freight_offers
  FOR EACH ROW EXECUTE FUNCTION public.on_offer_accepted();
