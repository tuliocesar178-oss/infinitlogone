import { lazy,Suspense,useEffect,useRef,useState } from 'react';
import { ClientOnly } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { MapPin,Search,Loader2,Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { searchFreightAddress } from '@/lib/addresses/geocoding.functions';
import { addressQuery,changeAddress,chooseSuggestion,type FreightAddress } from '@/lib/addresses/model';
const PointMap=lazy(()=>import('./point-map'));
export interface AddressFieldsProps { label:string; value:FreightAddress; onChange:(value:FreightAddress)=>void; }
export function AddressFields({label,value,onChange}:AddressFieldsProps){
 const search=useServerFn(searchFreightAddress);
 const [query,setQuery]=useState(''),[debounced,setDebounced]=useState(''),[showMap,setShowMap]=useState(false),[checking,setChecking]=useState(false),[error,setError]=useState<string|null>(null);
 const latest=useRef(value);latest.current=value;
 useEffect(()=>{const timer=setTimeout(()=>setDebounced(query.trim()),450);return()=>clearTimeout(timer);},[query]);
 const suggestions=useQuery({queryKey:['freight-address-search',debounced],queryFn:()=>search({data:{query:debounced}}),enabled:debounced.length>=3,staleTime:60000,retry:false});
 const update=(patch:Partial<FreightAddress>)=>{setError(null);onChange(changeAddress(value,patch));};
 async function verify(){
  const snapshot=addressQuery(value);setChecking(true);setError(null);
  try{const results=await search({data:{query:snapshot}});if(snapshot!==addressQuery(latest.current))return;const found=results.find(s=>s.exact&&s.number.toLowerCase()===value.number.toLowerCase()&&s.city.toLocaleLowerCase()===value.city.toLocaleLowerCase()&&s.state===value.state)??results[0];
   if(!found){setError('Endereço não encontrado. Confirme o ponto no mapa.');setShowMap(true);return;}
   const next=chooseSuggestion(value,found);onChange(next);if(next.precision!=='address'){setError('Mapbox não confirmou o número do imóvel. Posição aproximada: confirme o ponto no mapa.');setShowMap(true);}
  }catch(e){setError(e instanceof Error?e.message:'Falha ao pesquisar endereço.');}finally{setChecking(false);}
 }
 const fields: {key:'zip'|'street'|'number'|'complement'|'neighborhood'|'city'|'state'|'reference';label:string}[]=[{key:'zip',label:'CEP'},{key:'street',label:'Rua ou avenida'},{key:'number',label:'Número do imóvel'},{key:'complement',label:'Complemento (opcional)'},{key:'neighborhood',label:'Bairro'},{key:'city',label:'Cidade'},{key:'state',label:'UF'},{key:'reference',label:'Referência (opcional)'}];
 return <fieldset className="space-y-4 min-w-0"><legend className="mb-3 font-semibold">{label}</legend>
  <label className="block text-sm space-y-1"><span>Pesquisar endereço completo</span><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><Input className="pl-9" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rua, número, cidade e UF"/></div></label>
  {suggestions.isFetching&&<Loader2 className="h-4 w-4 animate-spin"/>}{suggestions.error&&<p role="alert" className="text-sm text-destructive">{suggestions.error.message}</p>}
  {query.length>=3&&suggestions.data&&<div className="divide-y divide-border border border-border rounded-lg">{suggestions.data.map(s=><Button key={s.id} type="button" variant="ghost" className="h-auto w-full justify-start whitespace-normal text-left py-3" onClick={()=>{onChange(chooseSuggestion(value,s));setQuery('');setDebounced('');}}><MapPin className="shrink-0"/><span>{s.label}</span></Button>)}{!suggestions.data.length&&<p className="p-3 text-sm text-muted-foreground">Endereço não encontrado.</p>}</div>}
  <div className="grid gap-3 sm:grid-cols-2">{fields.map(f=><label key={f.key} className="block text-sm space-y-1"><span>{f.label}</span><Input value={value[f.key]} disabled={f.key==='number'&&value.noNumber} required={['street','city','state'].includes(f.key)||(f.key==='number'&&!value.noNumber)} maxLength={f.key==='state'?2:undefined} onChange={e=>update({[f.key]:f.key==='state'?e.target.value.toUpperCase():e.target.value})}/></label>)}</div>
  <label className="flex items-center gap-2 text-sm"><Checkbox checked={value.noNumber} onCheckedChange={v=>update({noNumber:v===true,number:v===true?'':value.number})}/>Sem número</label>
  <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={checking||!value.street||!value.city||!value.state||(!value.number&&!value.noNumber)} onClick={verify}>{checking?<Loader2 className="animate-spin"/>:<Search/>}Validar endereço completo</Button><Button type="button" variant="outline" onClick={()=>setShowMap(v=>!v)}><MapPin/>Ajustar ponto no mapa</Button></div>
  <p role="status" className="text-sm text-muted-foreground">{value.precision==='address'?'Imóvel localizado pelo Mapbox.':value.precision==='manual'?'Ponto confirmado manualmente.':value.precision==='approximate'?'Localização aproximada — imóvel não confirmado.':'Localização ainda não confirmada.'}</p>
  {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
  {showMap&&<div className="space-y-2"><ClientOnly><Suspense fallback={<div className="h-72 bg-muted"/>}><PointMap lat={value.lat} lng={value.lng} onPoint={(lat,lng)=>onChange({...value,lat,lng,precision:'approximate'})}/></Suspense></ClientOnly><Button type="button" disabled={value.lat==null||value.lng==null} onClick={()=>{onChange({...value,precision:'manual'});setError(null);}}><Check/>Confirmar este ponto</Button>{value.lat!=null&&value.lng!=null&&<p className="text-xs text-muted-foreground">{value.lat.toFixed(6)}, {value.lng.toFixed(6)}</p>}</div>}
 </fieldset>;
}
