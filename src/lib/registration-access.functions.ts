import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { accessPasswordSchema, phoneLoginEmail } from './access-credentials';

/**
 * Creates the Auth account for an existing operational registration, reusing its UUID so
 * every order/work/RLS relationship stays intact. Drivers: any staff; clients: admin only.
 * Only the registration's own role (driver/client) is granted; approval status is untouched.
 * An existing account is never replaced and its password is never reset here.
 */
export const activateRegistration = createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
  .inputValidator(z.object({id:z.string().uuid(),kind:z.enum(['driver','client']),email:z.union([z.literal(''),z.string().trim().email()]).default(''),password:accessPasswordSchema}))
  .handler(async({data,context})=>{
    const allowed=data.kind==='driver'
      ? await context.supabase.rpc('is_staff',{_user_id:context.userId})
      : await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});
    if(allowed.error||allowed.data!==true)throw new Error(data.kind==='driver'?'Somente a equipe operacional pode criar o acesso do motorista.':'Somente administrador pode ativar acesso de cliente.');
    const identity=await context.supabase.from('operational_identities').select('id,auth_user_id').eq('id',data.id).single();
    if(identity.error)throw new Error('Cadastro não encontrado.');
    if(identity.data.auth_user_id)throw new Error('Este cadastro já possui conta de acesso; nenhuma outra conta foi criada.');
    const record=data.kind==='driver'
      ? await context.supabase.from('drivers').select('full_name,phone').eq('user_id',data.id).single()
      : await context.supabase.from('clients').select('full_name,phone:contact_phone').eq('user_id',data.id).single();
    if(record.error)throw new Error('Cadastro não encontrado.');
    let login=data.email.toLowerCase();
    if(!login){
      try{login=phoneLoginEmail(record.data.phone??'');}
      catch{throw new Error('Informe um telefone válido no cadastro (ou um e-mail) para criar o acesso.');}
    }
    const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');
    const claim=crypto.randomUUID();
    const claimed=await db.rpc('claim_registration_activation',{_id:data.id,_claim:claim});
    if(claimed.error||!claimed.data)throw new Error('Ativação já iniciada por outra pessoa; atualize a página.');
    let createdId:string|null=null;
    try{
      // email_confirm only applies to the reserved phone domain or a staff-provided address; no SMS/e-mail is sent.
      const created=await db.auth.admin.createUser({id:data.id,email:login,password:data.password,email_confirm:true,user_metadata:{full_name:record.data.full_name,phone:record.data.phone,login_method:data.email?'email':'phone'}});
      if(created.error||!created.data.user){
        const msg=created.error?.message??'';
        throw new Error(/already|registered|exists/i.test(msg)?'Já existe uma conta com este telefone/e-mail. Nenhuma conta duplicada foi criada.':'Não foi possível criar o acesso.');
      }
      createdId=created.data.user.id;
      if(createdId!==data.id)throw new Error('Identificador inesperado; acesso não associado.');
      const linked=await db.rpc('complete_registration_activation',{_id:data.id,_claim:claim,_kind:data.kind});
      if(linked.error)throw new Error('Falha na associação do acesso.');
      await db.from('activity_log').insert({actor_id:context.userId,action:'registration_access_activated',entity_type:data.kind,entity_id:data.id,metadata:{method:data.email?'email':'phone'}});
    }catch(error){
      if(createdId){
        const removed=await db.auth.admin.deleteUser(createdId);
        if(removed.error)throw new Error('Ativação incompleta; revisão administrativa necessária antes de tentar novamente.');
      }
      await db.from('operational_identities').update({activation_claim:null,activation_started_at:null}).eq('id',data.id).eq('activation_claim',claim);
      throw error;
    }
    return {ok:true,login_method:data.email?'email' as const:'phone' as const};
  });

/** Public driver self-signup without e-mail/SMS: creates a pending driver (no role until approval, as before). */
export const selfRegisterDriver = createServerFn({method:'POST'})
  .inputValidator(z.object({phone:z.string().min(8).max(30),email:z.union([z.literal(''),z.string().trim().email()]).default(''),password:accessPasswordSchema,metadata:z.record(z.string(),z.string().max(300).nullable())}))
  .handler(async({data})=>{
    let login:string;
    try{login=data.email?data.email.toLowerCase():phoneLoginEmail(data.phone);}catch{throw new Error('Informe telefone brasileiro com DDD.');}
    const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');
    const created=await db.auth.admin.createUser({email:login,password:data.password,email_confirm:true,user_metadata:{...data.metadata,phone:data.phone,driver_signup:true,login_method:data.email?'email':'phone'}});
    if(created.error||!created.data.user){
      const msg=created.error?.message??'';
      throw new Error(/already|registered|exists/i.test(msg)?'Já existe uma conta com este telefone/e-mail. Use "Entrar".':'Não foi possível criar o cadastro.');
    }
    return {login};
  });
