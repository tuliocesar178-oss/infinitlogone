import type { BoardOrder } from "@/lib/operation-board";
import { ACTIVE_STATUSES } from "@/lib/operation-board";
import { deadline, gpsFresh, routeGeometry, type MonitoringSettings } from "@/lib/operation-board-monitor";

export type OperationalFilter = "all" | "transit" | "late" | "incident" | "stale";
export function activeTrackingOrders(orders: BoardOrder[]) {
  return [...new Map(orders.filter(o => Boolean(o.driver_id) && ACTIVE_STATUSES.includes(o.status)).map(o => [o.id, o])).values()];
}
export function trackingPosition(order: { current_lat: number | null; current_lng: number | null; last_ping_at: string | null }, driver?: { current_lat: number | null; current_lng: number | null; last_seen_at: string | null }) {
  if (order.current_lat != null && order.current_lng != null && Number.isFinite(order.current_lat) && Number.isFinite(order.current_lng)) return { current_lat: order.current_lat, current_lng: order.current_lng, last_ping_at: order.last_ping_at };
  if (driver?.current_lat != null && driver.current_lng != null && Number.isFinite(driver.current_lat) && Number.isFinite(driver.current_lng)) return { current_lat: driver.current_lat, current_lng: driver.current_lng, last_ping_at: driver.last_seen_at };
  return { current_lat: null, current_lng: null, last_ping_at: null };
}
export function operationalState(order: BoardOrder, now: number, settings: MonitoringSettings) {
  return { late: deadline(order, now, settings).state === "late", incident: Boolean(order.incident) || order.status === "incident", stale: !gpsFresh(order, now, settings) };
}
export function filterTrackingOrders(orders: BoardOrder[], filter: OperationalFilter, search: string, now: number, settings: MonitoringSettings) {
  const term = search.trim().toLocaleLowerCase("pt-BR");
  return activeTrackingOrders(orders).filter(o => {
    const state = operationalState(o, now, settings);
    if (filter === "transit" && !["in_transit", "out_for_delivery", "loaded", "picked_up"].includes(o.status)) return false;
    if (filter !== "all" && filter !== "transit" && !state[filter]) return false;
    return !term || [o.code, o.driver?.full_name, o.vehicle?.plate, o.client_name, o.work?.name].some(v => v?.toLocaleLowerCase("pt-BR").includes(term));
  });
}
export function trackingRoutes(orders: BoardOrder[], now: number, settings: MonitoringSettings) {
  return activeTrackingOrders(orders).flatMap(o => {
    const geometry = routeGeometry(o.route_geometry);
    const state = operationalState(o, now, settings);
    return geometry ? [{ id: o.id, geometry, critical: state.late || state.incident, stale: state.stale }] : [];
  });
}