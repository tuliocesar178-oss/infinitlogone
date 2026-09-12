import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, MapPinned, Package, Radar, Truck, UserRoundSearch } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getUserRolesCached } from "@/lib/roles";
import { FleetMap, type FleetVehicle } from "@/components/fleet-map";
import { BoardHeader } from "@/components/operation-board/board-header";
import { FreightCard } from "@/components/operation-board/freight-card";
import { Button } from "@/components/ui/button";
import {
  ACTIVE_STATUSES, DELIVERED_STATUSES, NEAR_STATUSES, PICKUP_STATUSES, TRANSIT_STATUSES,
  isLate, isToday, matchesFilter, priority, type BoardFilter, type BoardOrder, type BoardView,
} from "@/lib/operation-board";

const ALLOWED_ROLES = ["admin", "logistics", "supervisor", "operacional"];
const VIEWS: BoardView[] = ["live", "incident", "late", "map", "delivered"];
const FILTERS: { value: BoardFilter; label: string }[] = [
  { value: "live", label: "Operação ao vivo" }, { value: "all", label: "Todos" },
  { value: "awaiting", label: "Aguardando motorista" }, { value: "pickup", label: "Em coleta" },
  { value: "transit", label: "Em viagem" }, { value: "near", label: "Próximos do destino" },
  { value: "delivered", label: "Entregues hoje" }, { value: "late", label: "Atrasados" },
  { value: "incident", label: "Com ocorrência" },
];

export const Route = createFileRoute("/_authenticated/painel-operacao")({
  beforeLoad: async ({ context }) => {
    const user = (context as { user?: { id: string } }).user;
    if (!user) throw redirect({ to: "/auth" });
    const roles = await getUserRolesCached(user.id);
    if (!roles.some((role) => ALLOWED_ROLES.includes(role))) throw redirect({ to: "/" });
  },
  head: () => ({ meta: [
    { title: "Painel de Operação — InfinitLog" },
    { name: "description", content: "Mural operacional em tempo real dos fretes da InfinitLog." },
    { property: "og:title", content: "Painel de Operação — InfinitLog" },
    { property: "og:description", content: "Acompanhamento visual da operação logística em tempo real." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: OperationBoard,
});

function OperationBoard() {
  const qc = useQueryClient();
  const [now, setNow] = useState(new Date());
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [fullscreen, setFullscreen] = useState(false);
  const [rotation, setRotation] = useState(false);
  const [interval, setIntervalSeconds] = useState(30);
  const [view, setView] = useState<BoardView>("live");
  const [filter, setFilter] = useState<BoardFilter>("live");
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");

  const query = useQuery({
    queryKey: ["operation-board"],
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data: orders, error } = await supabase.from("orders").select("*, vehicle:vehicles(id, plate, model, brand, current_lat, current_lng, status)").is("deleted_at", null).order("updated_at", { ascending: false });
      if (error) throw error;
      const driverIds = Array.from(new Set((orders ?? []).map((order) => order.driver_id).filter((id): id is string => Boolean(id))));
      const orderIds = (orders ?? []).map((order) => order.id);
      const [{ data: profiles }, { data: incidents }] = await Promise.all([
        driverIds.length ? supabase.from("profiles").select("id, full_name, phone").in("id", driverIds) : Promise.resolve({ data: [], error: null }),
        orderIds.length ? supabase.from("incidents").select("id, order_id, type, description, severity, created_at").in("order_id", orderIds).is("resolved_at", null).order("created_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
      ]);
      const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
      const incidentMap = new Map<string, NonNullable<typeof incidents>[number]>();
      for (const incident of incidents ?? []) if (!incidentMap.has(incident.order_id)) incidentMap.set(incident.order_id, incident);
      setLastUpdated(new Date());
      return (orders ?? []).map((order) => ({ ...order, driver: order.driver_id ? profileMap.get(order.driver_id) ?? null : null, vehicle: order.vehicle ?? null, incident: incidentMap.get(order.id) ?? null })) as BoardOrder[];
    },
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1_000);
    const channel = supabase.channel("operation-board-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => qc.invalidateQueries({ queryKey: ["operation-board"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "vehicles" }, () => qc.invalidateQueries({ queryKey: ["operation-board"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "incidents" }, () => qc.invalidateQueries({ queryKey: ["operation-board"] }))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "driver_locations" }, () => qc.invalidateQueries({ queryKey: ["operation-board"] }))
      .subscribe();
    const onFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => { window.clearInterval(timer); document.removeEventListener("fullscreenchange", onFullscreen); supabase.removeChannel(channel); };
  }, [qc]);

  useEffect(() => {
    if (!rotation) return;
    const timer = window.setInterval(() => setView((current) => VIEWS[(VIEWS.indexOf(current) + 1) % VIEWS.length]), interval * 1_000);
    return () => window.clearInterval(timer);
  }, [rotation, interval]);

  const orders = query.data ?? [];
  const deliveredToday = orders.filter((order) => DELIVERED_STATUSES.includes(order.status) && isToday(order.completed_at ?? order.updated_at));
  const visible = useMemo(() => {
    const q = search.toLocaleLowerCase("pt-BR").trim();
    return orders.filter((order) => {
      const effectiveFilter: BoardFilter = view === "incident" ? "incident" : view === "late" ? "late" : view === "delivered" ? "delivered" : filter;
      if (!matchesFilter(order, effectiveFilter)) return false;
      if (date && new Date(order.created_at).toLocaleDateString("en-CA") !== date) return false;
      if (!q) return true;
      return `${order.code} ${order.client_name ?? ""} ${order.driver?.full_name ?? ""} ${order.vehicle?.plate ?? ""} ${order.origin_city ?? ""} ${order.destination_city ?? ""} ${order.origin_state ?? ""} ${order.destination_state ?? ""}`.toLocaleLowerCase("pt-BR").includes(q);
    }).sort((a, b) => priority(a) - priority(b) || new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }, [orders, filter, view, search, date]);

  const fleet: FleetVehicle[] = visible.filter((order) => Number.isFinite(order.current_lat ?? order.vehicle?.current_lat) && Number.isFinite(order.current_lng ?? order.vehicle?.current_lng)).map((order) => ({
    id: order.vehicle?.id ?? order.id, plate: order.vehicle?.plate ?? "Sem placa", model: [order.vehicle?.brand, order.vehicle?.model].filter(Boolean).join(" ") || null,
    status: order.vehicle?.status ?? order.status, lat: order.current_lat ?? order.vehicle?.current_lat ?? 0, lng: order.current_lng ?? order.vehicle?.current_lng ?? 0,
    driverName: order.driver?.full_name, order: { id: order.id, tracking_code: order.tracking_code, client_name: order.client_name, origin_city: order.origin_city, destination_city: order.destination_city, status: order.status, eta_minutes: order.eta_minutes, distance_km: order.distance_to_destination_km, initial_distance_km: order.initial_distance_km, last_ping_at: order.last_ping_at },
  }));

  const stats = [
    { label: "Fretes hoje", value: orders.filter((o) => isToday(o.created_at)).length, icon: Package },
    { label: "Em operação", value: orders.filter((o) => ACTIVE_STATUSES.includes(o.status)).length, icon: Radar },
    { label: "Aguardando motorista", value: orders.filter((o) => o.status === "awaiting_driver").length, icon: UserRoundSearch },
    { label: "Em coleta", value: orders.filter((o) => PICKUP_STATUSES.includes(o.status)).length, icon: Package },
    { label: "Em viagem", value: orders.filter((o) => TRANSIT_STATUSES.includes(o.status)).length, icon: Truck },
    { label: "Próximos do destino", value: orders.filter((o) => NEAR_STATUSES.includes(o.status)).length, icon: MapPinned },
    { label: "Entregues", value: deliveredToday.length, icon: CheckCircle2 },
    { label: "Ocorrências", value: orders.filter((o) => o.incident || o.status === "incident").length, icon: AlertTriangle },
  ];

  async function toggleFullscreen() {
    if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen();
  }

  return <div className="min-h-screen bg-background text-foreground">
    <BoardHeader now={now} updatedSeconds={Math.max(0, Math.floor((now.getTime() - lastUpdated.getTime()) / 1000))} fullscreen={fullscreen} rotation={rotation} interval={interval} onFullscreen={toggleFullscreen} onRotation={setRotation} onInterval={setIntervalSeconds} />
    <main className="space-y-5 p-4 lg:p-6">
      <section className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8" aria-label="Indicadores operacionais">
        {stats.map((stat) => <div key={stat.label} className="border border-border bg-card p-3"><div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground"><stat.icon className="h-4 w-4 text-brand" />{stat.label}</div><p className="mt-2 text-3xl font-bold tabular-nums">{stat.value}</p></div>)}
      </section>
      <section className="flex flex-wrap gap-2 border-y border-border py-3">
        <select aria-label="Filtrar situação" value={filter} onChange={(event) => { setFilter(event.target.value as BoardFilter); setView("live"); }} className="h-10 rounded-md border border-input bg-background px-3 text-sm">{FILTERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
        <input aria-label="Buscar frete" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cliente, motorista, cidade, placa..." className="h-10 min-w-64 flex-1 rounded-md border border-input bg-background px-3 text-sm" />
        <input aria-label="Filtrar por data" type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm" />
        {VIEWS.map((item) => <Button key={item} variant={view === item ? "default" : "outline"} size="sm" onClick={() => setView(item)}>{item === "live" ? "Ao vivo" : item === "incident" ? "Ocorrências" : item === "late" ? "Atrasados" : item === "map" ? "Mapa" : "Entregues"}</Button>)}
      </section>
      {query.isError && <div className="border border-destructive bg-destructive/10 p-5 text-destructive">Não foi possível atualizar o painel. A próxima tentativa será automática.</div>}
      {view === "map" ? <section><FleetMap vehicles={fleet} className="h-[calc(100vh-280px)] min-h-[420px] overflow-hidden border border-border" />{fleet.length === 0 && <p className="mt-3 text-center text-muted-foreground">Nenhum veículo com posição real disponível.</p>}</section> :
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visible.map((order) => <FreightCard key={order.id} order={order} />)}
          {!query.isLoading && visible.length === 0 && <div className="col-span-full grid min-h-64 place-items-center border border-dashed border-border text-center"><div><Truck className="mx-auto h-10 w-10 text-muted-foreground" /><p className="mt-3 text-lg font-semibold">Não existem fretes nesta visualização.</p>{view === "incident" && <p className="mt-1 text-success">Nenhuma ocorrência ativa.</p>}</div></div>}
        </section>}
      <section className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"><div><p className="text-xs font-semibold uppercase text-muted-foreground">Entregas concluídas hoje</p><p className="text-2xl font-bold">{deliveredToday.length}</p></div>{deliveredToday[0] && <p className="text-sm text-muted-foreground">Última entrega: <b className="text-foreground">#{deliveredToday[0].code}</b> · {deliveredToday[0].driver?.full_name || "Motorista não informado"} · {deliveredToday[0].client_name || "Cliente não informado"} · {new Date(deliveredToday[0].completed_at ?? deliveredToday[0].updated_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>}</section>
    </main>
  </div>;
}