
CREATE POLICY "Driver inserts own" ON public.drivers FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
