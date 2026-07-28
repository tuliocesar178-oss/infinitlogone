GRANT SELECT ON public.order_attachments TO anon, authenticated;
GRANT SELECT ON public.deliveries TO anon, authenticated;
GRANT SELECT ON public.order_events TO anon, authenticated;
GRANT SELECT ON public.orders TO anon, authenticated;
GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT SELECT ON public.user_roles TO anon, authenticated;
GRANT ALL ON public.freight_offers TO authenticated, service_role;
GRANT ALL ON public.negotiations TO authenticated, service_role;