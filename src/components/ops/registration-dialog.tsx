import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Dialog,DialogContent,DialogTitle,DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RegistrationField } from './registration-fields';
import { makeRegistrationSchema,type RegistrationInput } from '@/lib/registration-model';
import { useTestMode } from '@/lib/test-mode';
import { TestModeNotice } from './completeness-notice';
import { saveOperationalRegistration } from '@/lib/registration.functions';
import {RegistrationPhoto} from './registration-photo';
import { PasswordField } from './password-field';
import { activateRegistration } from '@/lib/registration-access.functions';
import { passwordPairError } from '@/lib/access-credentials';

export interface RegistrationDialogProps {open:boolean;onClose:()=>void;kind:'driver'|'client';initial?:Partial<RegistrationInput>;onCreated?:(id:string)=>void}
export function RegistrationDialog({open,onClose,kind,initial,onCreated}:RegistrationDialogProps){
  const mode=useTestMode();
  const [form,setForm]=useState<RegistrationInput>({kind,full_name:'',phone:'',email:'',...initial});
  const [saving,setSaving]=useState(false);
  const [uploadId]=useState(()=>initial?.id??crypto.randomUUID());
  const [contactKeys,setContactKeys]=useState(()=>(initial?.contacts??[]).map(()=>crypto.randomUUID()));
  const [error,setError]=useState<string|null>(null);
  const save=useServerFn(saveOperationalRegistration);const activate=useServerFn(activateRegistration);
  const [password,setPassword]=useState('');const [confirm,setConfirm]=useState('');
  const createsAccess=kind==='driver'&&!initial?.id;const qc=useQueryClient();
  const set=(key:keyof RegistrationInput,value:string)=>setForm(current=>({...current,[key]:value}));
  async function submit(e:React.FormEvent){
    e.preventDefault();setError(null);
    if(createsAccess&&(password||confirm)){const problem=passwordPairError(password,confirm);if(problem){setError(problem);return;}}
    setSaving(true);
    try{
      const parsed=makeRegistrationSchema(mode.enabled).parse(form);const result=await save({data:parsed});
      await Promise.all([qc.invalidateQueries({queryKey:['drivers-list']}),qc.invalidateQueries({queryKey:['registered-clients']})]);
      if(createsAccess&&password){
        try{await activate({data:{id:result.user_id,kind:'driver',email:parsed.email??'',password}});toast.success(parsed.email?'Motorista cadastrado. Acesso: e-mail e senha.':'Motorista cadastrado. Acesso: telefone e senha.');}
        catch(err){toast.error('Cadastro salvo, mas o acesso não foi criado: '+(err instanceof Error?err.message:'erro')+' Use "Criar acesso ao app" no perfil.');}
      }else toast.success('Cadastro salvo. Telefone não verificado; nenhum SMS enviado.');onCreated?.(result.user_id);onClose();
    }catch(error){const message=error instanceof Error?error.message:'Não foi possível salvar.';setError(message);toast.error(message);}finally{setPassword('');setConfirm('');setSaving(false);}
  }
  const fields:Array<{key:keyof RegistrationInput;label:string;type?:string}>=kind==='driver' ? [
    {key:'birth_date',label:'Data de nascimento',type:'date'},{key:'license_number',label:'CNH'},
    {key:'license_category',label:'Categoria CNH'},{key:'cnh_expires_at',label:'Validade CNH',type:'date'},
    {key:'rntrc',label:'RNTRC / ANTT'},{key:'pix_key',label:'Chave PIX'},
    {key:'vehicle_type',label:'Tipo de veículo'},{key:'plate',label:'Placa'},
    {key:'brand',label:'Marca'},{key:'model',label:'Modelo'},
    {key:'year',label:'Ano',type:'number'},{key:'capacity_kg',label:'Capacidade (kg)',type:'number'},
    {key:'axles',label:'Eixos',type:'number'},
  ]:[{key:'company_name',label:'Razão social / nome'},{key:'trade_name',label:'Nome fantasia'},{key:'contact_name',label:'Responsável pelo contato'}];
  return <Dialog open={open} onOpenChange={v=>{if(!v&&!saving)onClose();}}><DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
    <DialogTitle>{initial?.id?'Editar':'Cadastrar'} {kind==='driver'?'motorista':'cliente'}</DialogTitle>
    <DialogDescription>Telefone não verificado · acesso cadastrado separadamente</DialogDescription>
    <TestModeNotice />
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      {error&&<p role="alert" className="text-sm text-destructive sm:col-span-2">{error}</p>}
      <RegistrationField label="Nome completo" required={!mode.enabled} value={form.full_name} onChange={e=>set('full_name',e.target.value)}/>
      <RegistrationField label="Telefone celular" required={!mode.enabled} type="tel" value={form.phone} onChange={e=>set('phone',e.target.value)}/>
      <RegistrationField label="E-mail (opcional)" type="email" value={form.email??''} onChange={e=>set('email',e.target.value)}/>
      <RegistrationField label={kind==='driver'?'CPF':'CPF / CNPJ'} value={form.document??''} onChange={e=>set('document',e.target.value)}/>
      {kind==='client'&&<label className="grid gap-1.5 text-sm">Tipo de cliente<select className="h-9 rounded-md border border-input bg-background px-3" value={form.customer_type??'pj'} onChange={e=>setForm(f=>({...f,customer_type:e.target.value==='pf'?'pf':'pj'}))}><option value="pf">Pessoa física</option><option value="pj">Pessoa jurídica</option></select></label>}
      {fields.map(f=><RegistrationField key={f.key} label={f.label} type={f.type??'text'} value={String(form[f.key]??'')} onChange={e=>set(f.key,e.target.value)}/>)}
      {createsAccess&&<section className="grid gap-4 rounded-xl border border-border p-3 sm:col-span-2 sm:grid-cols-2"><p className="text-sm text-muted-foreground sm:col-span-2">Acesso ao app: o motorista entra com o telefone acima (ou e-mail, se informado) e esta senha. Sem SMS. Deixe em branco para criar o acesso depois.</p>
        <PasswordField label="Senha de acesso" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/>
        <PasswordField label="Confirmar senha" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)}/></section>}
      {kind==='driver'&&<><RegistrationPhoto label="Foto do motorista" identityId={uploadId} onSaved={url=>set('photo_url',url)}/><RegistrationPhoto label="Foto do veículo" identityId={uploadId} onSaved={url=>set('vehicle_photo_url',url)}/></>}
      {([{key:'address',label:'Endereço'},{key:'address_number',label:'Número'},{key:'neighborhood',label:'Bairro'},{key:'city',label:'Cidade'},{key:'state',label:'UF'},{key:'zip_code',label:'CEP'}] as const).map(f=><RegistrationField key={f.key} label={f.label} value={String(form[f.key]??'')} onChange={e=>set(f.key,e.target.value)}/>)}
      <label className="grid gap-1.5 text-sm sm:col-span-2">Observações internas<textarea className="min-h-20 rounded-md border border-input bg-background p-3" value={form.notes??''} onChange={e=>set('notes',e.target.value)}/></label>
      {kind==='client'&&<section className="space-y-3 sm:col-span-2"><h3 className="font-medium">Contatos adicionais</h3>
        {(form.contacts??[]).map((contact,index)=><div key={contactKeys[index]} className="grid gap-2 sm:grid-cols-3"><RegistrationField label="Nome do contato" value={contact.name} onChange={e=>setForm(f=>({...f,contacts:(f.contacts??[]).map((c,i)=>i===index?{...c,name:e.target.value}:c)}))}/><RegistrationField label="Telefone do contato" type="tel" required={!mode.enabled} value={contact.phone} onChange={e=>setForm(f=>({...f,contacts:(f.contacts??[]).map((c,i)=>i===index?{...c,phone:e.target.value}:c)}))}/><Button type="button" variant="outline" onClick={()=>{setForm(f=>({...f,contacts:(f.contacts??[]).filter((_,i)=>i!==index)}));setContactKeys(keys=>keys.filter((_,i)=>i!==index));}}>Remover contato</Button></div>)}
        <Button type="button" variant="outline" onClick={()=>{setForm(f=>({...f,contacts:[...(f.contacts??[]),{name:'',phone:'',email:''}]}));setContactKeys(keys=>[...keys,crypto.randomUUID()]);}}>Adicionar contato</Button>
      </section>}
      <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" disabled={saving} onClick={onClose}>Cancelar</Button><Button type="submit" disabled={saving}>{saving?'Salvando…':'Salvar cadastro'}</Button></div>
    </form>
  </DialogContent></Dialog>;
}