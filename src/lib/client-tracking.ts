export interface TrackingDriver {
  id: string;
  name: string | null;
  photo_url: string | null;
  status: string | null;
  availability: string | null;
  license_category: string | null;
}

export interface TrackingVehicle {
  id: string;
  plate: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  vehicle_type: string | null;
  body_type: string | null;
  capacity_kg: number | null;
  axles: number | null;
  photo_url: string | null;
  photos: Array<{ url: string; label: string | null }>;
  status: string;
}

export interface ClientTrackingOrder {
  id: string;
  code: string;
  tracking_code: string;
  origin_address: string;
  destination_address: string;
  route_geometry: string | null;
  distance_km: number | null;
  tracking_heading?: number | null;
  status: string;
  driver_id: string | null;
  vehicle_id: string | null;
  origin_city: string | null;
  destination_city: string | null;
  origin_lat: number | null;
  origin_lng: number | null;
  destination_lat: number | null;
  destination_lng: number | null;
  current_lat: number | null;
  current_lng: number | null;
  distance_to_destination_km: number | null;
  eta_minutes: number | null;
  delivery_window_end: string | null;
  last_ping_at: string | null;
  created_at: string;
  updated_at: string;
  evidence_summary: { photos: number; documents: number };
  driver: TrackingDriver | null;
  vehicle: TrackingVehicle | null;
}

export const CLOSED_STATUSES = ["delivered", "finalized", "cancelled"];

export function vehicleName(vehicle: TrackingVehicle | null): string {
  if (!vehicle) return "Aguardando definição do veículo";
  return [vehicle.brand, vehicle.model].filter(Boolean).join(" ") || vehicle.vehicle_type || "Veículo";
}

export function driverStatusLabel(driver: TrackingDriver): string {
  const value = driver.availability ?? driver.status;
  const labels: Record<string, string> = {
    available: "Disponível",
    unavailable: "Indisponível",
    busy: "Em viagem",
    on_trip: "Em viagem",
    active: "Ativo",
    inactive: "Inativo",
    pending: "Cadastro em análise",
  };
  return value ? (labels[value] ?? "Status atualizado") : "Motorista confirmado";
}

export function relativeUpdate(value: string | null): string {
  if (!value) return "Localização ainda não recebida";
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Agora mesmo";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `Há ${hours} h`;
}