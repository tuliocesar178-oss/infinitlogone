import { lazy,Suspense,useEffect,useRef,useState } from 'react';
import { ClientOnly } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { MapPin,Search,Loader2,Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { searchFreightAddress } from '@/lib/addresses/geocoding.functions';
import { useTestMode } from '@/lib/test-mode';
import { changeAddress,chooseSuggestion,formatZip,zipWarning,type FreightAddress } from '@/lib/addresses/model';
import { locationSourceLabel } from '@/lib/addresses/auto-location';
import { useAutoLocation } from './use-auto-location';
const PointMap=lazy(()=>import('./point-map'));
export interface AddressFieldsProps { label:string; value:FreightAddress; onChange:(value:FreightAddress)=>void; }
export function AddressFields({label,value,onChange}:AddressFieldsProps){
 const mode=useTestMode();
 const search=useServerFn(searchFreightAddress);
 const [query,setQuery]=useState(''),[debounced,setDebounced]=useState('');
 const {checking,error,located,showMap,setShowMap,cancel,verify}=useAutoLocation(value,onChange);
 const latest=useRef(value);latest.current=value;
 const warning=zipWarning(value.zip);
 useEffect(()=>{const timer=setTimeout(()=>setDebounced(query.trim()),450);return()=>clearTimeout(timer);},[query]);
 const suggestions=useQuery({queryKey:['freight-address-search',debounced],queryFn:()=>search({data:{query:debounced}}),enabled:debounced.length>=3,staleTime:60000,retry:false});
 const update=(patch:Partial<FreightAddress>)=>{cancel();onChange(changeAddress(value,patch));};
 const fields: {key:'zip'|'street'|'number'|'complement'|'neighborhood'|'city'|'state'|'reference';label:string}[]=[{key:'zip',label:'CEP'},{key:'street',label:'Rua ou avenida'},{key:'number',label:'Número do imóvel'},{key:'complement',label:'Complemento (opcional)'},{key:'neighborhood',label:'Bairro'},{key:'city',label:'Cidade'},{key:'state',label:'UF'},{key:'reference',label:'Referência (opcional)'}];
 return <fieldset className="space-y-4 min-w-0"><legend className="mb-3 font-semibold">{label}</legend>
  <label className="block text-sm space-y-1"><span>Pesquisar endereço completo</span><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><Input className="pl-9" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rua, número, cidade e UF"/></div></label>
  {suggestions.isFetching&&<Loader2 className="h-4 w-4 animate-spin"/>}{suggestions.error&&<p role="alert" className="text-sm text-destructive">{suggestions.error.message}</p>}
  {query.trim()===debounced&&query.length>=3&&suggestions.data&&<div className="divide-y divide-border border border-border rounded-lg">{suggestions.data.map(s=><Button key={s.id} type="button" variant="ghost" className="h-auto w-full justify-start whitespace-normal text-left py-3" onClick={()=>{cancel();onChange(chooseSuggestion(latest.current,s));setShowMap(true);setQuery('');setDebounced('');}}><MapPin className="shrink-0"/><span>{s.label}</span></Button>)}{!suggestions.data.length&&<p className="p-3 text-sm text-muted-foreground">Endereço ou CEP não reconhecido. Preencha manualmente e confirme o ponto no mapa.</p>}</div>}
  <div className="grid gap-3 sm:grid-cols-2">{fields.map(f=><label key={f.key} className="block text-sm space-y-1"><span>{f.label}</span><Input value={value[f.key]} inputMode={f.key==='zip'?'numeric':undefined} placeholder={f.key==='zip'?'00000-000':undefined} disabled={f.key==='number'&&value.noNumber} required={!mode.enabled && (['street','city','state'].includes(f.key)||(f.key==='number'&&!value.noNumber))} maxLength={f.key==='state'?2:undefined} onChange={e=>update({[f.key]:f.key==='state'?e.target.value.toUpperCase():f.key==='zip'?formatZip(e.target.value):e.target.value})}/></label>)}</div>
  {warning&&<p role="status" className="text-sm text-muted-foreground">{warning}</p>}
  <label className="flex items-center gap-2 text-sm"><Checkbox checked={value.noNumber} onCheckedChange={v=>update({noNumber:v===true,number:v===true?'':value.number})}/>Sem número</label>
  <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={checking||!value.street||!value.city||!value.state||(!value.number&&!value.noNumber)} onClick={verify}>{checking?<Loader2 className="animate-spin"/>:<Search/>}Validar endereço completo</Button><Button type="button" variant="outline" onClick={()=>setShowMap(v=>!v)}><MapPin/>Ajustar ponto no mapa</Button></div>
  <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{checking?'Localizando endereço...':value.precision==='address'?'Endereço exato localizado.':value.precision==='manual'?'Ponto confirmado manualmente.':value.precision==='approximate'?`${located?locationSourceLabel[located.source]:'Localização aproximada encontrada'} — confirme o ponto no mapa.`:'Localização ainda não confirmada.'}</p>
  {located&&<p className="text-xs text-muted-foreground">Endereço pesquisado: {located.query}</p>}
  {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
  {showMap&&<div className="space-y-2"><ClientOnly><Suspense fallback={<div className="h-72 bg-muted"/>}><PointMap lat={value.lat} lng={value.lng} zoom={located?.source==='city'?13:located?.source==='neighborhood'||located?.source==='postcode'?15:17} onPoint={(lat,lng)=>{cancel();onChange({...latest.current,lat,lng,precision:'approximate'});}}/></Suspense></ClientOnly><Button type="button" disabled={value.lat==null||value.lng==null} onClick={()=>{if(latest.current.lat==null||latest.current.lng==null)return;cancel();onChange({...latest.current,precision:'manual'});}}><Check/>Confirmar localização</Button>{value.lat!=null&&value.lng!=null&&<p className="text-xs text-muted-foreground">{value.lat.toFixed(6)}, {value.lng.toFixed(6)}</p>}</div>}
 </fieldset>;
}
