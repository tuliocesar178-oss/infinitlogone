-- Fix security issues: Revoke public execute on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.send_program_to_driver FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.review_driver_signup FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.override_arrival FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.finalize_route FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.send_program_to_driver_as FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.review_driver_signup_as FROM PUBLIC;

-- Grant execute to authenticated users where needed (logic is inside the function)
GRANT EXECUTE ON FUNCTION public.send_program_to_driver TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_driver_signup TO authenticated;
GRANT EXECUTE ON FUNCTION public.override_arrival TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_route TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tracking TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tracking TO anon;

-- Add missing address columns to profiles for better auto-fill
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- Backfill emails from auth.users (requires service_role usually, but in migration it works)
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;
