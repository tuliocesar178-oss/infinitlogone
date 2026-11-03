// Modelo puro do despacho de fretes (sem I/O) — compartilhado entre painel e testes.

export type DispatchMode = 'automatic' | 'manual';

export const DISPATCH_MODE_LABELS: Record<DispatchMode, string> = {
  automatic: 'Automático — Todos os motoristas',
  manual: 'Manual — Escolher motorista',
};

export type DispatchDriver = {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  photo_url: string | null;
  availability: string | null;
  vehicle_plate: string | null;
  vehicle_model: string | null;
  vehicle_type: string | null;
  vehicle_capacity_kg: number | null;
};

const norm = (value: string | null | undefined) =>
  (value ?? '').trim().toLocaleLowerCase('pt-BR');

const digits = (value: string | null | undefined) => (value ?? '').replace(/\D/g, '');

/**
 * Filtra a lista de motoristas do despacho manual por nome, telefone,
 * placa ou tipo/modelo de veículo. Termo vazio retorna a lista completa.
 * Telefone e placa também casam apenas pelos dígitos, ignorando formatação.
 */
export function filterDispatchDrivers(drivers: DispatchDriver[], term: string): DispatchDriver[] {
  const text = norm(term);
  if (!text) return drivers;
  const termDigits = digits(term);
  return drivers.filter((driver) => {
    if (norm(driver.full_name).includes(text)) return true;
    if (norm(driver.vehicle_type).includes(text)) return true;
    if (norm(driver.vehicle_model).includes(text)) return true;
    if (norm(driver.vehicle_plate).includes(text)) return true;
    if (termDigits) {
      if (digits(driver.phone).includes(termDigits)) return true;
      if (digits(driver.vehicle_plate).includes(termDigits)) return true;
    }
    return false;
  });
}

export const AVAILABILITY_LABELS: Record<string, string> = {
  disponivel: 'Disponível',
  em_frete: 'Em frete',
  folga: 'Folga',
  ferias: 'Férias',
  bloqueado: 'Bloqueado',
  offline: 'Offline',
};

export function availabilityLabel(availability: string | null | undefined): string {
  if (!availability) return '—';
  return AVAILABILITY_LABELS[availability] ?? availability;
}

export type OfferStatusCounts = {
  pending: number;
  accepted: number;
  declined: number;
  expired: number;
  cancelled: number;
  negotiating: number;
};

export function countOffersByStatus(offers: Array<{ status: string }>): OfferStatusCounts {
  const counts: OfferStatusCounts = { pending: 0, accepted: 0, declined: 0, expired: 0, cancelled: 0, negotiating: 0 };
  for (const offer of offers) {
    if (offer.status in counts) counts[offer.status as keyof OfferStatusCounts] += 1;
  }
  return counts;
}

/** Minutos restantes para resposta da oferta; 0 quando já expirou ou não há prazo. */
export function minutesRemaining(expiresAt: string | null | undefined, now: number = Date.now()): number {
  if (!expiresAt) return 0;
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 60_000));
}
