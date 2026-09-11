ALTER FUNCTION public.submit_freight_counteroffer(uuid, numeric, text) SECURITY INVOKER;
ALTER FUNCTION public.respond_freight_counteroffer(uuid, text) SECURITY INVOKER;

CREATE POLICY "Driver updates own negotiations"
ON public.negotiations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.freight_offers o
    WHERE o.id = negotiations.offer_id
      AND o.driver_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.freight_offers o
    WHERE o.id = negotiations.offer_id
      AND o.driver_id = auth.uid()
  )
);