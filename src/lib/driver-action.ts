import { supabase } from '@/integrations/supabase/client';
import { ACTION_TRANSITIONS, type DriverAction } from '@/lib/order-flow';
import type { Position } from '@/lib/navigation/model';

/** Default approach radius (meters). Only shows hints; never confirms arrival by itself. */
export const APPROACH_RADIUS_M = 300;

export type StageKind = 'go_pickup' | 'near_pickup' | 'pickup_checklist' | 'go_delivery' | 'near_delivery' | 'delivery_docs' | 'start_trip' | 'start_pickup' | null;

/** Derives the main driver action from the freight status and real GPS distance. */
export function stageFor(action: DriverAction | null, remainingMeters: number | null): StageKind {
  const near = remainingMeters != null && remainingMeters <= APPROACH_RADIUS_M;
  switch (action) {
    case 'start_pickup': return 'start_pickup';
    case 'start_loading': return near ? 'near_pickup' : 'go_pickup';
    case 'loaded': return 'pickup_checklist';
    case 'start_delivery': return 'start_trip';
    case 'start_unloading': return near ? 'near_delivery' : 'go_delivery';
    case 'delivered': return 'delivery_docs';
    default: return null;
  }
}

/** Applies an existing status transition and records the event (same rules as the freight panel). */
export async function performDriverAction(order: { id: string; status: string }, action: DriverAction, userId: string, position: Position | null) {
  const allowed = ACTION_TRANSITIONS[action];
  if (!allowed.from.includes(order.status as never)) throw new Error('Esta ação não está disponível nesta etapa do frete.');
  const now = new Date().toISOString();
  const patch: { status: never; updated_at: string; started_trip_at?: string } = { status: allowed.to as never, updated_at: now };
  if (action === 'start_pickup' || action === 'start_delivery') patch.started_trip_at = now;
  const { error } = await supabase.from('orders').update(patch).eq('id', order.id);
  if (error) throw new Error(`Erro ao atualizar o frete: ${error.message}`);
  const { error: eventError } = await supabase.from('order_events').insert({
    order_id: order.id, event_type: `driver_${action}`, from_status: order.status as never, to_status: allowed.to as never, actor_id: userId,
    payload: { lat: position?.[1] ?? null, lng: position?.[0] ?? null, source: 'navigation' },
  });
  if (eventError) console.warn('Falha ao registrar evento do frete:', eventError.message);
}
