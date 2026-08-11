-- Ensure permissions for all tables involved in the order creation wizard
GRANT ALL ON public.orders TO authenticated;
GRANT ALL ON public.freight_programs TO authenticated;
GRANT ALL ON public.freight_costs TO authenticated;
GRANT ALL ON public.order_events TO authenticated;
GRANT ALL ON public.order_attachments TO authenticated;
GRANT ALL ON public.clients TO authenticated;
GRANT ALL ON public.user_roles TO authenticated;
GRANT ALL ON public.profiles TO authenticated;

-- Ensure that users with the 'client' role are present in the 'clients' table
-- Profiles doesn't have email (it's in auth.users), so we join with auth.users if possible
-- or just sync the fields we have. 
INSERT INTO public.clients (user_id, company_name)
SELECT ur.user_id, p.company_name
FROM public.user_roles ur
JOIN public.profiles p ON ur.user_id = p.id
WHERE ur.role = 'client'
ON CONFLICT (user_id) DO UPDATE SET
  company_name = EXCLUDED.company_name;

-- Note: contact_email in clients table might need manual update or another trigger since email is in auth.users
