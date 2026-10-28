import {useState} from 'react';
import {useServerFn} from '@tanstack/react-start';
import {toast} from 'sonner';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {RegistrationField} from './registration-fields';
import {activateRegistration} from '@/lib/registration-access.functions';

export interface RegistrationAccessProps {id:string;kind:'driver'|'client'}
export function RegistrationAccess({id,kind}:RegistrationAccessProps){
  const [open,setOpen]=useState(false);const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [saving,setSaving]=useState(false);
  const activate=useServerFn(activateRegistration);
  return <><Button variant="outline" onClick={()=>setOpen(true)}>Ativar acesso</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent>
    <DialogTitle>Ativação administrativa</DialogTitle><DialogDescription>Use um e-mail real para acesso por senha. O telefone continua não verificado. Para cadastro sem e-mail, o acesso por telefone sem confirmação ainda não está disponível.</DialogDescription>
    <form className="space-y-4" onSubmit={async e=>{e.preventDefault();setSaving(true);try{await activate({data:{id,kind,email,password}});setPassword('');setOpen(false);toast.success('Acesso associado ao cadastro existente.');}catch(error){toast.error(error instanceof Error?error.message:'Não foi possível ativar.');}finally{setPassword('');setSaving(false);}}}>
      <RegistrationField label="E-mail real" type="email" required value={email} onChange={e=>setEmail(e.target.value)}/>
      <RegistrationField label="Senha inicial" type="password" autoComplete="new-password" minLength={12} required value={password} onChange={e=>setPassword(e.target.value)}/>
      <Button type="submit" disabled={saving}>{saving?'Ativando…':'Criar acesso neste cadastro'}</Button>
    </form>
  </DialogContent></Dialog></>;
}