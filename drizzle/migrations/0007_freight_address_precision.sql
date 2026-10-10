ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS origin_location_details jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS destination_location_details jsonb;
COMMENT ON COLUMN public.orders.origin_location_details IS 'Structured pickup address, number, complement, no-number flag, precision and confirmed coordinates.';
COMMENT ON COLUMN public.orders.destination_location_details IS 'Structured delivery address, number, complement, no-number flag, precision and confirmed coordinates.';
CREATE OR REPLACE FUNCTION public.invalidate_changed_freight_route() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF ROW(NEW.origin_address,NEW.origin_number,NEW.origin_city,NEW.origin_state,NEW.origin_zip,NEW.origin_neighborhood) IS DISTINCT FROM ROW(OLD.origin_address,OLD.origin_number,OLD.origin_city,OLD.origin_state,OLD.origin_zip,OLD.origin_neighborhood) THEN
  IF NEW.origin_location_details IS NOT DISTINCT FROM OLD.origin_location_details THEN NEW.origin_lat := NULL; NEW.origin_lng := NULL; NEW.origin_location_details := NULL; END IF;
 END IF;
 IF ROW(NEW.destination_address,NEW.destination_number,NEW.destination_city,NEW.destination_state,NEW.destination_zip,NEW.destination_neighborhood) IS DISTINCT FROM ROW(OLD.destination_address,OLD.destination_number,OLD.destination_city,OLD.destination_state,OLD.destination_zip,OLD.destination_neighborhood) THEN
  IF NEW.destination_location_details IS NOT DISTINCT FROM OLD.destination_location_details THEN NEW.destination_lat := NULL; NEW.destination_lng := NULL; NEW.destination_location_details := NULL; END IF;
 END IF;
 IF ROW(NEW.origin_lat,NEW.origin_lng,NEW.destination_lat,NEW.destination_lng) IS DISTINCT FROM ROW(OLD.origin_lat,OLD.origin_lng,OLD.destination_lat,OLD.destination_lng) THEN
  NEW.route_geometry := NULL; NEW.recorded_distance_km := NULL; NEW.eta_minutes := NULL; NEW.distance_to_destination_km := NULL;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER invalidate_changed_freight_route BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.invalidate_changed_freight_route();