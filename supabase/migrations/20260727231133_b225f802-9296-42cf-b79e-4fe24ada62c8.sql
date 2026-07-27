-- Fix the trigger function to be security definer
CREATE OR REPLACE FUNCTION public.on_offer_accepted()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO public
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status <> 'accepted') THEN
    -- Update the order to assign the driver
    UPDATE public.orders
       SET driver_id = NEW.driver_id,
           status = 'driver_assigned',
           price = COALESCE(price, NEW.offered_price),
           updated_at = now()
     WHERE id = NEW.order_id;

    -- Update the freight program if it exists
    UPDATE public.freight_programs
       SET status = 'accepted',
           updated_at = now()
     WHERE order_id = NEW.order_id;

    -- Cancel other pending offers for the same order
    UPDATE public.freight_offers
       SET status = 'cancelled'
     WHERE order_id = NEW.order_id
       AND id <> NEW.id
       AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$function$;
