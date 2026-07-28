-- Fix: Make the notification trigger SECURITY DEFINER to avoid RLS issues when drivers update status
CREATE OR REPLACE FUNCTION public.notify_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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

GRANT INSERT ON public.notification_outbox TO authenticated;
