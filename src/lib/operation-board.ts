import type { Database } from "@/integrations/supabase/types";

export type BoardOrder = Database["public"]["Tables"]["orders"]["Row"] & {
  driver: { full_name: string | null; phone: string | null; photo_url?: string | null } | null;
  vehicle: { id: string; plate: string; model: string | null; brand: string | null; current_lat: number | null; current_lng: number | null; status: string; vehicle_type?: string | null } | null;
  incident: { id: string; type: string; description: string | null; severity: string | null; created_at: string } | null;
  work?: { name: string } | null;
  responsible?: string | null;
  actual_delivery_at?: string | null;
  tracking_heading?: number | null;
  tracking_speed_kmh?: number | null;
  tracking_accuracy?: number | null;
};

export type BoardFilter = "live" | "all" | "awaiting" | "pickup" | "transit" | "near" | "delivered" | "late" | "incident";
export type BoardView = "live" | "incident" | "late" | "map" | "delivered";

export const ACTIVE_STATUSES = [
  "driver_assigned", "en_route_pickup", "in_transit_to_pickup", "near_pickup", "arriving_pickup",
  "at_pickup", "loading", "picked_up", "loaded", "out_for_delivery", "in_transit",
  "near_destination", "arriving_destination", "at_destination", "unloading", "incident",
];

export const PICKUP_STATUSES = ["at_pickup", "loading", "picked_up", "loaded"];
export const TRANSIT_STATUSES = ["out_for_delivery", "in_transit"];
export const NEAR_STATUSES = ["near_destination", "arriving_destination", "at_destination", "unloading"];
export const DELIVERED_STATUSES = ["delivered", "finalized"];

export function isToday(value?: string | null) {
  if (!value) return false;
  return new Date(value).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }) ===
    new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export function expectedDelivery(order: BoardOrder): Date | null {
  if (order.delivery_window_end) {
    const parsed = new Date(order.delivery_window_end);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

export function etaDate(order: BoardOrder): Date | null {
  if (order.eta_minutes == null || order.eta_minutes < 0 || !order.last_ping_at) return null;
  const ping = new Date(order.last_ping_at).getTime();
  if (!Number.isFinite(ping) || Date.now() - ping > 180_000 || ping > Date.now() + 30_000) return null;
  return new Date(ping + order.eta_minutes * 60_000);
}

export function isLate(order: BoardOrder) {
  if (DELIVERED_STATUSES.includes(order.status) || order.status === "cancelled") return false;
  const expected = expectedDelivery(order);
  if (!expected) return false;
  const ping = order.last_ping_at ? new Date(order.last_ping_at).getTime() : NaN;
  return Number.isFinite(ping) && Date.now() - ping <= 180_000 && ping <= Date.now() + 30_000 && Date.now() > expected.getTime();
}

export function progress(order: BoardOrder) {
  const total = order.initial_distance_km ?? order.distance_km;
  const remaining = order.distance_to_destination_km;
  if (!total || remaining == null || total <= 0) return null;
  return Math.max(0, Math.min(100, Math.round(((total - remaining) / total) * 100)));
}

export function priority(order: BoardOrder) {
  if (order.incident || order.status === "incident") return 0;
  if (isLate(order)) return 1;
  if (PICKUP_STATUSES.includes(order.status) || order.status === "unloading") return 2;
  if (NEAR_STATUSES.includes(order.status)) return 3;
  if (TRANSIT_STATUSES.includes(order.status)) return 4;
  if (ACTIVE_STATUSES.includes(order.status)) return 5;
  if (order.status === "awaiting_driver") return 6;
  return 7;
}

export function matchesFilter(order: BoardOrder, filter: BoardFilter) {
  if (filter === "all") return true;
  if (filter === "live") return ACTIVE_STATUSES.includes(order.status) || order.status === "awaiting_driver";
  if (filter === "awaiting") return order.status === "awaiting_driver";
  if (filter === "pickup") return PICKUP_STATUSES.includes(order.status);
  if (filter === "transit") return TRANSIT_STATUSES.includes(order.status);
  if (filter === "near") return NEAR_STATUSES.includes(order.status);
  if (filter === "delivered") return DELIVERED_STATUSES.includes(order.status) && isToday(order.actual_delivery_at ?? order.completed_at);
  if (filter === "late") return isLate(order);
  return Boolean(order.incident || order.status === "incident");
}

export const INCIDENT_LABEL: Record<string, string> = {
  traffic: "Trânsito", breakdown: "Problema mecânico", accident: "Acidente", cargo_issue: "Problema com a carga",
  pickup_delay: "Atraso na coleta", delivery_refused: "Entrega recusada", route_blocked: "Rota bloqueada", other: "Outro",
};