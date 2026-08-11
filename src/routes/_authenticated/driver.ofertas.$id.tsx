import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RouteMiniMap } from "@/components/driver/route-mini-map";
import { brl } from "@/lib/pf";
import { haversineKm } from "@/lib/geo";
import { 
  Clock, MapPin, Navigation, Package, Truck, Weight, X, 
  ChevronLeft, Calendar, Info, Phone, AlertCircle, TrendingUp,
  Map as MapIcon
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/driver/ofertas/$id")({
  head: () => ({ meta: [{ title: "Nova Oferta — InfinitLog" }] }),
  component: DriverOfferDetailsPage,
});

function DriverOfferDetailsPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [driverPos, setDriverPos] = useState<[number, number] | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setDriverPos([pos.coords.longitude, pos.coords.latitude]),
      () => console.log("Geo failed")
    );
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["driver-offer-detail", id],
    queryFn: async () => {
      const { data: offer } = await supabase.from("freight_offers").select("*").eq("id", id).maybeSingle();
      if (!offer) return null;
      const { data: order } = await supabase.from("orders").select("*").eq("id", offer.order_id).maybeSingle();
      return { offer, order };
    },
  });

  const distToPickup = useMemo(() => {
    if (!driverPos || !data?.order?.origin_lat || !data?.order?.origin_lng) return null;
    return haversineKm(
      { lat: driverPos[1], lng: driverPos[0] },
      { lat: data.order.origin_lat, lng: data.order.origin_lng }
    );
  }, [driverPos, data?.order]);

  if (isLoading) return <div className="grid h-screen place-items-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div></div>;
  if (!data?.offer || !data?.order) return <div className="p-10 text-center font-bold">Oferta não encontrada ou já expirada.</div>;

  const { offer, order } = data;
  const gross = Number(offer.offered_price || 0);
  const totalKm = (order.distance_km || 0) + (distToPickup || 0);
  const pricePerKm = totalKm > 0 ? gross / totalKm : 0;

  async function respond(action: "accept" | "decline") {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      if (action === "accept") {
        const { error } = await supabase.from("freight_offers").update({ 
          status: "accepted", 
          driver_id: user.id,
          accepted_at: new Date().toISOString() 
        }).eq("id", id);
        
        if (error) throw error;

        await supabase.from("orders").update({ 
          driver_id: user.id, 
          status: "driver_assigned",
          updated_at: new Date().toISOString()
        }).eq("id", order.id);

        toast.success("Frete aceito com sucesso!");
        navigate({ to: "/driver" });
      } else {
        await supabase.from("freight_offers").update({ status: "declined" }).eq("id", id);
        navigate({ to: "/driver/ofertas" });
      }
    } catch (e) {
      toast.error("Esta oferta não está mais disponível.");
      navigate({ to: "/driver/ofertas" });
    }
  }

  const expMs = offer.expires_at ? new Date(offer.expires_at).getTime() - now : null;
  const isExpired = expMs !== null && expMs <= 0;

  return (
    <div className="relative flex min-h-screen flex-col bg-background pb-32 overflow-x-hidden">
      {/* MAPA HEADER */}
      <div className="h-[55vh] w-full relative">
        <RouteMiniMap
          origin={order.origin_lat && order.origin_lng ? [order.origin_lng, order.origin_lat] : null}
          destination={order.destination_lat && order.destination_lng ? [order.destination_lng, order.destination_lat] : null}
          driver={driverPos}
          orderStatus="pending"
          interactive={true}
          className="h-full w-full rounded-none"
          originInfo={{ title: "Coleta", address: order.origin_address || "" }}
          destinationInfo={{ title: "Entrega", address: order.destination_address || "" }}
        />
        
        {/* Botão Ver Rota Completa (Uber Style Overlay) */}
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 w-[90%] max-w-xs">
          <Link
            to="/driver/navegacao/$id"
            params={{ id: offer.id }}
            className="flex items-center justify-center gap-2 rounded-2xl bg-background/90 px-6 py-4 text-xs font-black uppercase tracking-widest shadow-2xl backdrop-blur-xl ring-1 ring-border active:scale-95 transition-all"
          >
            <MapIcon className="h-4 w-4 text-brand" /> Ver Rota Completa
          </Link>
        </div>

        {/* Notificação Flutuante no Mapa */}
        {distToPickup !== null && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10 w-[90%] max-w-xs">
            <div className="flex items-center gap-3 rounded-2xl bg-brand p-3 text-white shadow-2xl ring-4 ring-brand/20 animate-in fade-in zoom-in duration-300">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/20">
                <Truck className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase opacity-80">Distância até coleta</div>
                <div className="truncate text-sm font-black">{distToPickup.toFixed(1)} km · {Math.round(distToPickup * 1.5)} min</div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Botão Voltar */}
      <button 
        onClick={() => navigate({ to: "/driver/ofertas" })}
        className="absolute top-6 left-6 z-20 grid h-12 w-12 place-items-center rounded-2xl bg-background/90 shadow-2xl backdrop-blur ring-1 ring-border active:scale-95 transition-transform"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>

      {/* Painel Informativo (Bottom Sheet Style) */}
      <div className="relative -mt-16 flex-1 rounded-t-[40px] bg-background px-6 pt-8 shadow-[0_-20px_40px_rgba(0,0,0,0.15)] ring-1 ring-border/5">
        <div className="mx-auto mb-6 h-1.5 w-12 rounded-full bg-muted/30" />

        {/* Cabeçalho de Preço */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Valor do Frete</div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black tracking-tighter text-brand">{brl(gross)}</span>
            </div>
            {totalKm > 0 && (
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 w-fit px-2 py-0.5 rounded-full">
                <TrendingUp className="h-3 w-3" /> {brl(pricePerKm)} / km
              </div>
            )}
          </div>

          {offer.expires_at && (
            <div className="text-right">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Expira em</div>
              <div className={`text-xl font-black font-mono tracking-tight ${expMs && expMs < 60000 ? "text-red-500 animate-pulse" : "text-foreground"}`}>
                <CountdownLabel expiresAt={offer.expires_at} now={now} />
              </div>
            </div>
          )}
        </div>

        {/* Resumo Rápido */}
        <div className="mt-8 grid grid-cols-2 gap-3">
          <div className="rounded-3xl border border-border bg-surface-2/50 p-4 transition-colors hover:border-brand/30">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Navigation className="h-4 w-4" /> <span className="text-[10px] font-black uppercase tracking-widest">Viagem</span>
            </div>
            <div className="mt-2 text-lg font-black">{order.distance_km?.toFixed(0)} km</div>
            <div className="text-[10px] font-bold text-muted-foreground">Coleta → Entrega</div>
          </div>
          <div className="rounded-3xl border border-border bg-surface-2/50 p-4 transition-colors hover:border-brand/30">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" /> <span className="text-[10px] font-black uppercase tracking-widest">Coleta</span>
            </div>
            <div className="mt-2 text-lg font-black">
              {order.pickup_window_start ? new Date(order.pickup_window_start).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : "--/--"}
            </div>
            <div className="text-[10px] font-bold text-muted-foreground">às {order.pickup_window_start ? new Date(order.pickup_window_start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : "--:--"}</div>
          </div>
        </div>

        {/* Rota Detalhada */}
        <div className="mt-10 space-y-8">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
            <MapPin className="h-3 w-3" /> Itinerário
          </h3>
          <div className="relative pl-9">
            <div className="absolute left-[13px] top-2.5 h-[calc(100%-20px)] w-0.5 border-l-2 border-dashed border-muted/50" />
            
            <div className="relative mb-10">
              <div className="absolute -left-9 top-0 h-7 w-7 rounded-full bg-emerald-500 border-4 border-white shadow-lg ring-1 ring-emerald-500/20" />
              <div className="space-y-1">
                <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Local de Coleta</div>
                <div className="text-lg font-black leading-tight">{order.origin_city}, {order.origin_state}</div>
                <div className="text-sm text-muted-foreground leading-snug">{order.origin_address}</div>
                <div className="mt-2 flex items-center gap-4 text-xs font-bold">
                  <span className="flex items-center gap-1"><Info className="h-3 w-3" /> {order.pickup_instructions || "Carga Geral"}</span>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -left-9 top-0 h-7 w-7 rounded-full bg-red-500 border-4 border-white shadow-lg ring-1 ring-red-500/20" />
              <div className="space-y-1">
                <div className="text-[10px] font-black uppercase tracking-widest text-red-600">Local de Entrega</div>
                <div className="text-lg font-black leading-tight">{order.destination_city}, {order.destination_state}</div>
                <div className="text-sm text-muted-foreground leading-snug">{order.destination_address}</div>
                <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                  <Calendar className="h-3 w-3" /> Previsão: {order.delivery_window_end ? new Date(order.delivery_window_end).toLocaleDateString('pt-BR') : "Não informada"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Detalhes da Carga */}
        <div className="mt-12 space-y-6">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
            <Package className="h-3 w-3" /> Detalhes da Carga
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-3xl bg-surface p-5 ring-1 ring-border/5">
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Produto</div>
              <div className="mt-2 text-sm font-black">{order.cargo_type || "Carga Geral"}</div>
            </div>
            <div className="rounded-3xl bg-surface p-5 ring-1 ring-border/5">
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Peso Total</div>
              <div className="mt-2 text-sm font-black">{order.cargo_weight_kg ? `${order.cargo_weight_kg} kg` : "—"}</div>
            </div>
            <div className="rounded-3xl bg-surface p-5 ring-1 ring-border/5">
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Volumes</div>
              <div className="mt-2 text-sm font-black">{order.volumes || "—"}</div>
            </div>
            <div className="rounded-3xl bg-surface p-5 ring-1 ring-border/5">
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nota Fiscal</div>
              <div className="mt-2 text-sm font-black">{order.invoice_number ? `NF ${order.invoice_number}` : "Aguardando"}</div>
            </div>
          </div>
        </div>

        {/* Informações de Contato / Doca */}
        <div className="mt-8 rounded-3xl bg-surface-2 p-6 border border-border/50">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground mb-4">
            <Phone className="h-3 w-3" /> Contatos de Apoio
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-[10px] font-bold text-muted-foreground">Responsável Coleta</div>
              <div className="text-sm font-black">{order.pickup_phone_name || "Equipe Doca"}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-muted-foreground">WhatsApp</div>
              <div className="text-sm font-black">{order.pickup_whatsapp || "—"}</div>
            </div>
          </div>
        </div>

        {/* Alerta de Segurança */}
        <div className="mt-8 flex gap-3 rounded-3xl bg-amber-50 p-5 text-amber-900 border border-amber-200/50">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div className="text-xs font-bold leading-relaxed">
            Certifique-se de possuir todos os equipamentos de segurança (EPIs) necessários para o carregamento neste local.
          </div>
        </div>
      </div>

      {/* AÇÕES FIXAS INFERIORES */}
      <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center gap-4 bg-background/80 px-6 py-8 backdrop-blur-xl border-t border-border/40 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        <button 
          onClick={() => respond("decline")}
          disabled={isExpired}
          className="flex-1 rounded-3xl border-2 border-border bg-background py-5 text-sm font-black tracking-widest uppercase hover:bg-accent disabled:opacity-40 transition-all active:scale-95"
        >
          Recusar
        </button>
        <button 
          onClick={() => respond("accept")}
          disabled={isExpired}
          className="flex-[2] rounded-3xl bg-brand py-5 text-sm font-black tracking-widest uppercase text-white shadow-2xl shadow-brand/30 hover:opacity-95 disabled:opacity-40 transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          {isExpired ? "Oferta Expirada" : <>Aceitar Frete <Truck className="h-4 w-4" /></>}
        </button>
      </div>
    </div>
  );
}

function CountdownLabel({ expiresAt, now }: { expiresAt: string; now: number }) {
  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) return <span>00:00</span>;
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return <span>{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}</span>;
}
