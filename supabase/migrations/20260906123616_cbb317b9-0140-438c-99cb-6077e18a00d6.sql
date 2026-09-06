-- 1. Novas colunas em orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cargo_product text,
  ADD COLUMN IF NOT EXISTS cargo_package_type text,
  ADD COLUMN IF NOT EXISTS cargo_dimensions text,
  ADD COLUMN IF NOT EXISTS purchase_order text,
  ADD COLUMN IF NOT EXISTS operation_type text,
  ADD COLUMN IF NOT EXISTS required_vehicle_type text,
  ADD COLUMN IF NOT EXISTS required_body_type text,
  ADD COLUMN IF NOT EXISTS required_capacity_kg numeric,
  ADD COLUMN IF NOT EXISTS required_axles integer,
  ADD COLUMN IF NOT EXISTS helpers_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS helpers_count integer,
  ADD COLUMN IF NOT EXISTS tracking_required boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS special_requirements text,
  ADD COLUMN IF NOT EXISTS fuel_cost numeric,
  ADD COLUMN IF NOT EXISTS other_costs numeric,
  ADD COLUMN IF NOT EXISTS driver_amount numeric,
  ADD COLUMN IF NOT EXISTS client_amount numeric,
  ADD COLUMN IF NOT EXISTS offer_expires_minutes integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_contact_name text,
  ADD COLUMN IF NOT EXISTS delivery_phone text,
  ADD COLUMN IF NOT EXISTS pickup_contact_name text,
  ADD COLUMN IF NOT EXISTS pickup_phone text,
  ADD COLUMN IF NOT EXISTS delivery_instructions text;

-- 2. Histórico automático de status
CREATE OR REPLACE FUNCTION public.tg_log_order_status_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.order_events(order_id, event_type, from_status, to_status, actor_id, payload)
    VALUES (NEW.id, 'status_change', OLD.status, NEW.status, auth.uid(), '{}'::jsonb);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_status_history ON public.orders;
CREATE TRIGGER trg_orders_status_history
AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.tg_log_order_status_history();

-- 3. Aceite atômico do frete
CREATE OR REPLACE FUNCTION public.accept_freight_offer(_offer_id uuid, _lat double precision DEFAULT NULL, _lng double precision DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_offer public.freight_offers%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_uid uuid := auth.uid();
  v_name text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO v_offer FROM public.freight_offers WHERE id = _offer_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'offer_not_found');
  END IF;
  IF v_offer.driver_id <> v_uid THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF v_offer.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'offer_unavailable');
  END IF;
  IF v_offer.expires_at IS NOT NULL AND v_offer.expires_at < now() THEN
    UPDATE public.freight_offers SET status = 'expired' WHERE id = _offer_id;
    RETURN jsonb_build_object('ok', false, 'reason', 'offer_expired');
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = v_offer.order_id FOR UPDATE;
  IF v_order.driver_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_assigned');
  END IF;

  UPDATE public.freight_offers
     SET status = 'accepted',
         accepted_at = now(),
         accepted_lat = _lat,
         accepted_lng = _lng,
         time_to_accept_seconds = GREATEST(0, extract(epoch FROM (now() - created_at))::int)
   WHERE id = _offer_id;

  UPDATE public.freight_offers
     SET status = 'cancelled'
   WHERE order_id = v_offer.order_id AND id <> _offer_id AND status IN ('pending','negotiating');

  UPDATE public.orders
     SET driver_id = v_uid,
         status = 'driver_assigned',
         price = COALESCE(price, v_offer.offered_price),
         updated_at = now()
   WHERE id = v_offer.order_id;

  SELECT full_name INTO v_name FROM public.profiles WHERE id = v_uid;

  INSERT INTO public.order_events(order_id, event_type, from_status, to_status, actor_id, payload)
  VALUES (v_offer.order_id, 'offer_accepted', v_order.status, 'driver_assigned', v_uid,
          jsonb_build_object('offer_id', _offer_id, 'driver_name', v_name, 'lat', _lat, 'lng', _lng));

  INSERT INTO public.messages(order_id, room_id, sender_id, kind, content)
  SELECT v_offer.order_id, cr.id, v_uid, 'text', COALESCE(v_name,'Motorista') || ' aceitou o frete.'
    FROM public.chat_rooms cr WHERE cr.order_id = v_offer.order_id;

  INSERT INTO public.notifications(user_id, type, title, body, data)
  VALUES (v_uid, 'freight_assigned', 'Frete atribuído a você',
          'Você confirmou o frete ' || v_order.code || '.',
          jsonb_build_object('order_id', v_offer.order_id, 'code', v_order.code));

  INSERT INTO public.notifications(user_id, type, title, body, data)
  SELECT ur.user_id, 'freight_accepted', 'Motorista aceitou o frete',
         COALESCE(v_name,'Um motorista') || ' aceitou o frete ' || v_order.code || '.',
         jsonb_build_object('order_id', v_offer.order_id, 'code', v_order.code)
    FROM public.user_roles ur WHERE ur.role IN ('admin','logistics');

  RETURN jsonb_build_object('ok', true, 'order_id', v_offer.order_id);
END;
$$;

REVOKE ALL ON FUNCTION public.accept_freight_offer(uuid, double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_freight_offer(uuid, double precision, double precision) TO authenticated;

-- 4. Recusa do frete
CREATE OR REPLACE FUNCTION public.decline_freight_offer(_offer_id uuid, _reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_offer public.freight_offers%ROWTYPE;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT * INTO v_offer FROM public.freight_offers WHERE id = _offer_id FOR UPDATE;
  IF NOT FOUND OR v_offer.driver_id <> v_uid THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  UPDATE public.freight_offers SET status = 'declined' WHERE id = _offer_id;

  INSERT INTO public.order_events(order_id, event_type, actor_id, payload)
  VALUES (v_offer.order_id, 'offer_declined', v_uid,
          jsonb_build_object('offer_id', _offer_id, 'reason', _reason));

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.decline_freight_offer(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decline_freight_offer(uuid, text) TO authenticated;