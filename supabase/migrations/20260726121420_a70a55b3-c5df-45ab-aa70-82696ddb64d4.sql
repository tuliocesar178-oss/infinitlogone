
DROP POLICY IF EXISTS "order-files staff all" ON storage.objects;
DROP POLICY IF EXISTS "order-files driver read" ON storage.objects;
DROP POLICY IF EXISTS "order-files driver insert" ON storage.objects;

CREATE POLICY "order-files staff all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'order-files' AND public.is_staff(auth.uid()))
  WITH CHECK (bucket_id = 'order-files' AND public.is_staff(auth.uid()));

CREATE POLICY "order-files driver read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'order-files' AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.driver_id = auth.uid()
      AND (storage.foldername(name))[1] = o.id::text
    )
  );

CREATE POLICY "order-files driver insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'order-files' AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.driver_id = auth.uid()
      AND (storage.foldername(name))[1] = o.id::text
    )
  );
