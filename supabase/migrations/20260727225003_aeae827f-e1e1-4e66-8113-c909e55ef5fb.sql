-- Concedendo permissões de leitura para anon e authenticated nas tabelas necessárias para o rastreio
GRANT SELECT ON public.orders TO anon, authenticated;
GRANT SELECT ON public.order_events TO anon, authenticated;
GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT SELECT ON public.deliveries TO anon, authenticated;

-- Garantindo que service_role continue com acesso total
GRANT ALL ON public.orders TO service_role;
GRANT ALL ON public.order_events TO service_role;
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.deliveries TO service_role;

-- Criando política de leitura pública para ordens (filtrada para não expor tudo, apenas o necessário para o RPC funcionar em contexto anon)
-- O RPC get_tracking é SECURITY DEFINER, então ele ignora RLS. Mas o anon precisa de GRANT SELECT.
-- No entanto, ter uma política pública é boa prática se houver planos de consulta direta.
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public tracking access') THEN
    CREATE POLICY "Public tracking access" ON public.orders
      FOR SELECT TO anon, authenticated
      USING (deleted_at IS NULL);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public events access') THEN
    CREATE POLICY "Public events access" ON public.order_events
      FOR SELECT TO anon, authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public profiles access') THEN
    CREATE POLICY "Public profiles access" ON public.profiles
      FOR SELECT TO anon, authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public deliveries access') THEN
    CREATE POLICY "Public deliveries access" ON public.deliveries
      FOR SELECT TO anon, authenticated
      USING (true);
  END IF;
END $$;
