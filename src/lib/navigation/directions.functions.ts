import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { navigationActive, navigationTarget } from './model';
const position = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
const geometry = z.object({ type: z.literal('LineString'), coordinates: z.array(z.array(z.number())).min(2) });
const route = z.object({ distance: z.number().nonnegative(), duration: z.number().nonnegative(), geometry, legs: z.array(z.object({ steps: z.array(z.object({ distance: z.number(), duration: z.number(), geometry, maneuver: z.object({ instruction: z.string(), type: z.string(), modifier: z.string().optional(), location: z.array(z.number()) }) })) })) });
export const getNavigationDirections = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => z.object({ orderId: z.string().uuid(), position }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: order, error } = await context.supabase.from('orders').select('id,status,driver_id,origin_lat,origin_lng,origin_address,destination_lat,destination_lng,destination_address').eq('id', data.orderId).eq('driver_id', context.userId).maybeSingle();
    if (error) throw error;
    if (!order || !navigationActive(order.status)) throw new Error('Frete ativo não autorizado.');
    const target = navigationTarget(order);
    if (!target.position) throw new Error('Coordenadas do destino não cadastradas. Contate a equipe.');
    const key = process.env['MAPBOX_API_KEY'];
    const lovable = process.env['LOVABLE_API_KEY'];
    if (!key || !lovable) throw new Error('Conexão Mapbox indisponível.');
    const path = `${data.position.join(',')};${target.position.join(',')}`;
    const response = await fetch(`https://connector-gateway.lovable.dev/mapbox/directions/v5/mapbox/driving-traffic/${path}?steps=true&language=pt-BR&geometries=geojson&overview=full&alternatives=true`, { headers: { Authorization: `Bearer ${lovable}`, 'X-Connection-Api-Key': key } });
    if (!response.ok) { const body = await response.text(); console.error(`Mapbox [${response.status}]: ${body}`); throw new Error(`Mapbox [${response.status}]: ${body}`); }
    const parsed = z.object({ code: z.string(), message: z.string().optional(), routes: z.array(route).optional() }).parse(await response.json());
    if (parsed.code !== 'Ok' || !parsed.routes?.length) throw new Error(parsed.message ?? 'Nenhuma rota rodoviária disponível.');
    return { routes: parsed.routes, target };
  });

export const syncNavigationPosition = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => z.object({ orderId: z.string().uuid(), position, accuracy: z.number().nonnegative(), heading: z.number().nullable(), speed: z.number().nullable(), etaMinutes: z.number().nonnegative().nullable(), distanceKm: z.number().nonnegative().nullable(), status: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: order, error } = await context.supabase.from('orders').select('id,status,driver_id').eq('id', data.orderId).eq('driver_id', context.userId).maybeSingle();
    if (error) throw error;
    if (!order || !navigationActive(order.status)) throw new Error('Rastreamento não autorizado.');
    const now = new Date().toISOString();
    const [lng, lat] = data.position;
    const results = await Promise.all([
      context.supabase.from('drivers').update({ current_lat: lat, current_lng: lng, current_accuracy: data.accuracy, current_heading: data.heading, current_speed: data.speed, last_seen_at: now }).eq('user_id', context.userId),
      context.supabase.from('order_tracking_points').insert({ order_id: data.orderId, driver_id: context.userId, lat, lng, accuracy: data.accuracy, heading: data.heading, speed: data.speed }),
      context.supabase.from('orders').update({ current_lat: lat, current_lng: lng, last_ping_at: now, ...(data.status === order.status ? { eta_minutes: data.etaMinutes, distance_to_destination_km: data.distanceKm } : {}) }).eq('id', data.orderId).eq('driver_id', context.userId).eq('status', order.status),
    ]);
    const failed = results.find(result => result.error);
    if (failed?.error) throw failed.error;
    return { savedAt: now };
  });
