
-- 1) app_settings (admin-managed config)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone auth reads settings" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manages settings" ON public.app_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

INSERT INTO public.app_settings(key,value) VALUES
  ('approach_radius_km', to_jsonb(20)),
  ('near_radius_km', to_jsonb(5)),
  ('arrival_radius_m', to_jsonb(100)),
  ('ping_interval_seconds', to_jsonb(15))
ON CONFLICT (key) DO NOTHING;

-- 2) driver_locations (raw pings)
CREATE TABLE IF NOT EXISTS public.driver_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  speed_kmh double precision,
  heading double precision,
  accuracy_m double precision,
  distance_to_destination_km double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_driver_locations_order_time
  ON public.driver_locations(order_id, created_at DESC);
GRANT SELECT, INSERT ON public.driver_locations TO authenticated;
GRANT ALL ON public.driver_locations TO service_role;
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Driver inserts own ping" ON public.driver_locations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = driver_id
    AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.driver_id = auth.uid()));
CREATE POLICY "Driver reads own pings" ON public.driver_locations FOR SELECT TO authenticated
  USING (auth.uid() = driver_id);
CREATE POLICY "Staff reads all pings" ON public.driver_locations FOR SELECT TO authenticated
  USING (is_staff(auth.uid()));

-- 3) route_summaries
CREATE TABLE IF NOT EXISTS public.route_summaries (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  driver_id uuid,
  started_at timestamptz,
  arrived_at timestamptz,
  total_distance_km numeric,
  total_minutes integer,
  avg_speed_kmh numeric,
  stops_count integer,
  points_count integer,
  replay_geojson jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.route_summaries TO authenticated;
GRANT ALL ON public.route_summaries TO service_role;
ALTER TABLE public.route_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read route summaries" ON public.route_summaries FOR SELECT TO authenticated
  USING (is_staff(auth.uid()));
CREATE POLICY "Driver reads own summary" ON public.route_summaries FOR SELECT TO authenticated
  USING (auth.uid() = driver_id);

-- 4) orders — new tracking columns
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS distance_to_destination_km double precision,
  ADD COLUMN IF NOT EXISTS eta_minutes integer,
  ADD COLUMN IF NOT EXISTS current_city text,
  ADD COLUMN IF NOT EXISTS current_lat double precision,
  ADD COLUMN IF NOT EXISTS current_lng double precision,
  ADD COLUMN IF NOT EXISTS last_ping_at timestamptz,
  ADD COLUMN IF NOT EXISTS approach_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS near_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS arrival_detected_at timestamptz,
  ADD COLUMN IF NOT EXISTS started_trip_at timestamptz,
  ADD COLUMN IF NOT EXISTS arrived_at timestamptz,
  ADD COLUMN IF NOT EXISTS initial_distance_km double precision,
  ADD COLUMN IF NOT EXISTS arrival_override_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS arrival_override_at timestamptz;

-- 5) helper: haversine (km)
CREATE OR REPLACE FUNCTION public.haversine_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
RETURNS double precision LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT 2 * 6371 * asin(sqrt(
    sin(radians((lat2-lat1)/2))^2 +
    cos(radians(lat1))*cos(radians(lat2))*sin(radians((lng2-lng1)/2))^2
  ));
$$;

-- 6) update get_tracking to include live location + distance/eta + current_city
CREATE OR REPLACE FUNCTION public.get_tracking(_code text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o public.orders%ROWTYPE;
  d public.deliveries%ROWTYPE;
  driver_first text;
  last_update timestamptz;
  events jsonb;
BEGIN
  SELECT * INTO o FROM public.orders
    WHERE (tracking_code = _code OR code = _code) AND deleted_at IS NULL
    LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF o.driver_id IS NOT NULL THEN
    SELECT split_part(coalesce(p.full_name, ''), ' ', 1) INTO driver_first
      FROM public.profiles p WHERE p.id = o.driver_id;
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
    coalesce(o.last_ping_at, o.updated_at),
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
    'destination_lat', o.destination_lat,
    'destination_lng', o.destination_lng,
    'delivery_window_start', o.delivery_window_start,
    'delivery_window_end', o.delivery_window_end,
    'driver_first_name', driver_first,
    'driver_lat', o.current_lat,
    'driver_lng', o.current_lng,
    'distance_to_destination_km', o.distance_to_destination_km,
    'initial_distance_km', o.initial_distance_km,
    'eta_minutes', o.eta_minutes,
    'current_city', o.current_city,
    'last_ping_at', o.last_ping_at,
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

-- 7) trigger on driver_locations: sync order + auto-transition + queue approach notifications
CREATE OR REPLACE FUNCTION public.tg_after_driver_location()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  o public.orders%ROWTYPE;
  approach_km double precision;
  near_km double precision;
  dist double precision;
  new_status public.order_status;
  msg_title text; msg_body text; track_link text;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = NEW.order_id;
  IF NOT FOUND OR o.deleted_at IS NOT NULL THEN RETURN NEW; END IF;

  SELECT (value)::text::double precision INTO approach_km FROM public.app_settings WHERE key='approach_radius_km';
  SELECT (value)::text::double precision INTO near_km FROM public.app_settings WHERE key='near_radius_km';
  approach_km := coalesce(approach_km,20);
  near_km := coalesce(near_km,5);

  dist := NEW.distance_to_destination_km;

  -- Update live order fields
  UPDATE public.orders SET
    current_lat = NEW.lat,
    current_lng = NEW.lng,
    distance_to_destination_km = dist,
    last_ping_at = NEW.created_at
  WHERE id = o.id;

  -- Approach transition
  IF dist IS NOT NULL AND dist <= approach_km AND o.status IN ('in_transit','out_for_delivery','picked_up','loaded') THEN
    UPDATE public.orders SET status = 'near_destination' WHERE id = o.id;
    INSERT INTO public.order_events(order_id, event_type, from_status, to_status, actor_id, payload)
      VALUES (o.id, 'auto_approach', o.status, 'near_destination', NEW.driver_id,
              jsonb_build_object('distance_km', dist, 'radius_km', approach_km));
  END IF;

  -- Notification thresholds (once each)
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
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_after_driver_location ON public.driver_locations;
CREATE TRIGGER trg_after_driver_location
  AFTER INSERT ON public.driver_locations
  FOR EACH ROW EXECUTE FUNCTION public.tg_after_driver_location();

-- 8) finalize route (staff / driver on delivery)
CREATE OR REPLACE FUNCTION public.finalize_route(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  first_pt public.driver_locations%ROWTYPE;
  last_pt  public.driver_locations%ROWTYPE;
  total_km numeric := 0;
  total_min integer := 0;
  prev record;
  cur record;
  stops integer := 0;
  points integer := 0;
  geo jsonb;
  o public.orders%ROWTYPE;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _order_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT * INTO first_pt FROM public.driver_locations WHERE order_id=_order_id ORDER BY created_at ASC LIMIT 1;
  SELECT * INTO last_pt  FROM public.driver_locations WHERE order_id=_order_id ORDER BY created_at DESC LIMIT 1;

  IF first_pt.id IS NULL THEN RETURN; END IF;

  prev := NULL;
  FOR cur IN SELECT lat,lng,speed_kmh,created_at FROM public.driver_locations WHERE order_id=_order_id ORDER BY created_at ASC LOOP
    points := points + 1;
    IF prev IS NOT NULL THEN
      total_km := total_km + coalesce(public.haversine_km(prev.lat,prev.lng,cur.lat,cur.lng),0);
    END IF;
    IF cur.speed_kmh IS NOT NULL AND cur.speed_kmh < 3 THEN stops := stops + 1; END IF;
    prev := cur;
  END LOOP;

  total_min := GREATEST(1, extract(epoch FROM (last_pt.created_at - first_pt.created_at))::int / 60);

  SELECT jsonb_build_object(
    'type','LineString',
    'coordinates', jsonb_agg(jsonb_build_array(lng,lat) ORDER BY created_at)
  ) INTO geo
  FROM public.driver_locations WHERE order_id=_order_id;

  INSERT INTO public.route_summaries(order_id, driver_id, started_at, arrived_at,
    total_distance_km, total_minutes, avg_speed_kmh, stops_count, points_count, replay_geojson)
  VALUES (_order_id, o.driver_id, first_pt.created_at, last_pt.created_at,
    round(total_km::numeric,2), total_min,
    round((total_km / GREATEST(total_min,1) * 60)::numeric,1),
    stops, points, geo)
  ON CONFLICT (order_id) DO UPDATE SET
    started_at = EXCLUDED.started_at,
    arrived_at = EXCLUDED.arrived_at,
    total_distance_km = EXCLUDED.total_distance_km,
    total_minutes = EXCLUDED.total_minutes,
    avg_speed_kmh = EXCLUDED.avg_speed_kmh,
    stops_count = EXCLUDED.stops_count,
    points_count = EXCLUDED.points_count,
    replay_geojson = EXCLUDED.replay_geojson;
END;
$$;
REVOKE ALL ON FUNCTION public.finalize_route(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.finalize_route(uuid) TO authenticated;

-- 9) authorize arrival override (staff only)
CREATE OR REPLACE FUNCTION public.override_arrival(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Only staff can override arrival';
  END IF;
  UPDATE public.orders SET arrival_override_by = auth.uid(), arrival_override_at = now()
   WHERE id = _order_id;
  INSERT INTO public.order_events(order_id, event_type, actor_id, payload)
    VALUES (_order_id,'arrival_override',auth.uid(),'{}'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.override_arrival(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.override_arrival(uuid) TO authenticated;
