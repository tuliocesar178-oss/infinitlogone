import { haversineKm } from "./geo";

/** Raios (km) das cercas virtuais da operação. */
export const FENCES = {
  pickupNear: 5,
  pickupArriving: 0.5,
  pickupUnlock: 0.1,
  destNear: 10,
  destArriving: 1,
  destUnlock: 0.1,
} as const;

/** Monitoramento inteligente */
export const MONITOR = {
  idleAlertMinutes: 20,
  speedLimitKmh: 90,
  gpsLostSeconds: 180,
  idleSpeedKmh: 3,
} as const;

export type TripPhase = "to_pickup" | "at_pickup" | "to_destination" | "at_destination" | "done";

const PICKUP_STATUSES = [
  "driver_assigned",
  "en_route_pickup",
  "in_transit_to_pickup",
  "near_pickup",
  "arriving_pickup",
];
const AT_PICKUP_STATUSES = ["at_pickup", "loading"];
const TRANSIT_STATUSES = [
  "loaded",
  "picked_up",
  "out_for_delivery",
  "in_transit",
  "near_destination",
  "arriving_destination",
];
const AT_DEST_STATUSES = ["at_destination", "unloading"];

export function tripPhase(status: string): TripPhase {
  if (PICKUP_STATUSES.includes(status)) return "to_pickup";
  if (AT_PICKUP_STATUSES.includes(status)) return "at_pickup";
  if (TRANSIT_STATUSES.includes(status)) return "to_destination";
  if (AT_DEST_STATUSES.includes(status)) return "at_destination";
  return "done";
}

export type Coords = { lat: number | null; lng: number | null };

/** Alvo de navegação atual conforme a fase da viagem. */
export function navTarget(
  status: string,
  order: {
    origin_lat: number | null;
    origin_lng: number | null;
    origin_address: string;
    destination_lat: number | null;
    destination_lng: number | null;
    destination_address: string;
  },
): { lat: number | null; lng: number | null; address: string; kind: "pickup" | "delivery" } {
  const phase = tripPhase(status);
  const toPickup = phase === "to_pickup" || phase === "at_pickup";
  return toPickup
    ? { lat: order.origin_lat, lng: order.origin_lng, address: order.origin_address, kind: "pickup" }
    : {
        lat: order.destination_lat,
        lng: order.destination_lng,
        address: order.destination_address,
        kind: "delivery",
      };
}

export function distanceToTargetKm(
  pos: { lat: number; lng: number },
  target: { lat: number | null; lng: number | null },
): number | null {
  if (target.lat == null || target.lng == null) return null;
  return haversineKm(pos, { lat: target.lat, lng: target.lng });
}

/**
 * Retorna o próximo status automático quando o motorista entra numa cerca.
 * Nunca retrocede o status.
 */
export function geofenceTransition(status: string, distanceKm: number | null): string | null {
  if (distanceKm == null) return null;
  switch (status) {
    case "driver_assigned":
      return null; // aguarda "Iniciar Deslocamento"
    case "en_route_pickup":
    case "in_transit_to_pickup":
      if (distanceKm <= FENCES.pickupUnlock) return "at_pickup";
      if (distanceKm <= FENCES.pickupArriving) return "arriving_pickup";
      if (distanceKm <= FENCES.pickupNear) return "near_pickup";
      return null;
    case "near_pickup":
      if (distanceKm <= FENCES.pickupUnlock) return "at_pickup";
      if (distanceKm <= FENCES.pickupArriving) return "arriving_pickup";
      return null;
    case "arriving_pickup":
      return distanceKm <= FENCES.pickupUnlock ? "at_pickup" : null;
    case "in_transit":
    case "out_for_delivery":
      if (distanceKm <= FENCES.destUnlock) return "at_destination";
      if (distanceKm <= FENCES.destArriving) return "arriving_destination";
      if (distanceKm <= FENCES.destNear) return "near_destination";
      return null;
    case "near_destination":
      if (distanceKm <= FENCES.destUnlock) return "at_destination";
      if (distanceKm <= FENCES.destArriving) return "arriving_destination";
      return null;
    case "arriving_destination":
      return distanceKm <= FENCES.destUnlock ? "at_destination" : null;
    default:
      return null;
  }
}

/** O botão da etapa (carregamento/descarga) só libera dentro do raio permitido. */
export function isWithinActionRadius(status: string, distanceKm: number | null): boolean {
  const phase = tripPhase(status);
  // Default to 100m (0.1km) if not specified in FENCES
  const radius = phase === "to_pickup" || phase === "at_pickup" ? FENCES.pickupUnlock : FENCES.destUnlock;
  if (distanceKm == null) return true; 
  return distanceKm <= radius;
}

export function fmtDistance(km: number | null | undefined): string {
  if (km == null || isNaN(km)) return "—";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export function calculateETA(distanceKm: number, averageSpeedKmh: number = 40): number {
  if (distanceKm <= 0) return 0;
  return Math.round((distanceKm / averageSpeedKmh) * 60);
}
