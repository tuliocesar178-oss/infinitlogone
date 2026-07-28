-- Corrigindo as políticas sem usar o papel 'moderator' se ele não existir
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;

-- Garante que o motorista pode ver seus próprios pedidos
DROP POLICY IF EXISTS "Drivers can view assigned orders" ON public.orders;
CREATE POLICY "Drivers can view assigned orders"
ON public.orders FOR SELECT
TO authenticated
USING (
  auth.uid() = driver_id OR 
  public.has_role(auth.uid(), 'admin')
);

-- Garante que o motorista pode atualizar o status do pedido atribuído
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

-- Garante que o motorista pode inserir eventos para seus pedidos
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

-- Permissões básicas adicionais
GRANT SELECT, UPDATE ON public.orders TO authenticated;
GRANT INSERT ON public.order_events TO authenticated;
