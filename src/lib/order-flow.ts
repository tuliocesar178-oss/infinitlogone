import type { OrderStatus } from "./order-status";

export type DriverAction =
  | "start_pickup"        // driver_assigned -> en_route_pickup
  | "arrived_pickup"      // en_route_pickup -> at_pickup
  | "loaded"              // at_pickup -> loaded (via evidence form)
  | "start_delivery"      // out_for_delivery -> in_transit
  | "delivered";          // in_transit -> delivered (via evidence form)

export const ACTION_TRANSITIONS: Record<DriverAction, { from: OrderStatus[]; to: OrderStatus }> = {
  start_pickup: { from: ["driver_assigned"], to: "en_route_pickup" },
  arrived_pickup: { from: ["en_route_pickup", "in_transit_to_pickup"], to: "at_pickup" },
  loaded: { from: ["at_pickup"], to: "loaded" },
  start_delivery: { from: ["out_for_delivery", "loaded"], to: "in_transit" },
  delivered: { from: ["in_transit", "near_destination"], to: "delivered" },
};

export function nextDriverAction(status: OrderStatus): DriverAction | null {
  switch (status) {
    case "driver_assigned":
      return "start_pickup";
    case "en_route_pickup":
    case "in_transit_to_pickup":
      return "arrived_pickup";
    case "at_pickup":
      return "loaded";
    case "loaded":
    case "out_for_delivery":
      return "start_delivery";
    case "in_transit":
    case "near_destination":
      return "delivered";
    default:
      return null;
  }
}

export const ACTION_LABEL: Record<DriverAction, string> = {
  start_pickup: "Iniciar deslocamento",
  arrived_pickup: "Cheguei na coleta",
  loaded: "Enviar foto da carga",
  start_delivery: "Iniciar entrega",
  delivered: "Enviar comprovantes",
};
