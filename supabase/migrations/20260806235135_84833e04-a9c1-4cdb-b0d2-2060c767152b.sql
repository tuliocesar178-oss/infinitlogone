INSERT INTO public.user_roles (user_id, role)
VALUES ('24adcc4d-d04c-4700-9fd1-5a6143909727', 'client')
ON CONFLICT (user_id, role) DO NOTHING;