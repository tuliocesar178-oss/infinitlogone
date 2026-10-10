import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { addressSchema,addressError,fullAddress } from './model';
import type { Database } from '@/integrations/supabase/types';
export const updateFreightAddresses=createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
 .inputValidator(input=>z.object({orderId:z.string().uuid(),origin:addressSchema,destination:addressSchema}).parse(input))
 .handler(async({data,context})=>{
  const {data:roles,error:roleError}=await context.supabase.from('user_roles').select('role').eq('user_id',context.userId);
  if(roleError)throw roleError;
  if(!roles?.some(r=>['admin','supervisor','logistics','operacional','comercial'].includes(r.role)))throw new Error('Sem permissão para editar endereços.');
  for(const a of [data.origin,data.destination]){const e=addressError(a);if(e)throw new Error(e);}
  const a=data.origin,b=data.destination;
  const patch: Database['public']['Tables']['orders']['Update']={
   origin_address:fullAddress(a),origin_number:a.number||null,origin_city:a.city,origin_state:a.state,origin_zip:a.zip||null,origin_neighborhood:a.neighborhood||null,origin_lat:a.lat,origin_lng:a.lng,origin_location_details:a,pickup_reference:a.reference||null,
   destination_address:fullAddress(b),destination_number:b.number||null,destination_city:b.city,destination_state:b.state,destination_zip:b.zip||null,destination_neighborhood:b.neighborhood||null,destination_lat:b.lat,destination_lng:b.lng,destination_location_details:b,delivery_reference:b.reference||null,
  };
  const {data:updated,error}=await context.supabase.from('orders').update(patch).eq('id',data.orderId).select('id,origin_address,destination_address,origin_lat,origin_lng,destination_lat,destination_lng').single();
  if(error)throw new Error(`Não foi possível salvar os endereços: ${error.message}`);
  return updated;
 });
