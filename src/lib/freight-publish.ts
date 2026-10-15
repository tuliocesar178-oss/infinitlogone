import { supabase } from "@/integrations/supabase/client";

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
 * financeiro liberado e disponibilidade compatível.
 * Retorna a quantidade de ofertas criadas.
 */
export async function sendOffersToEligibleDrivers(
  orderId: string,
  opts: PublishOptions,
): Promise<number> {
  const { data: drivers, error } = await supabase
    .from("drivers")
    .select("user_id, availability, approval_status, financial_status, current_vehicle_id")
    .eq("approval_status", "active")
    .eq("financial_status", "ativo")
    .in("availability", ["disponivel", "offline"]);

  if (error || !drivers?.length) return 0;

  let eligible = drivers.map((d) => d.user_id as string);

  // Compatibilidade de veículo, quando exigida
  if (opts.vehicleType || opts.capacityKg) {
    const { data: vehicles } = await supabase
      .from("vehicles")
      .select("owner_driver_id, vehicle_type, category, capacity_kg, max_weight_kg, active")
      .eq("active", true);

    if (vehicles?.length) {
      const wanted = (opts.vehicleType ?? "").toLowerCase();
      const compatible = new Set(
        vehicles
          .filter((v) => {
            const typeOk =
              !wanted ||
              `${v.vehicle_type ?? ""} ${v.category ?? ""}`.toLowerCase().includes(wanted);
            const cap = Number(v.max_weight_kg ?? v.capacity_kg ?? 0);
            const capOk = !opts.capacityKg || cap === 0 || cap >= opts.capacityKg;
            return typeOk && capOk;
          })
          .map((v) => v.owner_driver_id as string)
          .filter(Boolean),
      );
      eligible = eligible.filter((id) => compatible.has(id));
    }
  }

  if (!eligible.length) return 0;

  const expiresAt = new Date(Date.now() + opts.minutes * 60_000).toISOString();
  const rows = eligible.map((driverId) => ({
    order_id: orderId,
    driver_id: driverId,
    offered_price: opts.price,
    status: "pending" as const,
    expires_at: expiresAt,
  }));

  const { error: offerError } = await supabase
    .from("freight_offers")
    .upsert(rows, { onConflict: "order_id,driver_id" });
  if (offerError) {
    console.error("Erro ao enviar ofertas:", offerError);
    return 0;
  }

  await supabase.from("notifications").insert(
    eligible.map((driverId) => ({
      user_id: driverId,
      type: "new_offer",
      title: "Novo frete disponível",
      body: opts.code ? `Frete ${opts.code} disponível para aceite.` : "Um novo frete está disponível.",
      data: { order_id: orderId } as never,
    })),
  );

  return eligible.length;
}
