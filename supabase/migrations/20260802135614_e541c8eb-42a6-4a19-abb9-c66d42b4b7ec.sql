ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'near_pickup';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'arriving_pickup';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'loading';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'arriving_destination';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'unloading';

INSERT INTO public.app_settings(key, value) VALUES
  ('pickup_near_radius_km', '5'::jsonb),
  ('pickup_arriving_radius_km', '0.5'::jsonb),
  ('pickup_unlock_radius_km', '0.1'::jsonb),
  ('destination_near_radius_km', '10'::jsonb),
  ('destination_arriving_radius_km', '1'::jsonb),
  ('destination_unlock_radius_km', '0.1'::jsonb),
  ('idle_alert_minutes', '20'::jsonb),
  ('speed_limit_kmh', '90'::jsonb)
ON CONFLICT (key) DO NOTHING;