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
  created: "Preparando para Coleta",
  preparing: "Preparando para Coleta",
  awaiting_driver: "Aguardando Motorista",
  driver_assigned: "Motorista Confirmado",
  en_route_pickup: "Em Deslocamento para Coleta",
  in_transit_to_pickup: "Em Deslocamento para Coleta",
  at_pickup: "Cheguei na Coleta",
  loaded: "Carga Carregada",
  picked_up: "Saiu para Entrega",
  out_for_delivery: "Em Trânsito",
  in_transit: "Em Trânsito",
  near_destination: "Próximo da Entrega",
  delivered: "Entregue",
  completed: "Finalizado",
  finalized: "Finalizado",
  cancelled: "Cancelado",
  incident: "Ocorrência",
};

// Tailwind badge classes per status (background + text)
export const STATUS_BADGE_CLASS: Record<string, string> = {
  created: "bg-yellow-100 text-yellow-800",
  preparing: "bg-yellow-100 text-yellow-800",
  awaiting_driver: "bg-orange-100 text-orange-800",
  driver_assigned: "bg-blue-100 text-blue-800",
  en_route_pickup: "bg-blue-200 text-blue-900",
  in_transit_to_pickup: "bg-blue-200 text-blue-900",
  at_pickup: "bg-purple-100 text-purple-800",
  loaded: "bg-purple-200 text-purple-900",
  picked_up: "bg-blue-100 text-blue-800",
  out_for_delivery: "bg-blue-200 text-blue-900",
  in_transit: "bg-blue-200 text-blue-900",
  near_destination: "bg-green-100 text-green-700",
  delivered: "bg-green-200 text-green-800",
  completed: "bg-green-300 text-green-900",
  finalized: "bg-green-300 text-green-900",
  cancelled: "bg-red-100 text-red-700",
  incident: "bg-red-200 text-red-900",
};

export function statusLabel(s?: string | null): string {
  if (!s) return "—";
  return STATUS_LABEL[s] ?? "—";
}

export function statusBadgeClass(s?: string | null): string {
  if (!s) return "bg-muted text-muted-foreground";
  return STATUS_BADGE_CLASS[s] ?? "bg-muted text-muted-foreground";
}

// Options for status filter dropdowns — deduplicated, user-facing only.
export const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "preparing", label: "Preparando para Coleta" },
  { value: "awaiting_driver", label: "Aguardando Motorista" },
  { value: "driver_assigned", label: "Motorista Confirmado" },
  { value: "en_route_pickup", label: "Em Deslocamento para Coleta" },
  { value: "at_pickup", label: "Cheguei na Coleta" },
  { value: "loaded", label: "Carga Carregada" },
  { value: "picked_up", label: "Saiu para Entrega" },
  { value: "in_transit", label: "Em Trânsito" },
  { value: "near_destination", label: "Próximo da Entrega" },
  { value: "delivered", label: "Entregue" },
  { value: "finalized", label: "Finalizado" },
  { value: "cancelled", label: "Cancelado" },
  { value: "incident", label: "Ocorrência" },
];

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

export type DashboardCardKey =
  | "preparing"
  | "awaiting_driver"
  | "offer_sent"
  | "en_route_pickup"
  | "at_pickup"
  | "in_transit"
  | "near_destination"
  | "delivered_today"
  | "incident";

export const DASHBOARD_CARDS: {
  key: DashboardCardKey;
  label: string;
  short: string;
  statuses: string[];
  tint: string;
}[] = [
  { key: "preparing", label: "Preparando para coleta", short: "Preparando", statuses: ["preparing", "created"], tint: "sky" },
  { key: "awaiting_driver", label: "Aguardando motorista", short: "Aguardando", statuses: ["awaiting_driver"], tint: "amber" },
  { key: "offer_sent", label: "Oferta enviada", short: "Oferta enviada", statuses: ["awaiting_driver"], tint: "violet" },
  { key: "en_route_pickup", label: "Em deslocamento", short: "Em deslocamento", statuses: ["driver_assigned", "en_route_pickup", "in_transit_to_pickup"], tint: "blue" },
  { key: "at_pickup", label: "Em coleta", short: "Em coleta", statuses: ["at_pickup", "picked_up", "loaded"], tint: "indigo" },
  { key: "in_transit", label: "Em trânsito", short: "Em trânsito", statuses: ["out_for_delivery", "in_transit"], tint: "cyan" },
  { key: "near_destination", label: "Próximo da entrega", short: "Próximo", statuses: ["near_destination"], tint: "teal" },
  { key: "delivered_today", label: "Entregues hoje", short: "Entregues hoje", statuses: ["delivered", "finalized"], tint: "emerald" },
  { key: "incident", label: "Ocorrências", short: "Ocorrências", statuses: ["incident"], tint: "red" },
];

export const OPS_CARDS = DASHBOARD_CARDS.map((c) => ({ key: c.key, label: c.label, statuses: c.statuses }));

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
