-- Separate authoritative values without backfilling or rewriting historical amounts.
CREATE OR REPLACE FUNCTION public.guard_freight_values() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' AND current_user NOT IN ('postgres','service_role','supabase_admin') AND NOT public.is_staff(auth.uid()) AND NOT public.is_finance(auth.uid()) AND (NEW.client_amount IS DISTINCT FROM OLD.client_amount OR NEW.driver_amount IS DISTINCT FROM OLD.driver_amount OR NEW.price IS DISTINCT FROM OLD.price OR NEW.margin_amount IS DISTINCT FROM OLD.margin_amount) THEN
  RAISE EXCEPTION 'Somente a equipe autorizada pode alterar valores do frete';
 END IF;
 IF TG_OP='INSERT' THEN
  NEW.margin_amount := NEW.client_amount - NEW.driver_amount;
 ELSIF NEW.client_amount IS DISTINCT FROM OLD.client_amount OR NEW.driver_amount IS DISTINCT FROM OLD.driver_amount THEN
  NEW.margin_amount := NEW.client_amount - NEW.driver_amount;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER freight_values_guard BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.guard_freight_values();

CREATE OR REPLACE FUNCTION public.on_offer_accepted() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.orders%ROWTYPE;
BEGIN
 IF TG_OP='UPDATE' AND NEW.status='accepted' AND OLD.status IS DISTINCT FROM NEW.status THEN
  SELECT * INTO o FROM public.orders WHERE id=NEW.order_id FOR UPDATE;
  IF NOT FOUND OR o.deleted_at IS NOT NULL OR o.status IN ('cancelled','delivered','finalized') OR (o.driver_id IS NOT NULL AND o.driver_id<>NEW.driver_id) THEN RAISE EXCEPTION 'Frete indisponível ou atribuído a outro motorista'; END IF;
  IF NEW.offered_price IS NULL OR NEW.offered_price<=0 THEN RAISE EXCEPTION 'Valor do motorista pendente'; END IF;
  UPDATE public.orders SET driver_id=NEW.driver_id,status='driver_assigned',driver_amount=NEW.offered_price,updated_at=now() WHERE id=NEW.order_id;
  UPDATE public.freight_programs SET status='accepted',freight_value=NEW.offered_price,updated_at=now() WHERE order_id=NEW.order_id;
  UPDATE public.freight_offers SET status='cancelled' WHERE order_id=NEW.order_id AND id<>NEW.id AND status IN ('pending','negotiating');
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_offer_value() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE amount numeric;
BEGIN
 IF TG_OP='INSERT' AND NEW.status IN ('pending','negotiating') THEN
  SELECT driver_amount INTO amount FROM public.orders WHERE id=NEW.order_id;
  IF amount IS NULL OR amount<=0 OR NEW.offered_price IS DISTINCT FROM amount THEN RAISE EXCEPTION 'Informe e salve o valor destinado ao motorista antes de ofertar'; END IF;
 ELSIF TG_OP='UPDATE' AND current_user NOT IN ('postgres','service_role','supabase_admin') AND NOT public.is_staff(auth.uid()) AND (NEW.offered_price IS DISTINCT FROM OLD.offered_price OR NEW.driver_id IS DISTINCT FROM OLD.driver_id OR NEW.order_id IS DISTINCT FROM OLD.order_id) THEN
  RAISE EXCEPTION 'O valor da oferta só pode mudar por negociação autorizada';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER freight_offer_value_guard BEFORE INSERT OR UPDATE ON public.freight_offers FOR EACH ROW EXECUTE FUNCTION public.guard_offer_value();

-- Preserve all existing validation, audit and notification logic while replacing wrong sources.
DO $migration$
DECLARE definition text; function_name text;
BEGIN
 SELECT pg_get_functiondef('public.accept_freight_offer(uuid,double precision,double precision)'::regprocedure) INTO definition;
 definition := replace(definition,'price = COALESCE(price, v_offer.offered_price)','driver_amount = v_offer.offered_price');
 EXECUTE definition;
 SELECT pg_get_functiondef('public.tg_create_driver_payment()'::regprocedure) INTO definition;
 definition := replace(definition,'COALESCE(fp.freight_value, NEW.price, 0)','NEW.driver_amount');
 definition := replace(definition,'v_gross := COALESCE(v_gross, NEW.price, 0);','v_gross := COALESCE(NEW.driver_amount, 0);');
 definition := replace(definition,'''aguardando_analise'', v_gross, v_add, v_gross + v_add','CASE WHEN NEW.driver_amount IS NULL THEN ''pendencia''::public.driver_payment_status ELSE ''aguardando_analise''::public.driver_payment_status END, v_gross, v_add, v_gross + v_add');
 definition := replace(definition,') RETURNING id INTO v_pid;',') RETURNING id INTO v_pid; IF NEW.driver_amount IS NULL THEN UPDATE public.driver_payments SET pending_reason=''Valor destinado ao motorista não registrado; conferir origem antes de corrigir'' WHERE id=v_pid; END IF;');
 EXECUTE definition;
 FOREACH function_name IN ARRAY ARRAY['public.send_program_to_driver(uuid,uuid,numeric,integer)','public.send_program_to_driver_as(uuid,uuid,uuid,numeric,integer)'] LOOP
  SELECT pg_get_functiondef(function_name::regprocedure) INTO definition;
  definition := replace(definition,'INSERT INTO public.freight_offers','IF _price IS NULL OR _price<=0 OR _price>10000000 THEN RAISE EXCEPTION ''Valor do motorista inválido''; END IF; UPDATE public.orders SET driver_amount=_price WHERE id=v_order_id AND driver_id IS NULL; IF NOT FOUND THEN RAISE EXCEPTION ''Frete já atribuído''; END IF; INSERT INTO public.freight_offers');
  definition := replace(definition,'freight_value = COALESCE(freight_value, _price)','freight_value = _price');
  EXECUTE definition;
 END LOOP;
 SELECT pg_get_functiondef('public.respond_freight_counteroffer(uuid,text)'::regprocedure) INTO definition;
 definition := replace(definition,'UPDATE public.negotiations
  SET status = _decision::public.negotiation_status','IF v_offer.status NOT IN (''pending'',''negotiating'') OR (v_offer.expires_at IS NOT NULL AND v_offer.expires_at<now()) THEN RAISE EXCEPTION ''Oferta indisponível ou expirada''; END IF; UPDATE public.negotiations
  SET status = _decision::public.negotiation_status');
 EXECUTE definition;
END $migration$;
ALTER FUNCTION public.submit_freight_counteroffer(uuid,numeric,text) SECURITY DEFINER;
ALTER FUNCTION public.respond_freight_counteroffer(uuid,text) SECURITY DEFINER;
REVOKE ALL ON FUNCTION public.submit_freight_counteroffer(uuid,numeric,text), public.respond_freight_counteroffer(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_freight_counteroffer(uuid,numeric,text), public.respond_freight_counteroffer(uuid,text) TO authenticated;

-- RLS restricts rows; column grants additionally prevent direct API/realtime commercial reads.
-- Read-only privileged projection explicitly authorizes staff, finance or the order's client.
CREATE VIEW public.commercial_orders WITH (security_barrier=true) AS SELECT o.* FROM public.orders o WHERE public.is_staff(auth.uid()) OR public.is_finance(auth.uid()) OR (auth.uid()=o.client_id AND NOT public.has_role(auth.uid(),'driver')) OR (NOT public.has_role(auth.uid(),'driver') AND EXISTS(SELECT 1 FROM public.works w WHERE w.id=o.work_id AND w.client_id=auth.uid()));
REVOKE ALL ON public.commercial_orders FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.commercial_orders TO authenticated;
GRANT ALL ON public.commercial_orders TO service_role;
REVOKE SELECT ON public.orders FROM authenticated,anon;
DO $$ DECLARE columns text; BEGIN
 SELECT string_agg(quote_ident(column_name),',') INTO columns FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name NOT IN ('price','client_amount','margin_amount','suggested_value','fuel_cost','other_costs');
 EXECUTE 'GRANT SELECT ('||columns||') ON public.orders TO authenticated';
END $$;
GRANT ALL ON public.orders TO service_role;
CREATE VIEW public.commercial_order_events WITH (security_barrier=true) AS SELECT e.* FROM public.order_events e WHERE public.is_staff(auth.uid()) OR public.is_finance(auth.uid()) OR (NOT public.has_role(auth.uid(),'driver') AND EXISTS(SELECT 1 FROM public.orders o WHERE o.id=e.order_id AND o.client_id=auth.uid())) ;
REVOKE ALL ON public.commercial_order_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.commercial_order_events TO authenticated;
GRANT ALL ON public.commercial_order_events TO service_role;
REVOKE SELECT ON public.order_events FROM authenticated,anon;
GRANT SELECT(id,order_id,event_type,from_status,to_status,actor_id,created_at) ON public.order_events TO authenticated;
GRANT ALL ON public.order_events TO service_role;
COMMENT ON COLUMN public.orders.price IS 'Legacy commercial field. Never use as driver payment or offer fallback; use explicit client_amount and driver_amount.';
COMMENT ON VIEW public.commercial_orders IS 'Read-only authorized commercial projection. Base orders grant only safe columns to authenticated clients; drivers cannot access this view.';