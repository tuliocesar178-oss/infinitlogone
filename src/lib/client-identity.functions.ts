import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { clientIdentityIds } from './client-identity';

export const getClientIdentityIds = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from('operational_identities')
      .select('id,auth_user_id').eq('auth_user_id', context.userId).is('deleted_at', null);
    if (error) throw new Error('Não foi possível conferir o vínculo do cliente.');
    return clientIdentityIds(context.userId, data ?? []);
  });