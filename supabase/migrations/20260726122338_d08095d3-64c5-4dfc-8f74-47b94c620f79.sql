
-- 1) Sequência + novo formato de tracking code
CREATE SEQUENCE IF NOT EXISTS public.orders_tracking_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_tracking_code()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  n bigint;
BEGIN
  n := nextval('public.orders_tracking_seq');
  RETURN 'INF-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 6, '0');
END;
$$;

-- 2) Outbox de notificações
CREATE TABLE IF NOT EXISTS public.notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('whatsapp','email','sms','push')),
  recipient text,
  subject text,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','skipped')),
  sent_at timestamptz,
  error text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.notification_outbox TO authenticated;
GRANT ALL ON public.notification_outbox TO service_role;

ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage outbox" ON public.notification_outbox
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER trg_outbox_updated_at
  BEFORE UPDATE ON public.notification_outbox
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3) Trigger: cada mudança de status enfileira notificações ao cliente
CREATE OR REPLACE FUNCTION public.notify_status_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  msg_title text;
  msg_body text;
  track_link text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    msg_title := CASE NEW.status
      WHEN 'preparing' THEN 'Seu pedido está sendo preparado para coleta'
      WHEN 'awaiting_driver' THEN 'Estamos designando um motorista'
      WHEN 'driver_assigned' THEN 'Seu motorista foi designado'
      WHEN 'en_route_pickup' THEN 'Motorista a caminho da coleta'
      WHEN 'in_transit_to_pickup' THEN 'Motorista a caminho da coleta'
      WHEN 'at_pickup' THEN 'Motorista chegou ao local da coleta'
      WHEN 'picked_up' THEN 'Sua carga foi coletada'
      WHEN 'loaded' THEN 'Sua carga foi carregada'
      WHEN 'out_for_delivery' THEN 'Sua carga saiu para entrega'
      WHEN 'in_transit' THEN 'Sua carga está em trânsito'
      WHEN 'near_destination' THEN 'Seu pedido está próximo do destino'
      WHEN 'delivered' THEN 'Seu pedido foi entregue'
      WHEN 'finalized' THEN 'Seu pedido foi finalizado'
      WHEN 'cancelled' THEN 'Seu pedido foi cancelado'
      WHEN 'incident' THEN 'Registramos uma ocorrência no seu pedido'
      ELSE 'Atualização do seu pedido'
    END;

    track_link := 'https://rastreio.infinitlog.com.br/' || NEW.tracking_code;
    msg_body := msg_title || E'\n\nCódigo: ' || NEW.tracking_code
                || E'\nAcompanhe em tempo real: ' || track_link
                || E'\n\nInfinitLog Transportes';

    IF NEW.contact_phone IS NOT NULL AND length(NEW.contact_phone) > 0 THEN
      INSERT INTO public.notification_outbox(order_id, channel, recipient, subject, body)
      VALUES
        (NEW.id, 'whatsapp', NEW.contact_phone, msg_title, msg_body),
        (NEW.id, 'sms', NEW.contact_phone, msg_title, msg_body);
    END IF;

    -- Push channel enfileirado por pedido; provider resolve destinatários (client_id, tokens).
    INSERT INTO public.notification_outbox(order_id, channel, subject, body)
    VALUES (NEW.id, 'push', msg_title, msg_body);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_status_notify ON public.orders;
CREATE TRIGGER trg_orders_status_notify
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_status_change();

-- 4) get_tracking ampliada (mantém privacidade)
CREATE OR REPLACE FUNCTION public.get_tracking(_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  o public.orders%ROWTYPE;
  d public.deliveries%ROWTYPE;
  driver_first text;
  driver_lat double precision;
  driver_lng double precision;
  last_update timestamptz;
  events jsonb;
BEGIN
  SELECT * INTO o FROM public.orders
    WHERE (tracking_code = _code OR code = _code) AND deleted_at IS NULL
    LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF o.driver_id IS NOT NULL THEN
    SELECT split_part(coalesce(p.full_name, ''), ' ', 1)
      INTO driver_first
      FROM public.profiles p WHERE p.id = o.driver_id;
    SELECT current_lat, current_lng INTO driver_lat, driver_lng
      FROM public.drivers WHERE user_id = o.driver_id;
  END IF;

  SELECT * INTO d FROM public.deliveries WHERE order_id = o.id;

  SELECT jsonb_agg(jsonb_build_object(
    'event_type', event_type,
    'to_status', to_status,
    'created_at', created_at
  ) ORDER BY created_at) INTO events
    FROM public.order_events WHERE order_id = o.id;

  SELECT GREATEST(
    o.updated_at,
    COALESCE((SELECT max(created_at) FROM public.order_events WHERE order_id = o.id), o.updated_at)
  ) INTO last_update;

  RETURN jsonb_build_object(
    'code', o.code,
    'tracking_code', o.tracking_code,
    'status', o.status,
    'origin_city', o.origin_city,
    'destination_city', o.destination_city,
    'origin_address', o.origin_address,
    'destination_address', o.destination_address,
    'delivery_window_start', o.delivery_window_start,
    'delivery_window_end', o.delivery_window_end,
    'driver_first_name', driver_first,
    'driver_lat', driver_lat,
    'driver_lng', driver_lng,
    'last_update_at', last_update,
    'events', COALESCE(events, '[]'::jsonb),
    'delivery', CASE WHEN o.status IN ('delivered','finalized') AND d.order_id IS NOT NULL THEN
      jsonb_build_object(
        'delivered_at', d.delivered_at,
        'receiver_name', d.receiver_name,
        'receiver_document', d.receiver_document,
        'pickup_photo_url', d.pickup_photo_url,
        'delivery_photo_url', d.delivery_photo_url,
        'signature_url', d.signature_url,
        'invoice_url', d.invoice_url
      )
    ELSE NULL END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_tracking(text) TO anon, authenticated;
