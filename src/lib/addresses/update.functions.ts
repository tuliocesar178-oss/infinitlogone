import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { addressSchema,addressError,fullAddress } from './model';
export const updateFreightAddresses=createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
 .inputValidator(input=>z.object({orderId:z.string().uuid(),origin:addressSchema,destination:addressSchema}).parse(input))
 .handler(async({data,context})=>{
  const {data:roles,error:roleError}=await context.supabase.from('user_roles').select('role').eq('user_id',context.userId);
  if(roleError)throw roleError;
  if(!roles?.some(r=>['admin','supervisor','logistics','operacional','comercial'].includes(r.role)))throw new Error('Sem permissão para editar endereços.');
  for(const a of [data.origin,data.destination]){const e=addressError(a);if(e)throw new Error(e);}
  const patch: Record<string,string|number|null|z.infer<typeof addressSchema>>={};
  for(const [type,a] of [['origin',data.origin],['destination',data.destination]] as const){
   patch[`${type}_address`]=fullAddress(a);patch[`${type}_number`]=a.number||null;patch[`${type}_city`]=a.city;patch[`${type}_state`]=a.state;patch[`${type}_zip`]=a.zip||null;patch[`${type}_neighborhood`]=a.neighborhood||null;patch[`${type}_lat`]=a.lat;patch[`${type}_lng`]=a.lng;patch[`${type}_location_details`]=a;patch[type==='origin'?'pickup_reference':'delivery_reference']=a.reference||null;
  }
  const {data:updated,error}=await context.supabase.from('orders').update(patch).eq('id',data.orderId).select('id,origin_address,destination_address,origin_lat,origin_lng,destination_lat,destination_lng').single();
  if(error)throw new Error(`Não foi possível salvar os endereços: ${error.message}`);
  return updated;
 });
