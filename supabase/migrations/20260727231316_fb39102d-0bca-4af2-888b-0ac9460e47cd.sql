ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS origin_neighborhood text,
ADD COLUMN IF NOT EXISTS origin_number text,
ADD COLUMN IF NOT EXISTS pickup_phone_name text,
ADD COLUMN IF NOT EXISTS pickup_whatsapp text,
ADD COLUMN IF NOT EXISTS pickup_reference text,
ADD COLUMN IF NOT EXISTS pickup_dock text,
ADD COLUMN IF NOT EXISTS pickup_gate text,
ADD COLUMN IF NOT EXISTS pickup_instructions text,
ADD COLUMN IF NOT EXISTS destination_neighborhood text,
ADD COLUMN IF NOT EXISTS destination_number text,
ADD COLUMN IF NOT EXISTS delivery_whatsapp text,
ADD COLUMN IF NOT EXISTS delivery_reference text,
ADD COLUMN IF NOT EXISTS delivery_dock text,
ADD COLUMN IF NOT EXISTS delivery_gate text,
ADD COLUMN IF NOT EXISTS estimated_tolls numeric,
ADD COLUMN IF NOT EXISTS route_highways text,
ADD COLUMN IF NOT EXISTS route_geometry text;

-- Ensure these columns are accessible
GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
