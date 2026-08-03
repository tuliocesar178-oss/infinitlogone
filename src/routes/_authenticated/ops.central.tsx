import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { 
  Truck, Clock, Package, CheckCircle2, 
  AlertTriangle, Navigation, Map as MapIcon, 
  Users, ChevronRight, Search, Maximize2,
  MoreVertical, Share2, MessageSquare, Plus,
  DollarSign, Activity, TrendingUp, TrendingDown,
  Layout, MapPin
} from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { STATUS_LABEL, STATUS_BADGE_CLASS, OrderStatus } from "@/lib/order-status";
import { toast } from "sonner";
import { OrderDrawer } from "@/components/ops/order-drawer";
import { formatBRL } from "@/lib/ops-central";
import { DRIVER_COLUMNS } from "@/lib/driver-columns";

export const Route = createFileRoute("/_authenticated/ops/central")({
  head: () => ({
    meta: [
      { title: "🗼 Torre de Controle — InfinitLog" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TorreDeControle,
});

const KANBAN_COLUMNS: { id: OrderStatus; title: string }[] = [
  { id: "planning", title: "Planejamento" },
  { id: "preparing", title: "Preparando Coleta" },
  { id: "awaiting_driver", title: "Aguardando Motorista" },
  { id: "negotiating", title: "Em Negociação" },
  { id: "driver_assigned", title: "Motorista Confirmado" },
  { id: "en_route_pickup", title: "Em Deslocamento" },
  { id: "at_pickup", title: "Na Coleta" },
  { id: "loaded", title: "Carregada" },
  { id: "in_transit", title: "Em Trânsito" },
  { id: "at_destination", title: "No Destino" },
  { id: "delivered", title: "Entregue" },
  { id: "incident", title: "Ocorrência" },
];

function TorreDeControle() {
  const qc = useQueryClient();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isTvMode, setIsTvMode] = useState(false);

  const ordersQ = useQuery({
    queryKey: ["torre-orders"],
    queryFn: async () => {
      const { data: orders, error } = await supabase
        .from("orders")
        .select(`
          *,
          vehicle:vehicles(id, plate, model, photo_url)
        `)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      
      if (error) throw error;

      const driverIds = orders.map(o => o.driver_id).filter((id): id is string => !!id);
      let driversMap: Record<string, any> = {};
      
      if (driverIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, phone")
          .in("id", driverIds);
        
        if (profiles) {
          driversMap = profiles.reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
        }
      }

      return orders.map(o => ({
        ...o,
        driver: o.driver_id ? driversMap[o.driver_id] : null
      }));
    },
    refetchInterval: 10000,
  });

  const driversQ = useQuery({
    queryKey: ["torre-drivers"],
    queryFn: async () => {
      const { data: drivers, error } = await supabase
        .from("drivers")
        .select(DRIVER_COLUMNS)
        .not("status", "in", "(offline)"); // Filter at the query level for efficiency
      
      if (error) throw error;
      if (!drivers.length) return [];

      const userIds = drivers.map(d => d.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);
      
      const profilesMap = (profiles || []).reduce((acc, p) => ({ ...acc, [p.id]: p }), {} as Record<string, any>);

      return drivers.map(d => ({
        ...d,
        profile: profilesMap[d.user_id]
      }));
    },
    refetchInterval: 5000, // Faster refetch for online status visibility
  });

  useEffect(() => {
    const ch = supabase.channel("torre-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => qc.invalidateQueries({ queryKey: ["torre-orders"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "drivers" }, () => qc.invalidateQueries({ queryKey: ["torre-drivers"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const orders = ordersQ.data || [];
  const drivers = driversQ.data || [];

  const filteredOrders = useMemo(() => {
    if (!searchTerm) return orders;
    const s = searchTerm.toLowerCase();
    return orders.filter(o => 
      o.code?.toLowerCase().includes(s) || 
      o.client_name?.toLowerCase().includes(s) ||
      o.driver?.full_name?.toLowerCase().includes(s) ||
      o.vehicle?.plate?.toLowerCase().includes(s)
    );
  }, [orders, searchTerm]);

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const orderId = draggableId;
    const newStatus = destination.droppableId as OrderStatus;

    try {
      const { error } = await supabase.from("orders").update({ status: newStatus }).eq("id", orderId);
      if (error) throw error;
      toast.success(`Status de ${draggableId} atualizado para ${STATUS_LABEL[newStatus]}`);
      qc.invalidateQueries({ queryKey: ["torre-orders"] });
    } catch (err) {
      toast.error("Erro ao atualizar status");
    }
  };

  const kpis = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const ordersToday = orders.filter(o => o.created_at.startsWith(today));
    const inTransit = orders.filter(o => ["en_route_pickup", "in_transit", "loaded"].includes(o.status));
    const incidents = orders.filter(o => o.status === "incident");
    
    return [
      { label: "Pedidos Hoje", value: ordersToday.length, icon: Package, tint: "bg-blue-500/10 text-blue-600" },
      { label: "Em Trânsito", value: inTransit.length, icon: Truck, tint: "bg-orange-500/10 text-orange-600" },
      { label: "Ocorrências", value: incidents.length, icon: AlertTriangle, tint: "bg-red-500/10 text-red-600" },
      { label: "Motoristas Online", value: drivers.filter(d => d.status !== "offline").length, icon: Users, tint: "bg-emerald-500/10 text-emerald-600" },
    ];
  }, [orders, drivers]);

  return (
    <AppShell 
      title="🗼 Torre de Controle" 
      subtitle="Monitoramento operacional 360° em tempo real"
      actions={
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar frete, placa, motorista..." 
              className="h-10 w-64 rounded-xl border border-border bg-surface pl-10 pr-4 text-sm outline-none focus:border-brand"
            />
          </div>
          <button 
            onClick={() => setIsTvMode(!isTvMode)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface text-muted-foreground hover:bg-accent"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <Link to="/ops/pedidos/novo" className="flex h-10 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground hover:opacity-90">
            <Plus className="h-4 w-4" /> Novo Frete
          </Link>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        {/* KPI Bar */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {kpis.map((kpi, i) => (
            <div key={i} className="card-soft flex items-center gap-4 p-5">
              <div className={`grid h-12 w-12 place-items-center rounded-2xl ${kpi.tint}`}>
                <kpi.icon className="h-6 w-6" />
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{kpi.label}</div>
                <div className="text-2xl font-bold tabular-nums">{kpi.value}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Kanban Board */}
          <div className="min-w-0 overflow-x-auto pb-4">
            <DragDropContext onDragEnd={onDragEnd}>
              <div className="flex gap-4 min-w-max h-[calc(100vh-320px)]">
                {KANBAN_COLUMNS.map((col) => (
                  <Droppable key={col.id} droppableId={col.id}>
                    {(provided) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className="w-72 shrink-0 flex flex-col rounded-2xl bg-surface-2/40 border border-border/40"
                      >
                        <div className="flex items-center justify-between p-4 pb-2">
                          <h3 className="text-sm font-semibold tracking-tight flex items-center gap-2">
                            {col.title}
                            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-muted-foreground">
                              {filteredOrders.filter(o => o.status === col.id).length}
                            </span>
                          </h3>
                        </div>
                        <div className="flex-1 space-y-3 overflow-y-auto p-3 scrollbar-hide">
                          {filteredOrders
                            .filter((o) => o.status === col.id)
                            .map((order, index) => (
                              <Draggable key={order.id} draggableId={order.id} index={index}>
                                {(provided) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    onClick={() => setSelectedOrderId(order.id)}
                                    className="card-soft group cursor-pointer border border-border/40 bg-surface p-4 shadow-sm transition hover:border-brand/40 hover:shadow-md"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="font-mono text-xs font-bold text-brand">{order.code}</div>
                                      <div className={`h-2 w-2 rounded-full ${order.priority === 'urgent' ? 'bg-red-500 animate-pulse' : 'bg-brand'}`} />
                                    </div>
                                    <div className="mt-2 text-sm font-semibold truncate">{order.client_name}</div>
                                    <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-tight truncate">
                                      <MapPin className="h-3 w-3" />
                                      {order.origin_city} → {order.destination_city}
                                    </div>
                                    
                                    {order.driver && (
                                      <div className="mt-4 flex items-center gap-2 pt-3 border-t border-border/40">
                                        <div className="h-6 w-6 rounded-full bg-surface-2 overflow-hidden flex items-center justify-center text-[10px] font-bold">
                                          {order.driver.full_name?.charAt(0)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="text-[10px] font-semibold truncate">{order.driver.full_name}</div>
                                          <div className="text-[9px] text-muted-foreground uppercase">{order.vehicle?.plate}</div>
                                        </div>
                                      </div>
                                    )}

                                    <div className="mt-3 flex items-center justify-between">
                                      <div className="flex gap-1.5">
                                        {order.cargo_weight_kg && (
                                          <div className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                                            {order.cargo_weight_kg}kg
                                          </div>
                                        )}
                                      </div>
                                      <div className="text-[10px] font-bold text-emerald-600">
                                        {order.price ? formatBRL(order.price) : '—'}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                          {provided.placeholder}
                        </div>
                      </div>
                    )}
                  </Droppable>
                ))}
              </div>
            </DragDropContext>
          </div>

          {/* Sidebar Panels */}
          <div className="space-y-6 overflow-y-auto max-h-[calc(100vh-200px)] pr-2">
            <section className="card-soft p-5">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Motoristas Online</h3>
              <div className="space-y-3">
                {drivers.filter(d => d.status !== 'offline').map(driver => (
                  <div key={driver.user_id} className="flex items-center gap-3">
                    <div className="relative h-10 w-10 shrink-0">
                      <div className="h-full w-full rounded-full bg-surface-2 flex items-center justify-center font-bold">
                        {driver.profile?.full_name?.charAt(0)}
                      </div>
                      <div className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-surface ${driver.availability === 'disponivel' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold truncate">{driver.profile?.full_name}</div>
                      <div className="text-[10px] text-muted-foreground uppercase">{driver.city || 'Localizando...'}</div>
                    </div>
                    <div className="text-[10px] font-mono font-medium text-muted-foreground">
                      {driver.status === 'on_trip' ? '🚗' : '🟢'}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="card-soft p-5 bg-brand/5 border-brand/20">
              <h3 className="text-xs font-bold uppercase tracking-widest text-brand mb-4 flex items-center gap-2">
                <TrendingUp className="h-3 w-3" /> Sugestão de Despacho
              </h3>
              <div className="text-xs text-muted-foreground mb-4">
                Motoristas ideais para novos fretes baseados em proximidade e veículo.
              </div>
              <div className="rounded-xl bg-surface p-3 text-center text-xs text-muted-foreground border border-dashed border-border">
                Aguardando novos fretes em planejamento...
              </div>
            </section>
          </div>
        </div>
      </div>

      {selectedOrderId && (
        <OrderDrawer 
          orderId={selectedOrderId} 
          onClose={() => setSelectedOrderId(null)} 
        />
      )}
    </AppShell>
  );
}
