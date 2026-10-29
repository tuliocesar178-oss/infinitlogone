import {useState} from 'react';
import {useServerFn} from '@tanstack/react-start';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {toast} from 'sonner';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {RegistrationField} from './registration-fields';
import {PasswordField} from './password-field';
import {activateRegistration} from '@/lib/registration-access.functions';
import {passwordPairError} from '@/lib/access-credentials';
import {supabase} from '@/integrations/supabase/client';

export interface RegistrationAccessProps {id:string;kind:'driver'|'client'}
/** Shows whether the registration has an Auth account and lets staff create one (never replaces an existing one). */
export function RegistrationAccess({id,kind}:RegistrationAccessProps){
  const qc=useQueryClient();
  const status=useQuery({queryKey:['registration-access',id],queryFn:async()=>{
    const r=await supabase.from('operational_identities').select('auth_user_id').eq('id',id).maybeSingle();
    if(r.error)throw r.error;return Boolean(r.data?.auth_user_id);
  }});
  const [open,setOpen]=useState(false);const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [confirm,setConfirm]=useState('');const [saving,setSaving]=useState(false);const [error,setError]=useState<string|null>(null);
  const activate=useServerFn(activateRegistration);
  if(status.isLoading)return <span className="self-center text-xs text-muted-foreground">Verificando acesso…</span>;
  if(status.data)return <span className="self-center rounded-full bg-success/15 px-3 py-1 text-xs text-success">Conta de acesso criada</span>;
  return <><Button variant="outline" onClick={()=>setOpen(true)}>Criar acesso ao app</Button><Dialog open={open} onOpenChange={v=>{if(!saving)setOpen(v);}}><DialogContent>
    <DialogTitle>Criar acesso ao app</DialogTitle><DialogDescription>{kind==='driver'?'O motorista entrará com o telefone do cadastro e esta senha. E-mail é opcional; nenhum SMS é enviado. A aprovação para fretes continua separada.':'Defina e-mail (opcional) e senha inicial.'}</DialogDescription>
    <form className="space-y-4" onSubmit={async e=>{e.preventDefault();const problem=passwordPairError(password,confirm);if(problem){setError(problem);return;}setError(null);setSaving(true);try{const r=await activate({data:{id,kind,email,password}});setOpen(false);await qc.invalidateQueries({queryKey:['registration-access',id]});toast.success(r.login_method==='phone'?'Acesso criado: entrar com telefone e senha.':'Acesso criado: entrar com e-mail e senha.');}catch(err){setError(err instanceof Error?err.message:'Não foi possível criar o acesso.');}finally{setPassword('');setConfirm('');setSaving(false);}}}>
      {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
      <RegistrationField label="E-mail para login (opcional)" type="email" value={email} onChange={e=>setEmail(e.target.value)}/>
      <PasswordField label="Senha de acesso" autoComplete="new-password" required value={password} onChange={e=>setPassword(e.target.value)}/>
      <PasswordField label="Confirmar senha" autoComplete="new-password" required value={confirm} onChange={e=>setConfirm(e.target.value)}/>
      <Button type="submit" disabled={saving}>{saving?'Criando…':'Criar acesso neste cadastro'}</Button>
    </form>
  </DialogContent></Dialog></>;
}
