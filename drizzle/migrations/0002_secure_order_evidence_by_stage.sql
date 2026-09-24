ALTER TABLE public.order_attachments
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.order_events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS event_status text,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS order_attachments_event_id_idx
  ON public.order_attachments(event_id);
CREATE INDEX IF NOT EXISTS order_attachments_order_status_idx
  ON public.order_attachments(order_id, event_status, created_at DESC);

UPDATE public.order_attachments
SET event_status = CASE
  WHEN kind IN ('foto_carga', 'foto_nf') THEN 'loaded'
  WHEN kind IN ('canhoto', 'foto_entrega', 'assinatura') THEN 'delivered'
  ELSE event_status
END
WHERE event_status IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_attachments TO authenticated;
GRANT ALL ON public.order_attachments TO service_role;
REVOKE ALL ON public.order_attachments FROM anon;

DROP POLICY IF EXISTS "Public attachments access" ON public.order_attachments;
DROP POLICY IF EXISTS "Client reads own order attachments" ON public.order_attachments;
CREATE POLICY "Client reads own order attachments"
ON public.order_attachments
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_attachments.order_id
      AND o.client_id = auth.uid()
      AND o.deleted_at IS NULL
  )
);

REVOKE ALL ON public.deliveries FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.deliveries TO authenticated;
GRANT ALL ON public.deliveries TO service_role;
DROP POLICY IF EXISTS "Public deliveries access" ON public.deliveries;

DROP POLICY IF EXISTS "order-files client read" ON storage.objects;
CREATE POLICY "order-files client read"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'order-files'
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id::text = (storage.foldername(name))[1]
      AND o.client_id = auth.uid()
      AND o.deleted_at IS NULL
  )
);