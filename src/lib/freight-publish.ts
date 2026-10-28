import { dispatchOrderToEligibleDrivers } from "@/lib/dispatch.functions";

export type PublishOptions = {
  /** Valor ofertado ao motorista (R$) */
  price: number;
  /** Validade da oferta em minutos */
  minutes: number;
  /** Tipo de veículo exigido (opcional) */
  vehicleType?: string | null;
  /** Capacidade mínima exigida em kg (opcional) */
  capacityKg?: number | null;
  /** Código do frete, usado nas notificações */
  code?: string | null;
};

/**
 * Envia a oferta de um frete a todos os motoristas elegíveis.
 * Elegibilidade: cadastro aprovado (approval_status = 'active'),
 * sem filtros adicionais de financeiro, disponibilidade ou veículo.
 * Retorna a quantidade de ofertas criadas.
 */
export async function sendOffersToEligibleDrivers(
  orderId: string,
  opts: PublishOptions,
): Promise<number> {
  const result = await dispatchOrderToEligibleDrivers({ data: { order_id: orderId, price: opts.price, minutes: opts.minutes } });
  return result.count;
}
