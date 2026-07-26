import { STATUS_LABEL } from "@/lib/order-status";

export const ACTIVE_STATUSES = [
  "driver_assigned",
  "en_route_pickup",
  "in_transit_to_pickup",
  "at_pickup",
  "loaded",
  "picked_up",
  "out_for_delivery",
  "in_transit",
  "near_destination",
];

export const AWAITING_STATUSES = ["created", "preparing", "awaiting_driver"];

export type Severity = "critical" | "warn" | "info";

export type OpsAlert = {
  id: string;
  severity: Severity;
  kind: string;
  title: string;
  detail?: string;
  orderId?: string | null;
  driverId?: string | null;
  createdAt: string;
};

export function severityMeta(s: Severity) {
  switch (s) {
    case "critical":
      return { dot: "bg-rose-500", ring: "ring-rose-200", chip: "bg-rose-50 text-rose-700" };
    case "warn":
      return { dot: "bg-amber-500", ring: "ring-amber-200", chip: "bg-amber-50 text-amber-700" };
    default:
      return { dot: "bg-sky-500", ring: "ring-sky-200", chip: "bg-sky-50 text-sky-700" };
  }
}

export function progressPercent(o: {
  status?: string | null;
  distance_to_destination_km?: number | null;
  initial_distance_km?: number | null;
}) {
  if (o.status === "delivered" || o.status === "finalized") return 100;
  const d = o.distance_to_destination_km;
  const total = o.initial_distance_km;
  if (d == null || total == null || total <= 0) {
    // fallback rough estimate by status
    const idx = ACTIVE_STATUSES.indexOf(o.status ?? "");
    if (idx < 0) return 5;
    return Math.round(((idx + 1) / ACTIVE_STATUSES.length) * 90);
  }
  const pct = Math.max(0, Math.min(100, (1 - d / total) * 100));
  return Math.round(pct);
}

export function statusLabel(s?: string | null) {
  if (!s) return "—";
  return STATUS_LABEL[s] ?? s;
}

export function priorityChip(p?: string | null) {
  const key = (p ?? "normal").toLowerCase();
  if (key === "alta" || key === "urgente" || key === "high" || key === "urgent")
    return "bg-rose-50 text-rose-700";
  if (key === "media" || key === "média" || key === "medium")
    return "bg-amber-50 text-amber-700";
  return "bg-emerald-50 text-emerald-700";
}

export function formatBRL(v?: number | null) {
  if (v == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export function timeAgo(iso?: string | null) {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  return `${d}d`;
}
