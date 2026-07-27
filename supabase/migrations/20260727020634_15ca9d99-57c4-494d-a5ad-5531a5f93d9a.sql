DROP POLICY IF EXISTS "driver-photos public read" ON storage.objects;
DROP POLICY IF EXISTS "driver-photos staff write" ON storage.objects;
DROP POLICY IF EXISTS "driver-photos staff update" ON storage.objects;
DROP POLICY IF EXISTS "driver-photos staff delete" ON storage.objects;
DROP POLICY IF EXISTS "driver-photos authenticated read" ON storage.objects;
DROP POLICY IF EXISTS "driver-photos staff or owner insert" ON storage.objects;
DROP POLICY IF EXISTS "driver-photos staff or owner update" ON storage.objects;
DROP POLICY IF EXISTS "driver-photos staff delete" ON storage.objects;

CREATE POLICY "driver-photos authenticated read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'driver-photos');

CREATE POLICY "driver-photos staff or owner insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'driver-photos'
    AND (
      public.is_staff(auth.uid())
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );

CREATE POLICY "driver-photos staff or owner update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'driver-photos'
    AND (
      public.is_staff(auth.uid())
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  )
  WITH CHECK (
    bucket_id = 'driver-photos'
    AND (
      public.is_staff(auth.uid())
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );

CREATE POLICY "driver-photos staff delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'driver-photos' AND public.is_staff(auth.uid()));