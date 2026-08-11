-- Ensure all security definer functions are restricted to authenticated roles
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

-- Explicitly allow get_tracking for anon for the public tracking portal
GRANT EXECUTE ON FUNCTION public.get_tracking TO anon;
