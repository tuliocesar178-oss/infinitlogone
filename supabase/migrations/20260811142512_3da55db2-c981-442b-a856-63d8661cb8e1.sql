-- Ensure 'preparing' exists in order_status (we already checked, but for safety in migrations)
-- ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'preparing'; -- Already exists based on read_query

-- Ensure the current user has the 'admin' or 'logistics' role to pass is_staff()
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'tuliocesar178@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Revoke and Grant EXECUTE for all SECURITY DEFINER functions to satisfy linter and functionality
DO $$
DECLARE
    func_name text;
BEGIN
    FOR func_name IN 
        SELECT proname 
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND prosecdef = true
    LOOP
        EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I FROM PUBLIC', func_name);
        EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I TO authenticated', func_name);
    END LOOP;
END $$;

-- Specifically allow anon for tracking if needed
GRANT EXECUTE ON FUNCTION public.get_tracking TO anon;

-- Ensure all tables have proper grants
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
