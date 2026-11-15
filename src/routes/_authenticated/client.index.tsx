import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Camera, ChevronRight, FileText, MapPin, Package, Truck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DriverDetails, VehicleDetails } from "@/components/client/tracking-details";
import { TrackingEvidence } from "@/components/client/tracking-evidence";
import { ShareTracking } from "@/components/share-tracking";
import { TripMap } from "@/components/trip-map";
import { supabase } from "@/integrations/supabase/client";
import { getClientTrackingOrders } from "@/lib/client-tracking.functions";
import {
  CLOSED_STATUSES,
  relativeUpdate,
  vehicleName,
  type ClientTrackingOrder,
} from "@/lib/client-tracking";
import { statusLabel } from "@/lib/order-status";

export const Route = createFileRoute("/_authenticated/client/")({
  head: () => ({
    meta: [
      { title: "Rastreamento de entregas — InfinitLog" },
      { name: "description", content: "Acompanhe suas entregas, motoristas e veículos em tempo real." },
      { property: "og:title", content: "Rastreamento de entregas — InfinitLog" },
      { property: "og:description", content: "Acompanhe suas entregas, motoristas e veículos em tempo real." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ClientTrackingHome,
});

function ClientTrackingHome() {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const fetchOrders = useServerFn(getClientTrackingOrders);
  const queryKey = ["client-tracking-orders"] as const;
  const [livePoints, setLivePoints] = useState<Record<string, {
    lat: number;
    lng: number;
    speed: number | null;
    heading: number | null;
    accuracy: number | null;
    created_at: string;
  }>>({});
  const { data: orders = [], isLoading, isError } = useQuery({
    queryKey,
    queryFn: async () => (await fetchOrders()) as ClientTrackingOrder[],
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const refresh = () => void queryClient.invalidateQueries({ queryKey });
    const channel = supabase
      .channel("client-tracking-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, refresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_tracking_points" }, (payload) => {
        const point = payload.new as {
          order_id: string;
          lat: number;
          lng: number;
          speed: number | null;
          heading: number | null;
          accuracy: number | null;
          created_at: string;
        };
        const authorizedOrders = queryClient.getQueryData<ClientTrackingOrder[]>(queryKey) ?? [];
        if (!authorizedOrders.some((order) => order.id === point.order_id)) return;
        setLivePoints((previous) => ({
          ...previous,
          [point.order_id]: {
            lat: point.lat,
            lng: point.lng,
            speed: point.speed,
            heading: point.heading,
            accuracy: point.accuracy,
            created_at: point.created_at,
          },
        }));
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [queryClient]);

  const activeOrders = useMemo(
    () => orders.filter((order) => !CLOSED_STATUSES.includes(order.status)),
    [orders],
  );
  const historyOrders = useMemo(
    () => orders.filter((order) => ["delivered", "finalized", "completed"].includes(order.status)),
    [orders],
  );
  const selectedOrder = useMemo(
    () => activeOrders.find((order) => order.id === selectedOrderId) ?? activeOrders[0] ?? null,
    [activeOrders, selectedOrderId],
  );

  if (isLoading) return <TrackingLoading />;
  if (isError) return <TrackingError />;
  if (orders.length === 0) return <TrackingEmpty />;

  return (
    <AppShell title="Rastreamento" subtitle={selectedOrder ? `Acompanhando ${selectedOrder.code}` : "Selecione uma entrega"}>
      <div className="grid min-w-0 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="min-w-0 space-y-7">
          <div className="rounded-lg bg-primary p-5 text-primary-foreground">
            <h2 className="text-lg font-bold">Olá, Cliente</h2>
            <p className="mt-1 text-sm text-primary-foreground/80">Suas entregas em tempo real</p>
          </div>

          <section aria-labelledby="active-orders-heading">
            <h2 id="active-orders-heading" className="mb-3 px-1 text-xs font-bold uppercase text-muted-foreground">Entregas ativas</h2>
            <div className="max-h-[470px] space-y-2 overflow-y-auto pr-1">
              {activeOrders.map((order) => (
                <ActiveOrderButton
                  key={order.id}
                  order={order}
                  selected={selectedOrder?.id === order.id}
                  onSelect={() => setSelectedOrderId(order.id)}
                />
              ))}
              {activeOrders.length === 0 && (
                <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">Nenhuma entrega ativa no momento.</p>
              )}
            </div>
          </section>

          <section aria-labelledby="history-heading">
            <h2 id="history-heading" className="mb-3 px-1 text-xs font-bold uppercase text-muted-foreground">Histórico recente</h2>
            <div className="space-y-2">
              {historyOrders.slice(0, 3).map((order) => (
                <div key={order.id} className="flex items-center justify-between rounded-lg border bg-card p-3 text-xs">
                  <span className="font-bold">{order.code}</span>
                  <span className="font-semibold text-success">Entregue</span>
                </div>
              ))}
              {historyOrders.length === 0 && <p className="px-1 text-xs text-muted-foreground">Nenhum frete concluído.</p>}
            </div>
          </section>
        </aside>

        <main className="min-w-0 space-y-6">
          {selectedOrder ? <SelectedTracking order={selectedOrder} live={livePoints[selectedOrder.id] ?? null} /> : <NoSelection />}
        </main>
      </div>
    </AppShell>
  );
}

function ActiveOrderButton({ order, selected, onSelect }: { order: ClientTrackingOrder; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`w-full rounded-lg border bg-card p-4 text-left shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected ? "border-brand ring-1 ring-brand" : "hover:border-brand/50"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-bold">{order.code}</span>
        <span className="rounded-full bg-brand/10 px-2 py-1 text-[10px] font-bold uppercase text-brand">{statusLabel(order.status)}</span>
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <MapPin className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{order.origin_city ?? "Origem"}</span><ChevronRight className="h-3 w-3 shrink-0" />
        <span className="truncate">{order.destination_city ?? "Destino"}</span>
      </div>
      <div className="mt-4 border-t pt-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="h-2 w-2 rounded-full bg-success" />
          <span className="font-semibold">{order.driver ? "Motorista confirmado" : "Aguardando motorista"}</span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span className="truncate">{order.driver?.name ?? "A definir"}</span>
          <span className="truncate font-mono">{order.vehicle ? `${vehicleName(order.vehicle)} · ${order.vehicle.plate}` : "Veículo a definir"}</span>
        </div>
        {(order.evidence_summary.photos > 0 || order.evidence_summary.documents > 0) && (
          <div className="mt-3 flex flex-wrap gap-3 text-xs font-medium text-muted-foreground">
            {order.evidence_summary.photos > 0 && <span className="flex items-center gap-1"><Camera className="h-3.5 w-3.5" />{order.evidence_summary.photos} foto(s)</span>}
            {order.evidence_summary.documents > 0 && <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" />{order.evidence_summary.documents} documento(s)</span>}
          </div>
        )}
      </div>
    </button>
  );
}

function SelectedTracking({
  order,
  live,
}: {
  order: ClientTrackingOrder;
  live: { lat: number; lng: number; speed: number | null; heading: number | null; accuracy: number | null; created_at: string } | null;
}) {
  const eta = order.eta_minutes != null ? `~${order.eta_minutes} min` : order.delivery_window_end
    ? format(new Date(order.delivery_window_end), "HH:mm 'de' dd/MM", { locale: ptBR })
    : "Sob consulta";

  return (
    <>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumo do frete">
        <Metric label="Status" value={statusLabel(order.status)} highlight />
        <Metric label="Previsão" value={eta} />
        <Metric label="Distância restante" value={order.distance_to_destination_km != null ? `${order.distance_to_destination_km.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km` : "Sob consulta"} />
        <Metric label="Motorista" value={order.driver?.name ?? "Aguardando definição"} />
        <Metric label="Velocidade" value={live?.speed != null ? `${Math.round(live.speed)} km/h` : "Indisponível"} />
      </section>

      <section className="relative h-[360px] overflow-hidden rounded-lg border bg-secondary sm:h-[500px]" aria-label="Mapa do rastreamento">
        <TripMap
          className="h-full w-full"
          origin={point(order.origin_lat, order.origin_lng)}
          destination={point(order.destination_lat, order.destination_lng)}
          driver={point(live?.lat ?? order.current_lat, live?.lng ?? order.current_lng)}
          driverLabel={order.driver?.name}
          vehicleLabel={order.vehicle ? `${vehicleName(order.vehicle)} · ${order.vehicle.plate}` : null}
          driverHeading={live?.heading}
          interactive
        />
        <div className="absolute bottom-4 left-4 rounded-lg border bg-background/95 px-3 py-2 shadow-lg backdrop-blur">
          <p className="text-[10px] font-bold uppercase text-muted-foreground">Última atualização</p>
          <p className="mt-1 flex items-center gap-2 text-xs font-semibold"><span className={`h-2 w-2 rounded-full ${live ? "bg-success" : "bg-warning"}`} />{relativeUpdate(live?.created_at ?? order.last_ping_at ?? order.updated_at)}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Precisão GPS: {live?.accuracy != null ? `±${Math.round(live.accuracy)} m` : "indisponível"}</p>
        </div>
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <DriverDetails driver={order.driver} />
        <VehicleDetails vehicle={order.vehicle} />
      </div>

      <TrackingEvidence orderId={order.id} currentStatus={order.status} />

      <section className="card-soft p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Package className="h-5 w-5 text-brand" />
          <h2 className="text-sm font-bold uppercase text-muted-foreground">Compartilhar rastreamento</h2>
        </div>
        <ShareTracking code={order.tracking_code} />
      </section>
    </>
  );
}

function Metric({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="card-soft min-h-24 p-4">
      <p className="text-[10px] font-bold uppercase text-muted-foreground">{label}</p>
      <p className={`mt-2 break-words text-sm font-bold ${highlight ? "text-brand" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function point(lat: number | null, lng: number | null) {
  return lat != null && lng != null ? { lat, lng } : null;
}

function TrackingLoading() {
  return <AppShell title="Rastreamento" subtitle="Carregando suas entregas..."><div className="grid h-[60vh] place-items-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div></AppShell>;
}

function TrackingError() {
  return <AppShell title="Rastreamento" subtitle="Não foi possível carregar"><div className="card-soft p-10 text-center"><h2 className="text-lg font-semibold">Falha ao carregar suas entregas</h2><p className="mt-2 text-sm text-muted-foreground">Tente novamente em alguns instantes.</p></div></AppShell>;
}

function TrackingEmpty() {
  return <AppShell title="Rastreamento" subtitle="Bem-vindo ao seu portal"><div className="flex flex-col items-center justify-center py-20 text-center"><div className="mb-6 rounded-full bg-secondary p-6"><Package className="h-12 w-12 text-muted-foreground" /></div><h2 className="text-2xl font-bold">Nenhum frete encontrado</h2><p className="mt-2 max-w-sm text-muted-foreground">Você ainda não possui entregas cadastradas no sistema.</p></div></AppShell>;
}

function NoSelection() {
  return <div className="card-soft flex min-h-96 flex-col items-center justify-center border-dashed p-10 text-center"><Truck className="mb-4 h-12 w-12 text-muted-foreground" /><h2 className="text-lg font-semibold">Selecione uma entrega</h2><p className="mt-2 text-sm text-muted-foreground">Escolha um frete ativo para ver o rastreamento detalhado.</p></div>;
}