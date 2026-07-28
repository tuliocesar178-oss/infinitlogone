-- Reforçando permissões e verificando RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;

-- Política de visualização para motoristas
DROP POLICY IF EXISTS "Drivers can view assigned orders" ON public.orders;
CREATE POLICY "Drivers can view assigned orders"
ON public.orders FOR SELECT
TO authenticated
USING (
  auth.uid() = driver_id OR 
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'logistics') OR
  public.has_role(auth.uid(), 'operacional')
);

-- Política de atualização para motoristas (crucial para o erro)
DROP POLICY IF EXISTS "Drivers can update assigned orders status" ON public.orders;
CREATE POLICY "Drivers can update assigned orders status"
ON public.orders FOR UPDATE
TO authenticated
USING (
  auth.uid() = driver_id OR 
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'logistics') OR
  public.has_role(auth.uid(), 'operacional')
)
WITH CHECK (
  auth.uid() = driver_id OR 
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'logistics') OR
  public.has_role(auth.uid(), 'operacional')
);

-- Política de inserção de eventos
DROP POLICY IF EXISTS "Drivers can insert events for assigned orders" ON public.order_events;
CREATE POLICY "Drivers can insert events for assigned orders"
ON public.order_events FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE id = order_id AND driver_id = auth.uid()
  ) OR 
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'logistics') OR
  public.has_role(auth.uid(), 'operacional')
);

-- Garantir que as colunas updated_at e status podem ser editadas
GRANT UPDATE (status, updated_at, started_trip_at) ON public.orders TO authenticated;
GRANT INSERT ON public.order_events TO authenticated;
GRANT SELECT ON public.orders TO authenticated;
GRANT SELECT ON public.order_events TO authenticated;
GRANT ALL ON public.orders TO service_role;
GRANT ALL ON public.order_events TO service_role;
