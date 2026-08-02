import { MONITOR } from "./geofence";

export type TrackKind =
  | "in_transit"
  | "to_pickup"
  | "loading"
  | "near_delivery"
  | "stopped"
  | "incident"
  | "offline";

export const TRACK_KIND: Record<TrackKind, { label: string; color: string; dot: string }> = {
  in_transit: { label: "Em trânsito", color: "#22c55e", dot: "🟢" },
  to_pickup: { label: "Indo para coleta", color: "#eab308", dot: "🟡" },
  loading: { label: "Carregando", color: "#3b82f6", dot: "🔵" },
  near_delivery: { label: "Próximo da entrega", color: "#a855f7", dot: "🟣" },
  stopped: { label: "Parado", color: "#cbd5e1", dot: "⚪" },
  incident: { label: "Ocorrência", color: "#ef4444", dot: "🔴" },
  offline: { label: "Offline", color: "#334155", dot: "⚫" },
};

const TO_PICKUP = [
  "driver_assigned",
  "en_route_pickup",
  "in_transit_to_pickup",
  "near_pickup",
  "arriving_pickup",
];
const LOADING = ["at_pickup", "loading"];
const NEAR_DELIVERY = ["near_destination", "arriving_destination", "at_destination", "unloading"];
const TRANSIT = ["loaded", "picked_up", "out_for_delivery", "in_transit"];

export function trackKind(input: {
  status?: string | null;
  speedKmh?: number | null;
  lastSeenAt?: string | null;
  online?: boolean;
}): TrackKind {
  const { status, speedKmh, lastSeenAt } = input;
  if (status === "incident") return "incident";
  const stale =
    !lastSeenAt || Date.now() - new Date(lastSeenAt).getTime() > MONITOR.gpsLostSeconds * 1000;
  if (stale) return "offline";
  if (NEAR_DELIVERY.includes(status ?? "")) return "near_delivery";
  if (LOADING.includes(status ?? "")) return "loading";
  if ((speedKmh ?? 0) < MONITOR.idleSpeedKmh) return "stopped";
  if (TRANSIT.includes(status ?? "")) return "in_transit";
  if (TO_PICKUP.includes(status ?? "")) return "to_pickup";
  return "stopped";
}

export const TRACK_FILTERS: { key: TrackKind | "all" | "delivered"; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "in_transit", label: "Em trânsito" },
  { key: "to_pickup", label: "Em coleta" },
  { key: "loading", label: "Carregando" },
  { key: "near_delivery", label: "Próximos da entrega" },
  { key: "delivered", label: "Entregues" },
  { key: "incident", label: "Com ocorrência" },
  { key: "offline", label: "Offline" },
];

export type TrackAlert = { kind: string; label: string; severity: "high" | "medium" };

export function computeAlerts(u: {
  status?: string | null;
  speedKmh?: number | null;
  lastSeenAt?: string | null;
  idleMinutes?: number | null;
  etaMinutes?: number | null;
  windowEnd?: string | null;
}): TrackAlert[] {
  const out: TrackAlert[] = [];
  const stale =
    !u.lastSeenAt || Date.now() - new Date(u.lastSeenAt).getTime() > MONITOR.gpsLostSeconds * 1000;
  if (stale) out.push({ kind: "gps", label: "GPS offline", severity: "high" });
  if (u.status === "incident") out.push({ kind: "incident", label: "Ocorrência aberta", severity: "high" });
  if ((u.speedKmh ?? 0) > MONITOR.speedLimitKmh)
    out.push({ kind: "speed", label: `Excesso de velocidade (${Math.round(u.speedKmh!)} km/h)`, severity: "high" });
  if ((u.idleMinutes ?? 0) >= MONITOR.idleAlertMinutes)
    out.push({ kind: "idle", label: `Parada longa (${Math.round(u.idleMinutes!)} min)`, severity: "medium" });
  else if (!stale && (u.speedKmh ?? 0) < MONITOR.idleSpeedKmh)
    out.push({ kind: "stopped", label: "Motorista parado", severity: "medium" });
  if (u.windowEnd && u.etaMinutes != null) {
    const arrival = Date.now() + u.etaMinutes * 60000;
    if (arrival > new Date(u.windowEnd).getTime())
      out.push({ kind: "late", label: "Atraso previsto na janela", severity: "high" });
  }
  return out;
}

export function fmtEta(min?: number | null): string {
  if (min == null) return "—";
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  return `${h}h${String(Math.round(min % 60)).padStart(2, "0")}`;
}

export function fmtAgo(iso?: string | null): string {
  if (!iso) return "sem sinal";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `há ${s}s`;
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  return `há ${Math.floor(s / 3600)}h`;
}
