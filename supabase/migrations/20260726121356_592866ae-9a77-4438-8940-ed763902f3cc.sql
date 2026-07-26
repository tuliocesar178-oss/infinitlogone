
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS client_name text,
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS pickup_window_start timestamptz,
  ADD COLUMN IF NOT EXISTS pickup_window_end timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_window_start timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_window_end timestamptz,
  ADD COLUMN IF NOT EXISTS volumes integer,
  ADD COLUMN IF NOT EXISTS cargo_type text,
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal';

ALTER TABLE public.orders ALTER COLUMN status SET DEFAULT 'preparing'::order_status;

CREATE TABLE IF NOT EXISTS public.order_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  kind text NOT NULL,
  label text,
  file_path text NOT NULL,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_attachments TO authenticated;
GRANT ALL ON public.order_attachments TO service_role;
ALTER TABLE public.order_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage attachments" ON public.order_attachments;
CREATE POLICY "Staff manage attachments" ON public.order_attachments
  FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Driver reads attachments of own orders" ON public.order_attachments;
CREATE POLICY "Driver reads attachments of own orders" ON public.order_attachments
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_attachments.order_id AND o.driver_id = auth.uid()));

DROP POLICY IF EXISTS "Driver uploads attachments to own orders" ON public.order_attachments;
CREATE POLICY "Driver uploads attachments to own orders" ON public.order_attachments
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_attachments.order_id AND o.driver_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.get_tracking(_code text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'code', o.code,
    'tracking_code', o.tracking_code,
    'status', o.status,
    'origin_city', o.origin_city,
    'destination_city', o.destination_city,
    'origin_address', o.origin_address,
    'destination_address', o.destination_address,
    'delivery_window_start', o.delivery_window_start,
    'delivery_window_end', o.delivery_window_end,
    'driver_first_name', split_part(coalesce(p.full_name,''),' ',1),
    'events', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('event_type', e.event_type, 'to_status', e.to_status, 'created_at', e.created_at) ORDER BY e.created_at)
      FROM public.order_events e WHERE e.order_id = o.id
    ), '[]'::jsonb)
  )
  FROM public.orders o
  LEFT JOIN public.profiles p ON p.id = o.driver_id
  WHERE upper(o.tracking_code) = upper(_code) OR upper(o.code) = upper(_code)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_tracking(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tracking(text) TO anon, authenticated;

DROP TRIGGER IF EXISTS orders_set_updated_at ON public.orders;
CREATE TRIGGER orders_set_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
