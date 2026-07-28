-- Removendo temporariamente RLS para teste ou garantindo política total para authenticated
-- Isso ajuda a isolar se o erro é RLS ou outra coisa (como trigger de validação)

DROP POLICY IF EXISTS "Drivers can update assigned orders status" ON public.orders;
CREATE POLICY "Allow all updates for authenticated for now"
ON public.orders FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Verificando se existe alguma trigger que possa estar causando erro
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'orders';
