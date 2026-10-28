import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { testModeStateSchema } from '@/lib/test-mode';
import { addressSchema,addressError,fullAddress } from './model';
import type { Database } from '@/integrations/supabase/types';
export const updateFreightAddresses=createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
 .inputValidator(input=>z.object({orderId:z.string().uuid(),origin:addressSchema,destination:addressSchema}).parse(input))
 .handler(async({data,context})=>{
  const {data:roles,error:roleError}=await context.supabase.from('user_roles').select('role').eq('user_id',context.userId);
  if(roleError)throw roleError;
  if(!roles?.some(r=>['admin','supervisor','logistics','operacional','comercial'].includes(r.role)))throw new Error('Sem permissão para editar endereços.');
  const mode=await context.supabase.rpc('get_test_mode');
  if(mode.error)throw new Error('Não foi possível conferir as exigências.');
  if(!testModeStateSchema.parse(mode.data).enabled) for(const a of [data.origin,data.destination]){const e=addressError(a);if(e)throw new Error(e);}
  const a=data.origin,b=data.destination;
  const patch: Database['public']['Tables']['orders']['Update']={
   origin_address:fullAddress(a),origin_number:a.number||null,origin_city:a.city,origin_state:a.state,origin_zip:a.zip||null,origin_neighborhood:a.neighborhood||null,origin_lat:a.lat,origin_lng:a.lng,origin_location_details:a,pickup_reference:a.reference||null,
   destination_address:fullAddress(b),destination_number:b.number||null,destination_city:b.city,destination_state:b.state,destination_zip:b.zip||null,destination_neighborhood:b.neighborhood||null,destination_lat:b.lat,destination_lng:b.lng,destination_location_details:b,delivery_reference:b.reference||null,
  };
  const {data:updated,error}=await context.supabase.from('orders').update(patch).eq('id',data.orderId).select('id,origin_address,destination_address,origin_lat,origin_lng,destination_lat,destination_lng').single();
  if(error)throw new Error(`Não foi possível salvar os endereços: ${error.message}`);
  // Address changes first invalidate the old snapshot in the existing trigger.
  const { calculateConfirmedRoute } = await import('./route.server');
  let routeError: string | null = null;
  try {
   if(a.lat==null||a.lng==null||b.lat==null||b.lng==null)throw new Error('Confirme ambos os pontos.');
   const route=await calculateConfirmedRoute({fromLat:a.lat,fromLng:a.lng,toLat:b.lat,toLng:b.lng},process.env['MAPBOX_API_KEY'],process.env['LOVABLE_API_KEY']);
   const saved=await context.supabase.from('orders').update({route_geometry:JSON.stringify(route.geometry),distance_km:route.distance,estimated_minutes:route.duration}).eq('id',data.orderId).eq('origin_lat',a.lat).eq('origin_lng',a.lng).eq('destination_lat',b.lat).eq('destination_lng',b.lng).select('id').maybeSingle();
   if(saved.error)throw saved.error;
   if(!saved.data)throw new Error('Os pontos foram alterados durante o cálculo. Abra o frete novamente.');
  } catch(e) { routeError=e instanceof Error?e.message:'Falha ao recalcular a rota.'; }
  return {...updated,routeError};
 });
