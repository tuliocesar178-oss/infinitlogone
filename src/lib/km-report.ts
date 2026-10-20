// Regras de cálculo do dashboard comparativo de KM por obra.
//
// Regra de negócio (precisão dos dados):
// - KM efetivo = recorded_distance_km (medido no frete). Quando ausente, usa-se
//   o KM planejado (distance_km, depois antt_distance_km) marcado como estimado.
// - Nunca somar pontos de GPS nem duplicar KM do mesmo frete: cada frete
//   contribui exatamente uma vez, pela sua obra.
// - Fretes cancelados não entram nos totais, a menos que o usuário filtre
//   explicitamente pelo status "cancelled".

export type KmOrder = {
  id: string;
  code: string;
  work_id: string | null;
  client_name: string | null;
  status: string;
  created_at: string;
  origin_city: string | null;
  origin_state: string | null;
  destination_city: string | null;
  destination_state: string | null;
  distance_km: number | null;
  recorded_distance_km: number | null;
  antt_distance_km: number | null;
  driver_id: string | null;
  vehicle_id: string | null;
};

export const CANCELLED_STATUS = "cancelled";

export function formatKm(value: number) {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km`;
}

export function formatReportDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR");
}

/** KM medido no frete; null quando ainda não há medição. */
export function effectiveKm(order: Pick<KmOrder, "recorded_distance_km">) {
  return order.recorded_distance_km ?? null;
}

/** KM planejado/estimado (rota planejada ou distância ANTT). */
export function plannedKm(order: Pick<KmOrder, "distance_km" | "antt_distance_km">) {
  return order.distance_km ?? order.antt_distance_km ?? 0;
}

/** KM contabilizado no dashboard: efetivo quando existe, senão planejado. */
export function countedKm(
  order: Pick<KmOrder, "recorded_distance_km" | "distance_km" | "antt_distance_km">,
): { km: number; estimated: boolean } {
  const measured = effectiveKm(order);
  if (measured != null) return { km: measured, estimated: false };
  return { km: plannedKm(order), estimated: true };
}

/** Período anterior equivalente: mesma duração, imediatamente antes de `from`. */
export function previousPeriod(from: string, to: string): { from: string; to: string } {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
  const prevTo = new Date(start.getTime() - 86_400_000);
  const prevFrom = new Date(prevTo.getTime() - (days - 1) * 86_400_000);
  const iso = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
      date.getDate(),
    ).padStart(2, "0")}`;
  return { from: iso(prevFrom), to: iso(prevTo) };
}

export type Granularity = "day" | "week" | "month";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Chave do agrupamento temporal (dia, semana começando na segunda, ou mês). */
export function bucketKey(iso: string, granularity: Granularity): string {
  const date = new Date(iso);
  if (granularity === "month") return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
  if (granularity === "day") return dayKey(date);
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return dayKey(monday);
}

/** Todas as chaves de bucket entre from e to (inclusive), para preencher lacunas. */
export function bucketRange(from: string, to: string, granularity: Granularity): string[] {
  const keys: string[] = [];
  const cursor = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  let guard = 0;
  while (cursor <= end && guard < 400) {
    const key = bucketKey(cursor.toISOString(), granularity);
    if (keys[keys.length - 1] !== key) keys.push(key);
    if (granularity === "month") cursor.setMonth(cursor.getMonth() + 1);
    else if (granularity === "week") cursor.setDate(cursor.getDate() + 7);
    else cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }
  return keys;
}

export type WorkStat = {
  workId: string;
  km: number;
  estimatedKm: number;
  freights: number;
  completed: number;
  drivers: Set<string>;
  vehicles: Set<string>;
  lastAt: string | null;
  clientName: string | null;
};

const COMPLETED_STATUSES = new Set(["delivered", "finalized", "completed"]);

/** Consolida os fretes por obra. Cada frete conta uma única vez. */
export function buildWorkStats(orders: KmOrder[]): Map<string, WorkStat> {
  const stats = new Map<string, WorkStat>();
  for (const order of orders) {
    if (!order.work_id) continue;
    const current =
      stats.get(order.work_id) ??
      ({
        workId: order.work_id,
        km: 0,
        estimatedKm: 0,
        freights: 0,
        completed: 0,
        drivers: new Set<string>(),
        vehicles: new Set<string>(),
        lastAt: null,
        clientName: order.client_name ?? null,
      } satisfies WorkStat);
    const { km, estimated } = countedKm(order);
    current.km += km;
    if (estimated) current.estimatedKm += km;
    current.freights += 1;
    if (COMPLETED_STATUSES.has(order.status)) current.completed += 1;
    if (order.driver_id) current.drivers.add(order.driver_id);
    if (order.vehicle_id) current.vehicles.add(order.vehicle_id);
    if (!current.lastAt || order.created_at > current.lastAt) current.lastAt = order.created_at;
    stats.set(order.work_id, current);
  }
  return stats;
}

/** Série temporal de KM por obra, com lacunas preenchidas com zero. */
export function buildEvolution(
  orders: KmOrder[],
  workIds: string[],
  granularity: Granularity,
  from: string,
  to: string,
): Array<Record<string, number | string>> {
  const rows = new Map<string, Record<string, number | string>>();
  for (const key of bucketRange(from, to, granularity)) {
    const row: Record<string, number | string> = { bucket: key };
    for (const id of workIds) row[id] = 0;
    rows.set(key, row);
  }
  for (const order of orders) {
    if (!order.work_id || !workIds.includes(order.work_id)) continue;
    const row = rows.get(bucketKey(order.created_at, granularity));
    if (!row) continue;
    row[order.work_id] = (row[order.work_id] as number) + countedKm(order).km;
  }
  return [...rows.values()];
}

/** Variação entre períodos; pct é null quando não há base de comparação. */
export function compareKm(current: number, previous: number) {
  const abs = current - previous;
  return { abs, pct: previous > 0 ? (abs / previous) * 100 : null };
}
