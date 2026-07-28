-- Corrigindo as políticas de segurança (RLS) para permitir que o motorista atualize seus pedidos
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 1. Política de visualização (garantir que motoristas vejam o que lhes é atribuído)
DROP POLICY IF EXISTS "Drivers can view assigned orders" ON public.orders;
CREATE POLICY "Drivers can view assigned orders"
ON public.orders FOR SELECT
TO authenticated
USING (
  auth.uid() = driver_id OR 
  public.has_role(auth.uid(), 'admin')
);

-- 2. Política de atualização (aqui é onde geralmente ocorre o erro)
DROP POLICY IF EXISTS "Drivers can update assigned orders status" ON public.orders;
CREATE POLICY "Drivers can update assigned orders status"
ON public.orders FOR UPDATE
TO authenticated
USING (
  auth.uid() = driver_id OR 
  public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  auth.uid() = driver_id OR 
  public.has_role(auth.uid(), 'admin')
);

-- 3. Garantir que order_events também permita inserção pelo motorista
ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Drivers can insert events for assigned orders" ON public.order_events;
CREATE POLICY "Drivers can insert events for assigned orders"
ON public.order_events FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE id = order_id AND driver_id = auth.uid()
  ) OR 
  public.has_role(auth.uid(), 'admin')
);

-- 4. Permissões de Data API (GRANTs)
GRANT SELECT, UPDATE (status, updated_at, started_trip_at) ON public.orders TO authenticated;
GRANT INSERT ON public.order_events TO authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.orders TO service_role;
GRANT ALL ON public.order_events TO service_role;
-- Fix: Grant access to notification_outbox for drivers so the trigger can insert rows
-- Also make the notification trigger SECURITY DEFINER to avoid RLS issues on the outbox table
-- or explicitly allow authenticated users to INSERT if they are the ones triggering the status change.

-- Option A: Make the trigger function SECURITY DEFINER (Safer, avoids exposing outbox table)
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

-- Also ensure authenticated users have INSERT permission on the table itself if needed, 
-- but SECURITY DEFINER on the function handles it since the function owner (usually the migration user/service_role) has permissions.
GRANT INSERT ON public.notification_outbox TO authenticated;
