ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'planning' BEFORE 'created';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'at_destination' BEFORE 'delivered';