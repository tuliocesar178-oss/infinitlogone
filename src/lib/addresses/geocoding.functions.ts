import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { AddressSuggestion } from './model';
const part = z.object({ name:z.string().optional(), region_code:z.string().optional(), region_code_full:z.string().optional() }).passthrough();
const feature = z.object({ id:z.string().optional(), properties:z.object({ mapbox_id:z.string().optional(), feature_type:z.string(), name:z.string().optional(), full_address:z.string().optional(), place_formatted:z.string().optional(), coordinates:z.object({ longitude:z.number(),latitude:z.number(),accuracy:z.string().optional() }), context:z.object({ address:z.object({ address_number:z.string().optional(),street_name:z.string().optional() }).optional(), street:part.optional(), neighborhood:part.optional(), locality:part.optional(), place:part.optional(), region:part.optional(), postcode:part.optional() }), match_code:z.object({ confidence:z.string().optional(),address_number:z.string().optional() }).optional() }) });
export const searchFreightAddress = createServerFn({ method:'POST' }).middleware([requireSupabaseAuth])
 .inputValidator(input=>z.object({query:z.string().trim().min(3).max(300)}).parse(input))
 .handler(async ({data})=>{
  const key=process.env['MAPBOX_API_KEY']; const lovable=process.env['LOVABLE_API_KEY'];
  if(!key||!lovable) throw new Error('Conexão Mapbox indisponível.');
  // Permanent geocoding permits storing selected results in freight records.
  const response=await fetch(`https://connector-gateway.lovable.dev/mapbox/search/geocode/v6/forward?q=${encodeURIComponent(data.query)}&country=br&language=pt&limit=5&types=address,street&permanent=true`,{headers:{Authorization:`Bearer ${lovable}`,'X-Connection-Api-Key':key}});
  if(!response.ok){const body=await response.text();console.error(`Mapbox geocoding [${response.status}]: ${body}`);throw new Error(`Mapbox [${response.status}]: ${body}`);}
  const parsed=z.object({features:z.array(feature)}).parse(await response.json());
  return parsed.features.map((f):AddressSuggestion=>{
   const p=f.properties,c=p.context,n=c.address?.address_number??'';
   return {id:p.mapbox_id??f.id??`${p.coordinates.longitude}:${p.coordinates.latitude}`,label:p.full_address??[p.name,p.place_formatted].filter(Boolean).join(', '),street:c.address?.street_name??c.street?.name??p.name??'',number:n,neighborhood:c.neighborhood?.name??c.locality?.name??'',city:c.place?.name??'',state:(c.region?.region_code??c.region?.region_code_full?.split('-').at(-1)??'').toUpperCase(),zip:c.postcode?.name??'',lat:p.coordinates.latitude,lng:p.coordinates.longitude,exact:p.feature_type==='address'&&!!n&&['rooftop','parcel','point'].includes(p.coordinates.accuracy??'')&&p.match_code?.address_number!=='unmatched'&&p.match_code?.address_number!=='inferred'};
  });
 });
