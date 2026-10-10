import nearestPointOnLine from '@turf/nearest-point-on-line';
import { lineString, point } from '@turf/helpers';
import distance from '@turf/distance';
export type Position = [number, number];
export interface NavigationStep { distance: number; duration: number; geometry: { type: 'LineString'; coordinates: number[][] }; maneuver: { instruction: string; type: string; modifier?: string; location: number[] }; }
export interface NavigationRoute { distance: number; duration: number; geometry: { type: 'LineString'; coordinates: number[][] }; legs: { steps: NavigationStep[] }[]; }
export interface NavigationOrder { id: string; status: string; driver_id: string | null; origin_lat: number | null; origin_lng: number | null; origin_address: string; destination_lat: number | null; destination_lng: number | null; destination_address: string; }
const pickup = ['driver_assigned','en_route_pickup','in_transit_to_pickup','near_pickup','arriving_pickup','at_pickup','loading'];
export function navigationTarget(order: NavigationOrder) {
  const isPickup = pickup.includes(order.status);
  const lat = isPickup ? order.origin_lat : order.destination_lat;
  const lng = isPickup ? order.origin_lng : order.destination_lng;
  return { kind: isPickup ? 'Coleta' : 'Entrega', address: isPickup ? order.origin_address : order.destination_address, position: lat != null && lng != null ? [lng, lat] as Position : null };
}
export function navigationActive(status: string) { return [...pickup,'loaded','picked_up','out_for_delivery','in_transit','near_destination','arriving_destination','at_destination','unloading'].includes(status); }
export function routeProgress(route: NavigationRoute, position: Position) {
  const snapped = nearestPointOnLine(lineString(route.geometry.coordinates), point(position));
  const along = snapped.properties.location;
  const traveled = Math.min(route.distance, Math.max(0, along * 1000));
  const steps = route.legs.flatMap(leg => leg.steps);
  let accumulated = 0;
  let index = 0;
  for (let i = 0; i < steps.length; i++) { accumulated += steps[i].distance; index = i; if (accumulated > traveled + 10) break; }
  const current = steps[index];
  const next = steps[Math.min(index + 1, steps.length - 1)];
  const remaining = Math.max(0, route.distance - traveled);
  const stepRemaining = Math.max(0, accumulated - traveled);
  const seconds = steps.slice(index + 1).reduce((sum, step) => sum + step.duration, 0) + (current && current.distance > 0 ? current.duration * stepRemaining / current.distance : 0);
  return { traveled, remaining, percent: route.distance > 0 ? traveled / route.distance * 100 : 0, seconds, stepRemaining, instruction: next?.maneuver.instruction ?? current?.maneuver.instruction ?? 'Siga a rota', stepIndex: index, offRoute: snapped.properties.dist * 1000, arrival: distance(point(position), point(route.geometry.coordinates.at(-1) ?? position)) * 1000 <= 100 };
}
