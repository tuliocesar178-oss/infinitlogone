import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Pencil,Save,Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog,DialogContent,DialogTitle,DialogHeader } from '@/components/ui/dialog';
import { AddressFields } from './address-fields';
import { addressSchema,emptyAddress,type FreightAddress } from '@/lib/addresses/model';
import { updateFreightAddresses } from '@/lib/addresses/update.functions';
import type { Database } from '@/integrations/supabase/types';
type Order=Database['public']['Tables']['orders']['Row'];
export interface EditAddressesProps { order:Order; }
function readAddress(order:Order,type:'origin'|'destination'):FreightAddress {
 const parsed=addressSchema.safeParse(order[`${type}_location_details`]);if(parsed.success)return parsed.data;
 return {...emptyAddress,street:order[`${type}_address`],number:order[`${type}_number`]??'',city:order[`${type}_city`]??'',state:order[`${type}_state`]??'',zip:order[`${type}_zip`]??'',neighborhood:order[`${type}_neighborhood`]??'',lat:order[`${type}_lat`],lng:order[`${type}_lng`],precision:'approximate',reference:(type==='origin'?order.pickup_reference:order.delivery_reference)??''};
}
export function EditAddresses({order}:EditAddressesProps){
 const [open,setOpen]=useState(false),[saving,setSaving]=useState(false),[origin,setOrigin]=useState(()=>readAddress(order,'origin')),[destination,setDestination]=useState(()=>readAddress(order,'destination'));
 const update=useServerFn(updateFreightAddresses),cache=useQueryClient();
 async function save(){setSaving(true);try{const result=await update({data:{orderId:order.id,origin,destination}});await cache.invalidateQueries();if(result.routeError)toast.warning(`Endereços salvos, mas a rota não foi calculada: ${result.routeError}`);else toast.success('Endereços salvos e rota recalculada.');setOpen(false);}catch(e){toast.error(e instanceof Error?e.message:'Falha ao salvar.');}finally{setSaving(false);}}
 return <><Button variant="outline" onClick={()=>{setOrigin(readAddress(order,'origin'));setDestination(readAddress(order,'destination'));setOpen(true);}}><Pencil/>Editar endereços</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Endereços do frete</DialogTitle></DialogHeader><AddressFields label="Coleta" value={origin} onChange={setOrigin}/><AddressFields label="Entrega" value={destination} onChange={setDestination}/><Button onClick={save} disabled={saving}>{saving?<Loader2 className="animate-spin"/>:<Save/>}Salvar endereços</Button></DialogContent></Dialog></>;
}
