-- Corrigindo as políticas de segurança (RLS) para permitir que o motorista atualize seus pedidos
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 1. Política de visualização (garantir que motoristas vejam o que lhes é atribuído)
DROP POLICY IF EXISTS "Drivers can view assigned orders" ON public.orders;
CREATE POLICY "Drivers can view assigned orders"
ON public.orders FOR SELECT
TO authenticated
USING (
  auth.uid() = driver_id OR 
  public.has_role(auth.uid(), 'admin')
);

-- 2. Política de atualização (aqui é onde geralmente ocorre o erro)
DROP POLICY IF EXISTS "Drivers can update assigned orders status" ON public.orders;
CREATE POLICY "Drivers can update assigned orders status"
ON public.orders FOR UPDATE
TO authenticated
USING (
  auth.uid() = driver_id OR 
  public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  auth.uid() = driver_id OR 
  public.has_role(auth.uid(), 'admin')
);

-- 3. Garantir que order_events também permita inserção pelo motorista
ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Drivers can insert events for assigned orders" ON public.order_events;
CREATE POLICY "Drivers can insert events for assigned orders"
ON public.order_events FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE id = order_id AND driver_id = auth.uid()
  ) OR 
  public.has_role(auth.uid(), 'admin')
);

-- 4. Permissões de Data API (GRANTs)
GRANT SELECT, UPDATE (status, updated_at, started_trip_at) ON public.orders TO authenticated;
GRANT INSERT ON public.order_events TO authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.orders TO service_role;
GRANT ALL ON public.order_events TO service_role;
