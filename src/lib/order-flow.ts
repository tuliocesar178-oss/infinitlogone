import type { OrderStatus } from "./order-status";

export type DriverAction =
  | "start_pickup"        // driver_assigned -> en_route_pickup
  | "start_loading"       // at_pickup -> loading (libera checklist)
  | "loaded"              // loading -> loaded (após checklist)
  | "start_delivery"      // loaded -> in_transit
  | "start_unloading"     // at_destination -> unloading (libera checklist)
  | "delivered";          // unloading -> delivered (após comprovantes)

export const ACTION_TRANSITIONS: Record<DriverAction, { from: OrderStatus[]; to: OrderStatus }> = {
  start_pickup: { from: ["driver_assigned", "planning"], to: "en_route_pickup" },
  start_loading: {
    from: ["at_pickup", "arriving_pickup", "near_pickup", "en_route_pickup", "in_transit_to_pickup"],
    to: "loading",
  },
  loaded: { from: ["loading", "at_pickup"], to: "loaded" },
  start_delivery: { from: ["loaded", "picked_up", "out_for_delivery"], to: "in_transit" },
  start_unloading: {
    from: ["at_destination", "arriving_destination", "near_destination", "in_transit"],
    to: "unloading",
  },
  delivered: { from: ["unloading", "at_destination"], to: "delivered" },
};

export function nextDriverAction(status: OrderStatus): DriverAction | null {
  switch (status) {
    case "driver_assigned":
      return "start_pickup";
    case "en_route_pickup":
    case "in_transit_to_pickup":
    case "near_pickup":
    case "arriving_pickup":
    case "at_pickup":
      return "start_loading";
    case "loading":
      return "loaded";
    case "loaded":
    case "picked_up":
    case "out_for_delivery":
      return "start_delivery";
    case "in_transit":
    case "near_destination":
    case "arriving_destination":
    case "at_destination":
      return "start_unloading";
    case "unloading":
      return "delivered";
    default:
      return null;
  }
}

export const ACTION_LABEL: Record<DriverAction, string> = {
  start_pickup: "Iniciar deslocamento",
  start_loading: "Iniciar carregamento",
  loaded: "Carregamento concluído",
  start_delivery: "Seguir para entrega",
  start_unloading: "Iniciar descarga",
  delivered: "Entrega concluída",
};
