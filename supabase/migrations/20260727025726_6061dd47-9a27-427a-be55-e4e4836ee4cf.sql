INSERT INTO public.app_settings(key, value) VALUES
  ('pickup_arrival_radius_km', to_jsonb(0.2::numeric)),
  ('destination_arrival_radius_km', to_jsonb(0.1::numeric))
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.tg_after_driver_location()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  o public.orders%ROWTYPE;
  approach_km double precision;
  near_km double precision;
  pickup_arr_km double precision;
  dest_arr_km double precision;
  dist double precision;
  dist_pickup double precision;
  track_link text;
  msg_title text; msg_body text;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = NEW.order_id;
  IF NOT FOUND OR o.deleted_at IS NOT NULL THEN RETURN NEW; END IF;

  SELECT (value)::text::double precision INTO approach_km FROM public.app_settings WHERE key='approach_radius_km';
  SELECT (value)::text::double precision INTO near_km FROM public.app_settings WHERE key='near_radius_km';
  SELECT (value)::text::double precision INTO pickup_arr_km FROM public.app_settings WHERE key='pickup_arrival_radius_km';
  SELECT (value)::text::double precision INTO dest_arr_km FROM public.app_settings WHERE key='destination_arrival_radius_km';
  approach_km := coalesce(approach_km, 20);
  near_km := coalesce(near_km, 5);
  pickup_arr_km := coalesce(pickup_arr_km, 0.2);
  dest_arr_km := coalesce(dest_arr_km, 0.1);

  dist := NEW.distance_to_destination_km;
  IF o.origin_lat IS NOT NULL AND o.origin_lng IS NOT NULL THEN
    dist_pickup := public.haversine_km(NEW.lat, NEW.lng, o.origin_lat, o.origin_lng);
  END IF;

  UPDATE public.orders SET
    current_lat = NEW.lat,
    current_lng = NEW.lng,
    distance_to_destination_km = dist,
    last_ping_at = NEW.created_at
  WHERE id = o.id;

  IF dist_pickup IS NOT NULL AND dist_pickup <= pickup_arr_km
     AND o.status IN ('driver_assigned','en_route_pickup','in_transit_to_pickup') THEN
    UPDATE public.orders
       SET status = 'at_pickup',
           arrived_at = COALESCE(arrived_at, now())
     WHERE id = o.id;
    INSERT INTO public.order_events(order_id, event_type, from_status, to_status, actor_id, payload)
      VALUES (o.id, 'auto_pickup_arrival', o.status, 'at_pickup', NEW.driver_id,
              jsonb_build_object('distance_km', dist_pickup, 'radius_km', pickup_arr_km));
    INSERT INTO public.notifications(user_id, type, title, body, data)
      VALUES (NEW.driver_id, 'pickup_arrived', 'Chegada detectada na coleta',
              'Confirme o carregamento no app.',
              jsonb_build_object('order_id', o.id, 'code', o.code));
  END IF;

  IF dist IS NOT NULL AND dist <= dest_arr_km AND o.arrival_detected_at IS NULL
     AND o.status IN ('in_transit','out_for_delivery','near_destination','picked_up','loaded') THEN
    UPDATE public.orders SET arrival_detected_at = now() WHERE id = o.id;
    INSERT INTO public.order_events(order_id, event_type, actor_id, payload)
      VALUES (o.id, 'auto_destination_arrival', NEW.driver_id,
              jsonb_build_object('distance_km', dist, 'radius_km', dest_arr_km));
    INSERT INTO public.notifications(user_id, type, title, body, data)
      VALUES (NEW.driver_id, 'destination_arrived', 'Você chegou ao destino',
              'O botão "Iniciar entrega" foi liberado.',
              jsonb_build_object('order_id', o.id, 'code', o.code));
  END IF;

  IF dist IS NOT NULL AND dist <= approach_km AND o.status IN ('in_transit','out_for_delivery','picked_up','loaded') THEN
    UPDATE public.orders SET status = 'near_destination' WHERE id = o.id;
    INSERT INTO public.order_events(order_id, event_type, from_status, to_status, actor_id, payload)
      VALUES (o.id, 'auto_approach', o.status, 'near_destination', NEW.driver_id,
              jsonb_build_object('distance_km', dist, 'radius_km', approach_km));
  END IF;

  track_link := 'https://rastreio.infinitlog.com.br/' || o.tracking_code;

  IF dist IS NOT NULL AND dist <= approach_km AND o.approach_notified_at IS NULL THEN
    UPDATE public.orders SET approach_notified_at = now() WHERE id = o.id;
    msg_title := '🚚 Seu pedido está chegando!';
    msg_body := 'Seu pedido está a aproximadamente ' || round(dist)::text || ' km do local de entrega. Acompanhe: ' || track_link;
    IF o.contact_phone IS NOT NULL AND length(o.contact_phone)>0 THEN
      INSERT INTO public.notification_outbox(order_id, channel, recipient, subject, body) VALUES
        (o.id,'whatsapp',o.contact_phone,msg_title,msg_body),
        (o.id,'sms',o.contact_phone,msg_title,msg_body);
    END IF;
    INSERT INTO public.notification_outbox(order_id, channel, subject, body)
      VALUES (o.id,'push',msg_title,msg_body);
    INSERT INTO public.notifications(user_id, type, title, body, data)
      VALUES (NEW.driver_id, 'driver_near_20', 'Aproximação de 20 km do destino',
              'Prepare-se para entrega. O cliente foi notificado.',
              jsonb_build_object('order_id', o.id, 'distance_km', dist));
  END IF;

  IF dist IS NOT NULL AND dist <= near_km AND o.near_notified_at IS NULL THEN
    UPDATE public.orders SET near_notified_at = now() WHERE id = o.id;
    msg_title := 'O motorista está próximo do endereço informado';
    msg_body := 'Seu pedido chegará em aproximadamente ' || coalesce(o.eta_minutes::text,'poucos') || ' minutos. Acompanhe: ' || track_link;
    IF o.contact_phone IS NOT NULL AND length(o.contact_phone)>0 THEN
      INSERT INTO public.notification_outbox(order_id, channel, recipient, subject, body) VALUES
        (o.id,'whatsapp',o.contact_phone,msg_title,msg_body);
    END IF;
    INSERT INTO public.notification_outbox(order_id, channel, subject, body)
      VALUES (o.id,'push',msg_title,msg_body);
    INSERT INTO public.notifications(user_id, type, title, body, data)
      VALUES (NEW.driver_id, 'driver_near_5', 'A 5 km do destino',
              'Mantenha o app aberto e o GPS ativo.',
              jsonb_build_object('order_id', o.id, 'distance_km', dist));
  END IF;

  RETURN NEW;
END;
$function$;