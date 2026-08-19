-- ENUM de status financeiro
DO $$ BEGIN
  CREATE TYPE public.driver_payment_status AS ENUM (
    'aguardando_analise','em_conferencia','pendencia','aprovado','agendado','pago','cancelado','devolvido'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Helper: usuário é do financeiro (ou admin)
CREATE OR REPLACE FUNCTION public.is_finance(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','financeiro')
  );
$$;
REVOKE ALL ON FUNCTION public.is_finance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_finance(uuid) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.driver_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.driver_payment_status NOT NULL DEFAULT 'aguardando_analise',
  gross_amount numeric NOT NULL DEFAULT 0,
  additions_amount numeric NOT NULL DEFAULT 0,
  discounts_amount numeric NOT NULL DEFAULT 0,
  net_amount numeric NOT NULL DEFAULT 0,
  bank_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  delivered_at timestamptz,
  scheduled_for date,
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  paid_by uuid REFERENCES auth.users(id),
  paid_at timestamptz,
  paid_amount numeric,
  payment_method text,
  payment_bank text,
  payment_account text,
  receipt_url text,
  notes text,
  pending_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_driver_payments_driver ON public.driver_payments(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_payments_status ON public.driver_payments(status);

GRANT SELECT, INSERT, UPDATE ON public.driver_payments TO authenticated;
GRANT ALL ON public.driver_payments TO service_role;
ALTER TABLE public.driver_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance and staff read payments" ON public.driver_payments
  FOR SELECT TO authenticated
  USING (public.is_finance(auth.uid()) OR public.is_staff(auth.uid()) OR driver_id = auth.uid());

CREATE POLICY "finance insert payments" ON public.driver_payments
  FOR INSERT TO authenticated WITH CHECK (public.is_finance(auth.uid()));

CREATE POLICY "finance update payments" ON public.driver_payments
  FOR UPDATE TO authenticated
  USING (public.is_finance(auth.uid())) WITH CHECK (public.is_finance(auth.uid()));

CREATE TRIGGER trg_driver_payments_updated_at BEFORE UPDATE ON public.driver_payments
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Histórico / auditoria
CREATE TABLE IF NOT EXISTS public.driver_payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.driver_payments(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id),
  actor_name text,
  action text NOT NULL,
  from_status public.driver_payment_status,
  to_status public.driver_payment_status,
  reason text,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_driver_payment_events_payment ON public.driver_payment_events(payment_id);

GRANT SELECT, INSERT ON public.driver_payment_events TO authenticated;
GRANT ALL ON public.driver_payment_events TO service_role;
ALTER TABLE public.driver_payment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read payment events" ON public.driver_payment_events
  FOR SELECT TO authenticated
  USING (
    public.is_finance(auth.uid()) OR public.is_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.driver_payments p WHERE p.id = payment_id AND p.driver_id = auth.uid())
  );

CREATE POLICY "finance insert payment events" ON public.driver_payment_events
  FOR INSERT TO authenticated WITH CHECK (public.is_finance(auth.uid()));

-- Criação automática do registro financeiro quando o frete é entregue/finalizado
CREATE OR REPLACE FUNCTION public.tg_create_driver_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d public.drivers%ROWTYPE;
  prof public.profiles%ROWTYPE;
  v_gross numeric := 0;
  v_add numeric := 0;
  v_pid uuid;
BEGIN
  IF NEW.status NOT IN ('delivered','finalized') THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN RETURN NEW; END IF;
  IF NEW.driver_id IS NULL THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.driver_payments WHERE order_id = NEW.id) THEN RETURN NEW; END IF;

  SELECT * INTO d FROM public.drivers WHERE user_id = NEW.driver_id;
  SELECT * INTO prof FROM public.profiles WHERE id = NEW.driver_id;

  SELECT COALESCE(fp.freight_value, NEW.price, 0) INTO v_gross
    FROM public.freight_programs fp WHERE fp.order_id = NEW.id;
  v_gross := COALESCE(v_gross, NEW.price, 0);

  SELECT COALESCE(SUM(fc.amount),0) INTO v_add
    FROM public.freight_costs fc
    JOIN public.freight_programs fp ON fp.id = fc.program_id
   WHERE fp.order_id = NEW.id AND fc.kind <> 'frete';

  INSERT INTO public.driver_payments (
    order_id, driver_id, status, gross_amount, additions_amount, net_amount,
    delivered_at, bank_snapshot
  ) VALUES (
    NEW.id, NEW.driver_id, 'aguardando_analise', v_gross, v_add, v_gross + v_add,
    now(),
    jsonb_build_object(
      'favored_name', COALESCE(d.favored_name, prof.full_name),
      'favored_document', COALESCE(d.favored_document, d.cpf),
      'bank_name', d.bank_name, 'bank_code', d.bank_code,
      'bank_agency', d.bank_agency, 'bank_account', d.bank_account,
      'bank_account_digit', d.bank_account_digit,
      'bank_account_type', d.bank_account_type,
      'pix_key', d.pix_key, 'pix_key_type', d.pix_key_type,
      'snapshot_at', now()
    )
  ) RETURNING id INTO v_pid;

  INSERT INTO public.driver_payment_events (payment_id, action, to_status, notes)
  VALUES (v_pid, 'created', 'aguardando_analise', 'Frete entregue — enviado para análise financeira.');

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (NEW.driver_id, 'payment_analysis', 'Frete em análise financeira',
          'Seu frete foi concluído e está em análise financeira.',
          jsonb_build_object('order_id', NEW.id, 'code', NEW.code));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_create_driver_payment ON public.orders;
CREATE TRIGGER trg_orders_create_driver_payment
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.tg_create_driver_payment();

-- Notificações automáticas em mudanças de status financeiro
CREATE OR REPLACE FUNCTION public.tg_driver_payment_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.driver_id IS NOT NULL THEN
    IF NEW.status = 'aprovado' THEN
      INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (NEW.driver_id, 'payment_approved', 'Pagamento aprovado',
              'Seu frete foi aprovado para pagamento.',
              jsonb_build_object('payment_id', NEW.id, 'order_id', NEW.order_id, 'amount', NEW.net_amount));
    ELSIF NEW.status = 'pago' THEN
      INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (NEW.driver_id, 'payment_paid', 'Pagamento realizado',
              'Pagamento realizado com sucesso.',
              jsonb_build_object('payment_id', NEW.id, 'order_id', NEW.order_id,
                                 'amount', COALESCE(NEW.paid_amount, NEW.net_amount), 'paid_at', NEW.paid_at));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_driver_payment_notify ON public.driver_payments;
CREATE TRIGGER trg_driver_payment_notify AFTER UPDATE ON public.driver_payments
FOR EACH ROW EXECUTE FUNCTION public.tg_driver_payment_notify();

-- Backfill: fretes já entregues sem registro financeiro
INSERT INTO public.driver_payments (order_id, driver_id, status, gross_amount, net_amount, delivered_at, bank_snapshot)
SELECT o.id, o.driver_id, 'aguardando_analise', COALESCE(o.price,0), COALESCE(o.price,0), COALESCE(o.completed_at, o.updated_at),
  jsonb_build_object('favored_name', d.favored_name, 'favored_document', COALESCE(d.favored_document, d.cpf),
    'bank_name', d.bank_name, 'bank_code', d.bank_code, 'bank_agency', d.bank_agency,
    'bank_account', d.bank_account, 'bank_account_digit', d.bank_account_digit,
    'bank_account_type', d.bank_account_type, 'pix_key', d.pix_key, 'pix_key_type', d.pix_key_type,
    'snapshot_at', now())
FROM public.orders o LEFT JOIN public.drivers d ON d.user_id = o.driver_id
WHERE o.status IN ('delivered','finalized') AND o.driver_id IS NOT NULL AND o.deleted_at IS NULL
ON CONFLICT (order_id) DO NOTHING;