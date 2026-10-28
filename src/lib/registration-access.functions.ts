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
    const claim=crypto.randomUUID();
    const claimed=await db.rpc('claim_registration_activation',{_id:data.id,_claim:claim});
    if(claimed.error||!claimed.data)throw new Error('Ativação já iniciada; consulte o administrador.');
    // Administrative provisioning uses a real email; phone remains unverified contact data.
    // Explicit UUID retains all operational relationships and prevents a second registry.
    let createdId:string|null=null;
    try{
      const created=await db.auth.admin.createUser({id:data.id,email:data.email,password:data.password,email_confirm:true,user_metadata:{full_name:record.data.full_name}});
      if(created.error||!created.data.user)throw new Error(created.error?.message??'Não foi possível ativar acesso.');
      createdId=created.data.user.id;
      if(createdId!==data.id)throw new Error('Identificador inesperado; acesso não associado.');
      const linked=await db.rpc('complete_registration_activation',{_id:data.id,_claim:claim,_kind:data.kind});
      if(linked.error)throw new Error('Falha na associação do acesso.');
    }catch(error){
      if(createdId){
        const removed=await db.auth.admin.deleteUser(createdId);
        if(removed.error)throw new Error('Ativação incompleta; revisão administrativa necessária antes de tentar novamente.');
      }
      await db.from('operational_identities').update({activation_claim:null,activation_started_at:null}).eq('id',data.id).eq('activation_claim',claim);
      throw error;
    }
    return {ok:true};
  });