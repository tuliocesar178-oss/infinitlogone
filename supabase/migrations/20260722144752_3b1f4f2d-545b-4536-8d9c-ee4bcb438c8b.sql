
ALTER FUNCTION public.generate_tracking_code() SET search_path = public;
ALTER FUNCTION public.tg_set_updated_at() SET search_path = public;
ALTER VIEW public.order_tracking SET (security_invoker = true);
