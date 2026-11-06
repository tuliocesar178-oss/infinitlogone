CREATE OR REPLACE FUNCTION public.get_tracking(_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  o public.orders%ROWTYPE;
  d public.deliveries%ROWTYPE;
  dr public.drivers%ROWTYPE;
  driver_first text;
  last_update timestamptz;
  events jsonb;
  pt public.order_tracking_points%ROWTYPE;
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
    SELECT * INTO dr FROM public.drivers WHERE user_id = o.driver_id;
  END IF;

  SELECT * INTO pt FROM public.order_tracking_points
    WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1;

  SELECT * INTO d FROM public.deliveries WHERE order_id = o.id;

  SELECT jsonb_agg(jsonb_build_object(
    'event_type', event_type,
    'to_status', to_status,
    'created_at', created_at
  ) ORDER BY created_at) INTO events
    FROM public.order_events WHERE order_id = o.id;

  SELECT GREATEST(
    o.updated_at, pt.created_at,
    COALESCE((SELECT max(created_at) FROM public.order_events WHERE order_id = o.id), o.updated_at)
  ) INTO last_update;

  RETURN jsonb_build_object(
    'id', o.id,
    'code', o.code,
    'tracking_code', o.tracking_code,
    'status', o.status,
    'origin_city', o.origin_city,
    'destination_city', o.destination_city,
    'origin_address', o.origin_address,
    'destination_address', o.destination_address,
    'origin_lat', o.origin_lat,
    'origin_lng', o.origin_lng,
    'destination_lat', o.destination_lat,
    'destination_lng', o.destination_lng,
    'distance_to_destination_km', o.distance_to_destination_km,
    'initial_distance_km', o.initial_distance_km,
    'eta_minutes', o.eta_minutes,
    'delivery_window_start', o.delivery_window_start,
    'delivery_window_end', o.delivery_window_end,
    'driver_first_name', driver_first,
    'driver_lat', COALESCE(pt.lat, o.current_lat, dr.current_lat),
    'driver_lng', COALESCE(pt.lng, o.current_lng, dr.current_lng),
    'driver_speed', CASE WHEN pt.id IS NOT NULL THEN pt.speed ELSE dr.current_speed END,
    'driver_heading', CASE WHEN pt.id IS NOT NULL THEN pt.heading ELSE dr.current_heading END,
    'last_ping_at', COALESCE(pt.created_at, o.last_ping_at),
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
$function$;