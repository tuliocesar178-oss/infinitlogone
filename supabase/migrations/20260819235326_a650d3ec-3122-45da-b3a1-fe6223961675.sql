-- Fix security issues found by linter
ALTER FUNCTION public.update_room_last_message() SET search_path = public;
ALTER FUNCTION public.on_order_created_create_chat() SET search_path = public;

-- Revoke execute from public and authenticated for these sensitive triggers
REVOKE EXECUTE ON FUNCTION public.update_room_last_message() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_room_last_message() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.on_order_created_create_chat() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.on_order_created_create_chat() FROM authenticated;
