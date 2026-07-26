export type OrderStatus =
  | "created"
  | "preparing"
  | "awaiting_driver"
  | "driver_assigned"
  | "en_route_pickup"
  | "in_transit_to_pickup"
  | "at_pickup"
  | "picked_up"
  | "loaded"
  | "out_for_delivery"
  | "in_transit"
  | "near_destination"
  | "delivered"
  | "finalized"
  | "cancelled"
  | "incident";

export const STATUS_LABEL: Record<string, string> = {
  created: "Criado",
  preparing: "Preparando para coleta",
  awaiting_driver: "Aguardando aceite do motorista",
  driver_assigned: "Motorista confirmado",
  en_route_pickup: "Em deslocamento para coleta",
  in_transit_to_pickup: "Em deslocamento para coleta",
  at_pickup: "No local da coleta",
  picked_up: "Carga coletada",
  loaded: "Carga carregada",
  out_for_delivery: "Saiu para entrega",
  in_transit: "Em trânsito",
  near_destination: "Próximo ao destino",
  delivered: "Entregue",
  finalized: "Finalizado",
  cancelled: "Cancelado",
  incident: "Ocorrência",
};

export function publicStatus(s: string): { key: string; label: string } {
  switch (s) {
    case "preparing":
    case "awaiting_driver":
    case "created":
      return { key: "preparing", label: "Preparando para coleta" };
    case "driver_assigned":
      return { key: "driver_assigned", label: "Motorista confirmado" };
    case "en_route_pickup":
    case "in_transit_to_pickup":
    case "at_pickup":
      return { key: "en_route_pickup", label: "Motorista a caminho da coleta" };
    case "picked_up":
    case "loaded":
      return { key: "loaded", label: "Carga coletada" };
    case "out_for_delivery":
    case "in_transit":
      return { key: "in_transit", label: "Em trânsito" };
    case "near_destination":
      return { key: "near_destination", label: "Próximo ao destino" };
    case "delivered":
    case "finalized":
      return { key: "delivered", label: "Entregue" };
    case "incident":
      return { key: "incident", label: "Ocorrência" };
    case "cancelled":
      return { key: "cancelled", label: "Cancelado" };
    default:
      return { key: s, label: s };
  }
}

export const PUBLIC_TIMELINE = [
  { key: "preparing", label: "Preparando para coleta" },
  { key: "driver_assigned", label: "Motorista confirmado" },
  { key: "loaded", label: "Carga coletada" },
  { key: "in_transit", label: "Em trânsito" },
  { key: "near_destination", label: "Próximo ao destino" },
  { key: "delivered", label: "Entregue" },
];

export const OPS_CARDS: { key: string; label: string; statuses: string[] }[] = [
  { key: "preparing", label: "Preparando para coleta", statuses: ["preparing", "created"] },
  { key: "awaiting_driver", label: "Aguardando aceite do motorista", statuses: ["awaiting_driver"] },
  {
    key: "pickup",
    label: "Em coleta",
    statuses: ["driver_assigned", "en_route_pickup", "in_transit_to_pickup", "at_pickup"],
  },
  { key: "in_transit", label: "Em trânsito", statuses: ["picked_up", "loaded", "out_for_delivery", "in_transit"] },
  { key: "near_destination", label: "Próximos da entrega", statuses: ["near_destination"] },
  { key: "delivered", label: "Entregues hoje", statuses: ["delivered", "finalized"] },
  { key: "incident", label: "Ocorrências", statuses: ["incident"] },
];

export function trackingUrl(code: string): string {
  if (typeof window !== "undefined") return `${window.location.origin}/rastreio/${code}`;
  return `https://rastreio.infinitlog.com.br/${code}`;
}

export function shareMessage(code: string): string {
  const link = trackingUrl(code);
  return `Olá!

Seu frete foi cadastrado com sucesso na InfinitLog Transportes.

Código de rastreio:
${code}

Você pode acompanhar sua carga em tempo real através do link abaixo:
${link}

Obrigado por escolher a InfinitLog Transportes.`;
}
