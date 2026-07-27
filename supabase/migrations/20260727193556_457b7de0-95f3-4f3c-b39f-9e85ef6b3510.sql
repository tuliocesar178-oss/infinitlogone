-- Remove the client role for Tulio to ensure he is treated as admin
DELETE FROM public.user_roles 
WHERE user_id IN (
    SELECT id FROM auth.users WHERE email = 'tuliocesar178@gmail.com'
) 
AND role = 'client';