export interface FreightValues {
  client_amount: number | null;
  driver_amount: number | null;
}

/** Missing legacy values stay unknown; commercial prices are never driver pay. */
export function grossMargin(values: FreightValues): number | null {
  if (values.client_amount == null || values.driver_amount == null) return null;
  return Math.round((values.client_amount - values.driver_amount) * 100) / 100;
}

export function requireDriverAmount(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value) || value <= 0 || value > 10_000_000) {
    throw new Error('Informe o valor destinado ao motorista antes de enviar a oferta.');
  }
  return value;
}

export function driverValueLabel(value: number | null | undefined): string {
  return value == null ? 'Valor pendente' : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}