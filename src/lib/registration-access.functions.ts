import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

export const activateRegistration = createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
  .inputValidator(z.object({id:z.string().uuid(),kind:z.enum(['driver','client']),email:z.string().trim().email(),password:z.string().min(12).max(128)}))
  .handler(async({data,context})=>{
    const admin=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});
    if(admin.error||admin.data!==true)throw new Error('Somente administrador pode ativar acesso.');
    const identity=await context.supabase.from('operational_identities').select('id,auth_user_id').eq('id',data.id).single();
    if(identity.error)throw identity.error;
    if(identity.data.auth_user_id)throw new Error('Cadastro já possui acesso; não será criada outra conta.');
    const table=data.kind==='driver'?'drivers':'clients';
    const record=await context.supabase.from(table).select('full_name').eq('user_id',data.id).single();
    if(record.error)throw record.error;
    const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');
    // Administrative provisioning uses a real email; phone remains unverified contact data.
    // Explicit UUID retains all operational relationships and prevents a second registry.
    const created=await db.auth.admin.createUser({id:data.id,email:data.email,password:data.password,email_confirm:true,user_metadata:{full_name:record.data.full_name}});
    if(created.error||!created.data.user)throw new Error(created.error?.message??'Não foi possível ativar acesso.');
    if(created.data.user.id!==data.id)throw new Error('Identificador inesperado; acesso não associado.');
    const role=await db.from('user_roles').insert({user_id:data.id,role:data.kind});
    if(role.error) {
      // Keep registry untouched; remove only the account just provisioned.
      await db.auth.admin.deleteUser(data.id);
      throw new Error('Não foi possível associar perfil de acesso.');
    }
    const linked=await db.from('operational_identities').update({auth_user_id:data.id}).eq('id',data.id).is('auth_user_id',null).select('id').single();
    if(linked.error)throw new Error('Conta criada; associação incompleta. Consulte administrador antes de tentar novamente.');
    return {ok:true};
  });