-- Force update orders that have an accepted offer but are still 'awaiting_driver'
UPDATE public.orders o
   SET driver_id = f.driver_id,
       status = 'driver_assigned',
       updated_at = now()
  FROM public.freight_offers f
 WHERE f.order_id = o.id
   AND f.status = 'accepted'
   AND o.status = 'awaiting_driver';
