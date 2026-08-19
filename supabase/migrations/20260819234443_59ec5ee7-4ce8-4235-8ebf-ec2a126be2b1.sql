DROP POLICY IF EXISTS "finance and staff read payments" ON public.driver_payments;
CREATE POLICY "finance and driver read payments" ON public.driver_payments
  FOR SELECT TO authenticated
  USING (public.is_finance(auth.uid()) OR driver_id = auth.uid());