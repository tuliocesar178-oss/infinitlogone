
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'awaiting_driver' AFTER 'preparing';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'en_route_pickup' AFTER 'driver_assigned';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'at_pickup' AFTER 'en_route_pickup';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'loaded' AFTER 'at_pickup';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'in_transit' AFTER 'out_for_delivery';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'finalized' AFTER 'delivered';
