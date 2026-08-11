-- Permitir que motoristas leiam pedidos para os quais possuem ofertas pendentes ou aceitas
DROP POLICY IF EXISTS "Driver reads orders with offers" ON public.orders;
CREATE POLICY "Driver reads orders with offers" ON public.orders 
FOR SELECT TO authenticated 
USING (
  (auth.uid() = driver_id) OR 
  EXISTS (
    SELECT 1 FROM public.freight_offers 
    WHERE freight_offers.order_id = orders.id 
    AND freight_offers.driver_id = auth.uid()
  )
);

-- Permitir que motoristas leiam programas de frete vinculados a ofertas
DROP POLICY IF EXISTS "Driver reads programs with offers" ON public.freight_programs;
CREATE POLICY "Driver reads programs with offers" ON public.freight_programs
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = freight_programs.order_id
    AND (
      (o.driver_id = auth.uid()) OR
      EXISTS (
        SELECT 1 FROM public.freight_offers fo
        WHERE fo.order_id = o.id
        AND fo.driver_id = auth.uid()
      )
    )
  )
);