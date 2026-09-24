import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { 
  MapPin, 
  Truck, 
  Clock, 
  Navigation,
  CheckCircle2,
  Circle,
  Package,
  Calendar,
  ChevronRight,
  Share2,
  User,
  Info
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { TripMap } from "@/components/trip-map";
import { statusLabel, STATUS_LABEL, publicStatus, PUBLIC_TIMELINE } from "@/lib/order-status";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { ShareTracking } from "@/components/share-tracking";

export const Route = createFileRoute("/_authenticated/client/")({
  component: ClientTrackingHome,
});

function ClientTrackingHome() {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  
  const { data: orders, isLoading } = useQuery({
    queryKey: ["client-active-tracking-orders"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data } = await supabase
        .from("orders")
        .select(`
          *,
          vehicle:vehicles(
            id,
            plate,
            brand,
            model,
            year,
            color,
            vehicle_type,
            body_type,
            capacity_kg,
            axles,
            photo_url
          )
        `)
        .eq("client_id", user.id)
        .order("created_at", { ascending: false });
      
      if (!data) return [];

      // Fetch driver profiles manually to avoid relation errors
      const driverIds = [...new Set(data.map(o => o.driver_id).filter(Boolean))] as string[];
      let driversMap: Record<string, any> = {};
      
      if (driverIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url, phone")
          .in("id", driverIds);
        
        profiles?.forEach(p => {
          driversMap[p.id] = p;
        });
      }

      return data.map(order => ({
        ...order,
        driver: order.driver_id ? driversMap[order.driver_id] : null
      }));
    },
    refetchInterval: 10000
  });

  const activeOrders = useMemo(() => 
    orders?.filter(o => !["delivered", "finalized", "cancelled"].includes(o.status)) || []
  , [orders]);

  const historyOrders = useMemo(() => 
    orders?.filter(o => ["delivered", "finalized"].includes(o.status)) || []
  , [orders]);

  // Se houver apenas um frete ativo e nenhum selecionado, seleciona ele automaticamente
  useEffect(() => {
    if (activeOrders.length === 1 && !selectedOrderId) {
      setSelectedOrderId(activeOrders[0].id);
    }
  }, [activeOrders, selectedOrderId]);

  const selectedOrder = useMemo(() => {
    if (!orders) return null;
    return orders.find(o => o.id === selectedOrderId) || activeOrders[0] || null;
  }, [orders, selectedOrderId, activeOrders]);

  if (isLoading) {
    return (
      <AppShell title="Rastreamento" subtitle="Carregando suas entregas...">
        <div className="flex h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AppShell>
    );
  }

  if (orders?.length === 0) {
    return (
      <AppShell title="Rastreamento" subtitle="Bem-vindo ao seu portal">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-6 rounded-full bg-slate-50 p-6">
            <Package className="h-12 w-12 text-slate-300" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Nenhum frete encontrado</h2>
          <p className="mt-2 max-w-sm text-muted-foreground">
            Você ainda não possui entregas cadastradas no sistema.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell 
      title="Rastreamento" 
      subtitle={selectedOrder ? `Acompanhando ${selectedOrder.code}` : "Selecione uma entrega para rastrear"}
    >
      <div className="flex flex-col gap-6 lg:flex-row h-full">
        {/* Lado Esquerdo: Lista e Detalhes */}
        <div className="flex flex-col w-full lg:w-[400px] gap-6 shrink-0">
          
          {/* Saudação e Seleção */}
          <div className="card-soft p-5 bg-primary text-primary-foreground border-none">
            <h2 className="text-lg font-bold">Olá, Cliente</h2>
            <p className="text-primary-foreground/80 text-sm">Suas entregas em tempo real</p>
          </div>

          {/* Lista de Ativos */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-2">Entregas Ativas</h3>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {activeOrders.map((order) => (
                <button
                  key={order.id}
                  onClick={() => setSelectedOrderId(order.id)}
                  className={`w-full text-left card-soft p-4 transition-all hover:border-brand/40 ${selectedOrderId === order.id ? 'border-brand ring-2 ring-brand/10 bg-brand/5' : ''}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-sm">{order.code}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      order.status === 'incident' ? 'bg-red-100 text-red-700' : 'bg-brand/10 text-brand'
                    }`}>
                      {statusLabel(order.status)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate">{order.origin_city}</span>
                    <ChevronRight className="h-3 w-3" />
                    <span className="truncate">{order.destination_city}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-slate-200 overflow-hidden">
                        {(order.driver as any)?.avatar_url && <img src={(order.driver as any).avatar_url} className="h-full w-full object-cover" />}
                      </div>
                      <span className="text-[11px] font-medium">{(order.driver as any)?.full_name || "A definir"}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono">{(order.vehicle as any)?.plate}</div>
                  </div>
                </button>
              ))}
              {activeOrders.length === 0 && (
                <div className="p-4 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
                  Nenhuma entrega ativa no momento.
                </div>
              )}
            </div>
          </div>

          {/* Histórico Rápido */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-2">Histórico Recente</h3>
            <div className="space-y-2">
              {historyOrders.slice(0, 3).map((order) => (
                <div key={order.id} className="card-soft p-3 bg-surface-2/50 border-dashed opacity-70">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold">{order.code}</span>
                    <span className="text-emerald-600 font-bold">Entregue</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Lado Direito: Mapa e Timeline */}
        <div className="flex-1 flex flex-col gap-6">
          {selectedOrder ? (
            <>
              {/* Info Bar Superior */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="card-soft p-4 flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Status</span>
                  <span className="font-bold text-sm text-brand">{statusLabel(selectedOrder.status)}</span>
                </div>
                <div className="card-soft p-4 flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Previsão</span>
                  <span className="font-bold text-sm">
                    {selectedOrder.delivery_window_end 
                      ? format(new Date(selectedOrder.delivery_window_end), "HH:mm 'de' dd/MM", { locale: ptBR })
                      : "Sob consulta"}
                  </span>
                </div>
                <div className="card-soft p-4 flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Distância Restante</span>
                  <span className="font-bold text-sm">-- km</span>
                </div>
                <div className="card-soft p-4 flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Motorista</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm truncate">{(selectedOrder.driver as any)?.full_name}</span>
                  </div>
                </div>
              </div>

              {/* Mapa Full */}
              <div className="card-soft overflow-hidden h-[500px] relative border-none">
                <TripMap
                  className="h-full w-full"
                  origin={selectedOrder.origin_lat && selectedOrder.origin_lng ? { lat: selectedOrder.origin_lat, lng: selectedOrder.origin_lng } : null}
                  destination={selectedOrder.destination_lat && selectedOrder.destination_lng ? { lat: selectedOrder.destination_lat, lng: selectedOrder.destination_lng } : null}
                  driver={selectedOrder.current_lat && selectedOrder.current_lng ? { lat: selectedOrder.current_lat, lng: selectedOrder.current_lng } : null}
                  interactive={true}
                />
                
                {/* Floating Actions */}
                <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end">
                   <div className="bg-white/90 backdrop-blur p-3 rounded-2xl shadow-xl border border-white/20 flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Última Atualização</span>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-bold">Agora mesmo</span>
                      </div>
                   </div>
                   
                   <div className="flex gap-2">
                      <ShareTracking code={selectedOrder.tracking_code || ''} />
                   </div>
                </div>
              </div>

              {/* Motorista e veículo */}
              <div className="grid gap-4 md:grid-cols-2">
                {selectedOrder.driver && (
                  <div className="card-soft p-5">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      Motorista
                    </h3>
                    <div className="mt-4 flex items-center gap-3">
                      {(selectedOrder.driver as any).avatar_url ? (
                        <img
                          src={(selectedOrder.driver as any).avatar_url}
                          alt={(selectedOrder.driver as any).full_name ?? "Motorista"}
                          className="h-14 w-14 rounded-full object-cover"
                        />
                      ) : (
                        <div className="grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                          {((selectedOrder.driver as any).full_name ?? "M").slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-semibold">
                          {(selectedOrder.driver as any).full_name ?? "Motorista não informado"}
                        </div>
                        {(selectedOrder.driver as any).phone && (
                          <div className="text-sm text-muted-foreground">
                            {(selectedOrder.driver as any).phone}
                          </div>
                        )}
                        <div className="mt-1 text-xs text-muted-foreground">
                          Frete {selectedOrder.code}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {(selectedOrder.vehicle as any) && (
                  <div className="card-soft p-5">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      Veículo
                    </h3>
                    <div className="mt-4 flex items-center gap-3">
                      {(selectedOrder.vehicle as any).photo_url ? (
                        <img
                          src={(selectedOrder.vehicle as any).photo_url}
                          alt={[
                            (selectedOrder.vehicle as any).brand,
                            (selectedOrder.vehicle as any).model,
                          ].filter(Boolean).join(" ") || "Veículo"}
                          className="h-14 w-20 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="grid h-14 w-20 place-items-center rounded-xl bg-primary/10 text-xs font-semibold text-primary">
                          Veículo
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-semibold">
                          {[
                            (selectedOrder.vehicle as any).brand,
                            (selectedOrder.vehicle as any).model,
                          ].filter(Boolean).join(" ") || "Veículo não informado"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Placa: {(selectedOrder.vehicle as any).plate ?? "—"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {[
                            (selectedOrder.vehicle as any).year,
                            (selectedOrder.vehicle as any).vehicle_type,
                            (selectedOrder.vehicle as any).body_type,
                          ].filter(Boolean).join(" · ") || "Especificações não informadas"}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Timeline Bottom */}
              <div className="card-soft p-6">
                <div className="flex items-center gap-2 mb-6">
                  <Clock className="h-4 w-4 text-brand" />
                  <h3 className="font-bold text-sm uppercase tracking-widest">Linha do Tempo da Operação</h3>
                </div>
                <div className="relative">
                  {/* Linha vertical (Desktop/Mobile adjust) */}
                  <div className="absolute left-[11px] top-0 bottom-0 w-0.5 bg-slate-100 lg:left-0 lg:top-[11px] lg:bottom-auto lg:right-0 lg:w-auto lg:h-0.5" />
                  
                  <div className="flex flex-col lg:flex-row lg:justify-between relative gap-6 lg:gap-2">
                    {PUBLIC_TIMELINE.map((step, idx) => {
                      const orderPublicStatus = publicStatus(selectedOrder.status || '');
                      const currentIdx = PUBLIC_TIMELINE.findIndex(t => t.key === orderPublicStatus.key);
                      const done = currentIdx > idx;
                      const isCurrent = currentIdx === idx;
                      
                      return (
                        <div key={step.key} className="flex items-start lg:flex-col lg:items-center lg:flex-1 gap-4 lg:gap-3 z-10">
                          <div className={`shrink-0 h-6 w-6 rounded-full border-2 bg-white flex items-center justify-center transition-all ${
                            done ? 'border-emerald-500 bg-emerald-500' : 
                            isCurrent ? 'border-brand ring-4 ring-brand/10' : 'border-slate-200'
                          }`}>
                            {done ? (
                              <CheckCircle2 className="h-4 w-4 text-white" />
                            ) : isCurrent ? (
                              <div className="h-2 w-2 rounded-full bg-brand animate-pulse" />
                            ) : (
                              <Circle className="h-3 w-3 text-slate-200" />
                            )}
                          </div>
                          <div className="flex flex-col lg:items-center">
                            <span className={`text-xs font-bold lg:text-center ${done || isCurrent ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {step.label}
                            </span>
                            <span className="text-[10px] text-muted-foreground lg:text-center">
                              {done ? "Concluído" : isCurrent ? "Em andamento" : "Pendente"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 card-soft flex flex-col items-center justify-center p-12 text-center border-dashed">
              <Truck className="h-12 w-12 text-slate-200 mb-4" />
              <h3 className="text-lg font-semibold">Selecione uma entrega</h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-xs">
                Escolha um dos seus fretes ativos na lista ao lado para ver o rastreamento detalhado.
              </p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
