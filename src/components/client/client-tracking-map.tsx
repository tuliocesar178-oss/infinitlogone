import { lazy, Suspense, useMemo } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useSelectedTrackingRoute } from "@/hooks/use-selected-tracking-route";
import { hasActiveDriverRoute, savedTrackingRoute, trackingPoint } from "@/lib/tracking-route-model";
import { relativeUpdate, type ClientTrackingOrder } from "@/lib/client-tracking";
import { statusLabel } from "@/lib/order-status";
import type { MapUnit } from "@/components/ops/tracking-map";

const TrackingMap = lazy(() => import("@/components/ops/tracking-map").then(m => ({ default: m.TrackingMap })));
export interface ClientTrackingMapProps {
  orders: ClientTrackingOrder[];
  selected: ClientTrackingOrder | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}
export function ClientTrackingMap({ orders, selected, onSelect, onClose }: ClientTrackingMapProps) {
  const route = useSelectedTrackingRoute(selected);
  const active = orders.filter(hasActiveDriverRoute);
  const units: MapUnit[] = active.flatMap(o => {
    const position = trackingPoint(o.current_lat, o.current_lng);
    return position ? [{ id: o.id, lng: position[0], lat: position[1], kind: "in_transit", title: o.driver?.name ?? "Motorista", subtitle: o.code, avatarUrl: o.driver?.photo_url, heading: o.tracking_heading, statusLabel: statusLabel(o.status) }] : [];
  });
  const routes = active.flatMap(o => {
    const geometry = o.id === selected?.id ? route.data?.planned ?? savedTrackingRoute(o) : savedTrackingRoute(o);
    return geometry ? [{ id: o.id, geometry }] : [];
  });
  const pins = useMemo(() => selected ? [
    { point: trackingPoint(selected.origin_lat, selected.origin_lng), color: "var(--success)", label: `Coleta: ${selected.origin_address}` },
    { point: trackingPoint(selected.destination_lat, selected.destination_lng), color: "var(--destructive)", label: `Entrega: ${selected.destination_address}` },
  ].flatMap(p => p.point ? [{ lng: p.point[0], lat: p.point[1], color: p.color, label: p.label }] : []) : [], [selected?.id, selected?.origin_lat, selected?.origin_lng, selected?.destination_lat, selected?.destination_lng]);
  return <div className="space-y-2">
    <section className="relative h-[360px] overflow-hidden rounded-lg border bg-secondary sm:h-[500px]" aria-label="Mapa do rastreamento">
      <ClientOnly fallback={<Loading />}><Suspense fallback={<Loading />}><TrackingMap units={units} routes={routes} pins={pins} planned={route.data?.approach} selectedId={selected?.id} onSelect={onSelect} className="h-full w-full" /></Suspense></ClientOnly>
      {selected && <Button className="absolute bottom-4 left-4" variant="outline" size="sm" onClick={onClose}><X />Fechar seleção</Button>}
    </section>
    {selected && <div className="space-y-1 text-xs text-muted-foreground" role="status">
      <p>Coleta: {selected.origin_address} · Entrega: {selected.destination_address}</p>
      <p>GPS: {relativeUpdate(selected.last_ping_at)}{selected.last_ping_at && Date.now() - Date.parse(selected.last_ping_at) > 180_000 ? " · Localização desatualizada" : ""}</p>
      {!trackingPoint(selected.current_lat, selected.current_lng) && <p>Posição atual não disponível.</p>}
      {route.isFetching && <p>Carregando trajeto…</p>}
      {(route.error || route.data?.unavailable) && <p className="text-warning">{route.error instanceof Error ? route.error.message : route.data?.unavailable}</p>}
      {!hasActiveDriverRoute(selected) && <p>Sem rota ativa atribuída a um motorista.</p>}
      {route.data?.distance != null && <p>Rota planejada: {route.data.distance.toLocaleString("pt-BR")} km · {route.data.stage === "pickup" ? "Etapa: coleta" : "Etapa: entrega"}</p>}
    </div>}
  </div>;
}
function Loading() { return <div className="grid h-full place-items-center text-muted-foreground">Carregando mapa…</div>; }