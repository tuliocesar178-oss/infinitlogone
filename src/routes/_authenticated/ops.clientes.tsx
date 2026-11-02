import {createFileRoute} from '@tanstack/react-router';
import {useState} from 'react';
import {useSuspenseQuery,useQueryClient,queryOptions} from '@tanstack/react-query';
import {useServerFn} from '@tanstack/react-start';
import {Plus,Search,Pencil} from 'lucide-react';
import {toast} from 'sonner';
import {supabase} from '@/integrations/supabase/client';
import {AppShell} from '@/components/app-shell';
import {Button} from '@/components/ui/button';
import {CompletenessNotice} from '@/components/ops/completeness-notice';
import {Input} from '@/components/ui/input';
import {RegistrationDialog} from '@/components/ops/registration-dialog';
import {RegistrationAccess} from '@/components/ops/registration-access';
import {registrationPermissions,setClientRegistrationStatus} from '@/lib/registration.functions';
import type {Tables} from '@/integrations/supabase/types';

const options=queryOptions({queryKey:['registered-clients'],queryFn:async()=>{
  const [clients,permissions]=await Promise.all([supabase.from('clients').select('*').is('deleted_at',null).order('company_name'),registrationPermissions()]);
  if(clients.error)throw clients.error;return {clients:clients.data??[],...permissions};
},staleTime:15000});
export const Route=createFileRoute('/_authenticated/ops/clientes')({
  head:()=>({meta:[
      { name: "description", content: 'Clientes — INFINITLOG VAPT VUPT. Informações e acompanhamento na plataforma INFINITLOG VAPT VUPT.' },{title:'Clientes — INFINITLOG VAPT VUPT'},{name:'description',content:'Cadastro operacional de clientes, contatos e acessos da INFINITLOG.'},{property:'og:title',content:'Clientes — INFINITLOG VAPT VUPT'},{property:'og:description',content:'Clientes e contatos operacionais.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'},{name:'robots',content:'noindex'}]}),
  loader:({context})=>context.queryClient.ensureQueryData(options),
  errorComponent:({error,reset})=><AppShell title="Clientes"><p>{error instanceof Error?error.message:'Não foi possível consultar clientes.'}</p><Button onClick={reset}>Tentar novamente</Button></AppShell>,
  component:ClientsPage,
});
function ClientsPage(){
  const {data}=useSuspenseQuery(options);const qc=useQueryClient();const change=useServerFn(setClientRegistrationStatus);
  const [search,setSearch]=useState('');const [open,setOpen]=useState(false);const [selected,setSelected]=useState<Tables<'clients'>|null>(null);
  const needle=search.toLowerCase();const rows=data.clients.filter(c=>`${c.full_name} ${c.company_name} ${c.document} ${c.contact_phone}`.toLowerCase().includes(needle)||Boolean(search.replace(/\D/g,'')&&c.contact_phone?.includes(search.replace(/\D/g,''))));
  return <AppShell title="Clientes" subtitle={`${rows.length} cadastros`} actions={<Button onClick={()=>{setSelected(null);setOpen(true);}}><Plus/>Cadastrar cliente</Button>}>
    <div className="relative mb-6 max-w-lg"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"/><Input className="pl-9" aria-label="Pesquisar clientes" placeholder="Nome, telefone, CPF ou CNPJ" value={search} onChange={e=>setSearch(e.target.value)}/></div>
    <div className="divide-y divide-border">{rows.map(c=><article key={c.user_id} className="flex flex-wrap items-center justify-between gap-4 py-5">
      <div className="min-w-0"><h2 className="break-words font-semibold">{c.company_name||c.full_name||"Nome pendente"}</h2><CompletenessNotice pending={c.completeness_pending}/><p className="text-sm text-muted-foreground">{c.contact_phone} · {c.document||'Sem documento'}</p><p className="text-xs text-muted-foreground">Telefone não verificado · {c.registration_status==='active'?'Aprovado':c.registration_status==='blocked'?'Bloqueado':'Pendente'}</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>{setSelected(c);setOpen(true);}}><Pencil/>Editar</Button>{data.isAdmin&&<><RegistrationAccess id={c.user_id} kind="client"/><select aria-label={`Situação de ${c.company_name}`} className="rounded-md border border-input bg-background px-2 text-sm" value={c.registration_status} onChange={async e=>{try{const status=e.target.value;if(status!=='pending'&&status!=='active'&&status!=='blocked')return;await change({data:{id:c.user_id,status}});await qc.invalidateQueries({queryKey:['registered-clients']});}catch(error){toast.error(error instanceof Error?error.message:'Falha ao alterar situação.');}}}><option value="pending">Pendente</option><option value="active">Aprovado</option><option value="blocked">Bloqueado</option></select></>}</div>
    </article>)}</div>{!rows.length&&<p className="py-10 text-muted-foreground">Nenhum cliente encontrado.</p>}
    {open&&<RegistrationDialog open onClose={()=>setOpen(false)} kind="client" initial={selected?{id:selected.user_id,full_name:selected.full_name??'',phone:selected.contact_phone??'',email:selected.contact_email??'',document:selected.document??'',company_name:selected.company_name??'',trade_name:selected.trade_name??'',customer_type:selected.customer_type==='pf'?'pf':'pj',address:selected.address??'',address_number:selected.address_number??'',neighborhood:selected.neighborhood??'',city:selected.city??'',state:selected.state??'',zip_code:selected.zip_code??'',notes:selected.notes??'',contact_name:selected.contact_name??'',contacts:Array.isArray(selected.contacts)?selected.contacts.flatMap(c=>c&&typeof c==='object'&&!Array.isArray(c)&&typeof c.phone==='string'?[{name:typeof c.name==='string'?c.name:'',phone:c.phone,email:typeof c.email==='string'?c.email:''}]:[]):[]}:undefined}/>}
  </AppShell>;
}