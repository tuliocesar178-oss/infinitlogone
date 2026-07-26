
DROP POLICY IF EXISTS "vehicle-files staff all" ON storage.objects;
CREATE POLICY "vehicle-files staff all" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'vehicle-files' AND public.is_staff(auth.uid()))
  WITH CHECK (bucket_id = 'vehicle-files' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "vehicle-files driver read" ON storage.objects;
CREATE POLICY "vehicle-files driver read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'vehicle-files' AND EXISTS (
      SELECT 1 FROM public.vehicles v
      WHERE v.owner_driver_id = auth.uid()
        AND (storage.foldername(name))[1] = v.id::text
    )
  );
