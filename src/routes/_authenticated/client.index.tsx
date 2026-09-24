import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, ChevronRight, Circle, Clock, MapPin, Package, Truck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DriverDetails, VehicleDetails } from "@/components/client/tracking-details";
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
import { PUBLIC_TIMELINE, publicStatus, statusLabel } from "@/lib/order-status";

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
  const { data: orders = [], isLoading, isError } = useQuery({
    queryKey,
    queryFn: async () => (await fetchOrders()) as ClientTrackingOrder[],
    refetchInterval: 15_000,
  });

  useEffect(() => {
    const refresh = () => void queryClient.invalidateQueries({ queryKey });
    const channel = supabase
      .channel("client-tracking-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, refresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_tracking_points" }, refresh)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [queryClient]);

  const activeOrders = useMemo(
    () => orders.filter((order) => !CLOSED_STATUSES.includes(order.status)),
    [orders],
  );
  const historyOrders = useMemo(
    () => orders.filter((order) => ["delivered", "finalized"].includes(order.status)),
    [orders],
  );
  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) ?? activeOrders[0] ?? null,
    [activeOrders, orders, selectedOrderId],
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
          {selectedOrder ? <SelectedTracking order={selectedOrder} /> : <NoSelection />}
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
      </div>
    </button>
  );
}

function SelectedTracking({ order }: { order: ClientTrackingOrder }) {
  const publicStep = publicStatus(order.status);
  const currentIdx = PUBLIC_TIMELINE.findIndex((step) => step.key === publicStep.key);
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
      </section>

      <section className="relative h-[360px] overflow-hidden rounded-lg border bg-secondary sm:h-[500px]" aria-label="Mapa do rastreamento">
        <TripMap
          className="h-full w-full"
          origin={point(order.origin_lat, order.origin_lng)}
          destination={point(order.destination_lat, order.destination_lng)}
          driver={point(order.current_lat, order.current_lng)}
          driverLabel={order.driver?.name}
          vehicleLabel={order.vehicle ? `${vehicleName(order.vehicle)} · ${order.vehicle.plate}` : null}
          interactive
        />
        <div className="absolute bottom-4 left-4 rounded-lg border bg-background/95 px-3 py-2 shadow-lg backdrop-blur">
          <p className="text-[10px] font-bold uppercase text-muted-foreground">Última atualização</p>
          <p className="mt-1 flex items-center gap-2 text-xs font-semibold"><span className="h-2 w-2 rounded-full bg-success" />{relativeUpdate(order.last_ping_at ?? order.updated_at)}</p>
        </div>
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <DriverDetails driver={order.driver} />
        <VehicleDetails vehicle={order.vehicle} />
      </div>

      <Timeline currentIdx={currentIdx} />

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

function Timeline({ currentIdx }: { currentIdx: number }) {
  return (
    <section className="card-soft p-5 sm:p-6">
      <div className="mb-6 flex items-center gap-2"><Clock className="h-4 w-4 text-brand" /><h2 className="text-sm font-bold uppercase">Linha do tempo da operação</h2></div>
      <ol className="grid gap-5 md:grid-cols-3 xl:grid-cols-6">
        {PUBLIC_TIMELINE.map((step, index) => {
          const done = currentIdx > index;
          const current = currentIdx === index;
          return (
            <li key={step.key} className="flex items-center gap-3 md:flex-col md:text-center">
              {done ? <CheckCircle2 className="h-6 w-6 text-success" /> : current ? <span className="grid h-6 w-6 place-items-center rounded-full border-2 border-brand"><span className="h-2 w-2 rounded-full bg-brand" /></span> : <Circle className="h-6 w-6 text-muted-foreground/40" />}
              <div><p className={`text-xs font-bold ${done || current ? "text-foreground" : "text-muted-foreground"}`}>{step.label}</p><p className="text-[10px] text-muted-foreground">{done ? "Concluído" : current ? "Em andamento" : "Pendente"}</p></div>
            </li>
          );
        })}
      </ol>
    </section>
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