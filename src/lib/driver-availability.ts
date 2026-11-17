import type { Availability } from './pf';

export function availabilityUpdate(availability: Availability, now = new Date().toISOString()) {
  return {
    availability,
    status: availability === 'disponivel' ? 'available' as const : availability === 'em_frete' ? 'on_trip' as const : 'offline' as const,
    last_seen_at: now,
  };
}

export function requireAvailabilityRow<T>(row: T | null): T {
  if (!row) throw new Error('Cadastro de motorista não encontrado ou acesso não autorizado.');
  return row;
}