import { ACTIVE_STATUSES } from "@/lib/operation-board";
import { routeGeometry } from "@/lib/operation-board-monitor";

export interface TrackingRouteOrder {
  id: string; driver_id: string | null; status: string;
  origin_lat: number | null; origin_lng: number | null;
  destination_lat: number | null; destination_lng: number | null;
  route_geometry: string | null;
}
export const PICKUP_ROUTE_STATUSES = ["driver_assigned", "en_route_pickup", "in_transit_to_pickup", "near_pickup", "arriving_pickup", "at_pickup", "loading"];
export function hasActiveDriverRoute(order: Pick<TrackingRouteOrder, "status" | "driver_id">) {
  return Boolean(order.driver_id) && ACTIVE_STATUSES.includes(order.status);
}
export function trackingStage(order: Pick<TrackingRouteOrder, "status">) {
  return PICKUP_ROUTE_STATUSES.includes(order.status) ? "pickup" : "delivery";
}
export function trackingPoint(lat: number | null, lng: number | null): [number, number] | null {
  return lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? [lng, lat] : null;
}
export function authorizedTrackingOrder(clientId: string | null, userId: string, boardAllowed: boolean) {
  return boardAllowed || clientId === userId;
}
export function selectedTrackingOrder<T extends { id: string }>(orders: T[], id: string | null) {
  return orders.find(order => order.id === id) ?? null;
}
export function savedTrackingRoute(order: TrackingRouteOrder) {
  return hasActiveDriverRoute(order) ? routeGeometry(order.route_geometry) : null;
}