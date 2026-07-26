
CREATE POLICY "driver-photos public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'driver-photos');

CREATE POLICY "driver-photos staff write"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'driver-photos' AND public.is_staff(auth.uid()));

CREATE POLICY "driver-photos staff update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'driver-photos' AND public.is_staff(auth.uid()));

CREATE POLICY "driver-photos staff delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'driver-photos' AND public.is_staff(auth.uid()));
