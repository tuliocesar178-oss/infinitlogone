GRANT SELECT, UPDATE, INSERT ON public.orders TO authenticated;
GRANT SELECT, INSERT ON public.order_events TO authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.orders TO service_role;
GRANT ALL ON public.order_events TO service_role;