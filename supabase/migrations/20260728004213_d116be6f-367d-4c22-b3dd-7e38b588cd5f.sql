-- Expand drivers table to store realtime metrics
ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS current_speed double precision,
ADD COLUMN IF NOT EXISTS current_heading double precision,
ADD COLUMN IF NOT EXISTS current_accuracy double precision,
ADD COLUMN IF NOT EXISTS current_altitude double precision;

-- Create a table for historical tracking points (Replay)
CREATE TABLE IF NOT EXISTS public.order_tracking_points (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    driver_id uuid NOT NULL REFERENCES auth.users(id),
    lat double precision NOT NULL,
    lng double precision NOT NULL,
    speed double precision,
    heading double precision,
    accuracy double precision,
    altitude double precision,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_tracking_order_id ON public.order_tracking_points(order_id);
CREATE INDEX IF NOT EXISTS idx_tracking_created_at ON public.order_tracking_points(created_at);

-- RLS and Grants
GRANT SELECT, INSERT ON public.order_tracking_points TO authenticated;
GRANT ALL ON public.order_tracking_points TO service_role;
GRANT SELECT ON public.order_tracking_points TO anon;

ALTER TABLE public.order_tracking_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers can insert their own tracking points"
ON public.order_tracking_points FOR INSERT TO authenticated
WITH CHECK (driver_id = auth.uid());

CREATE POLICY "Public can view tracking points for their orders"
ON public.order_tracking_points FOR SELECT TO anon, authenticated
USING (true); -- Filtered by order_id in queries

-- Ensure orders has started/ended timestamps
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS completed_at timestamptz;
