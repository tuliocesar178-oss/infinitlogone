import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RouteMiniMap } from "@/components/driver/route-mini-map";
import { brl } from "@/lib/pf";
import {
  ArrowDown,
  Check,
  ChevronRight,
  Clock,
  DollarSign,
  MapPin,
  MessageCircle,
  Package,
  Shield,
  Truck,
  Weight,
  X,
  Navigation,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { DriverQuickChat } from "./quick-chat";

type Offer = {
  id: string;
  offered_price: number;
  status: string;
  expires_at: string | null;
  created_at: string;
};

type Order = {
  id: string;
  code: string;
  origin_city: string | null;
  origin_state: string | null;
  origin_address: string;
  origin_lat: number | null;
  origin_lng: number | null;
  destination_city: string | null;
  destination_state: string | null;
  destination_address: string;
  destination_lat: number | null;
  destination_lng: number | null;
  cargo_type: string | null;
  cargo_weight_kg: number | null;
  volumes: number | null;
  distance_km: number | null;
  estimated_minutes: number | null;
  pickup_window_start: string | null;
  delivery_window_end: string | null;
  priority: string | null;
  insurance_value?: number | null;
  requires_antt?: boolean;
  requires_mopp?: boolean;
  requires_tracker?: boolean;
  requires_tarp?: boolean;
  is_full_load?: boolean;
  is_fractioned?: boolean;
  notes?: string | null;
};

type Program = {
  pf_code: string | null;
  payment_method: string | null;
  payment_term: string | null;
};

export function OfferDetails({
  offer,
  order,
  program,
  now,
}: {
  offer: Offer;
  order: Order;
  program: Program | null;
  now: number;
}) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState<null | "accept" | "decline">(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [driverPos, setDriverPos] = useState<[number, number] | null>(null);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setDriverPos([pos.coords.longitude, pos.coords.latitude]),
      () => console.log("Geolocation failed")
    );
  }, []);

  const gross = Number(offer.offered_price ?? 0);
  const expMs = offer.expires_at ? new Date(offer.expires_at).getTime() - now : null;
  const isExpired = expMs !== null && expMs <= 0;

  async function respond(action: "accept" | "decline") {
    setBusy(action);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      const patch =
        action === "accept"
          ? { 
              status: "accepted" as const, 
              accepted_at: new Date().toISOString(),
              driver_id: userData.user.id // Assigning the driver
            }
          : { status: "declined" as const };
      
      const { error } = await supabase.from("freight_offers").update(patch).eq("id", offer.id);
      if (error) throw error;

      if (action === "accept") {
        // Also update order with driver_id and status
        await supabase.from("orders").update({
          driver_id: userData.user.id,
          status: "driver_assigned",
          updated_at: new Date().toISOString()
        }).eq("id", order.id);

        toast.success("Frete aceito! Iniciando operação.");
        navigate({ to: "/driver" });
      } else {
        toast.success("Oferta recusada.");
        navigate({ to: "/driver/ofertas" });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao processar");
    } finally {
      setBusy(null);
    }
  }

  function openNavigation() {
    const q = order.origin_lat && order.origin_lng
      ? `${order.origin_lat},${order.origin_lng}`
      : encodeURIComponent(order.origin_address);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${q}`, "_blank");
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      {/* MAPA - 65% area on top typically, but we use it as background for the bottom sheet flow */}
      <div className="absolute inset-0 z-0 h-[70vh]">
        <RouteMiniMap
          origin={order.origin_lat && order.origin_lng ? [order.origin_lng, order.origin_lat] : null}
          destination={order.destination_lat && order.destination_lng ? [order.destination_lng, order.destination_lat] : null}
          driver={driverPos}
          className="h-full w-full rounded-none"
        />
      </div>

      {/* TOP HEADER OVER MAP */}
      <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between">
        <button 
          onClick={() => navigate({ to: "/driver/ofertas" })}
          className="grid h-10 w-10 place-items-center rounded-full bg-background/80 shadow-md backdrop-blur"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="flex gap-2">
          <div className="rounded-full bg-background/80 px-3 py-1.5 text-[11px] font-bold shadow-md backdrop-blur">
            {order.distance_km?.toFixed(0)} km · {formatDuration(order.estimated_minutes ?? 0)}
          </div>
        </div>
      </div>

      {/* BOTTOM SHEET */}
      <div 
        className={`fixed bottom-0 left-0 right-0 z-20 flex flex-col rounded-t-[32px] bg-background shadow-[0_-8px_30px_rgba(0,0,0,0.12)] transition-all duration-300 ease-in-out ${
          isExpanded ? "h-[85vh]" : "h-[45vh]"
        }`}
      >
        {/* Handle for dragging / tapping to expand */}
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex w-full justify-center py-3"
        >
          <div className="h-1.5 w-12 rounded-full bg-muted/40" />
        </button>

        <div className="flex-1 overflow-y-auto px-6 pb-24">
          {/* Valor em destaque */}
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Valor do frete</div>
              <div className="text-4xl font-black tracking-tight text-brand">{brl(gross)}</div>
            </div>
            {offer.expires_at && (
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Expira em</div>
                <div className={`text-lg font-mono font-bold ${expMs && expMs < 30000 ? "text-red-500" : expMs && expMs < 60000 ? "text-amber-500" : "text-foreground"}`}>
                  <CountdownLabel expiresAt={offer.expires_at} now={now} />
                </div>
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="mt-6 flex gap-4 overflow-x-auto pb-2">
            <QuickStat label="Viagem" value={`${order.distance_km?.toFixed(0)} km`} icon={<Truck className="h-3.5 w-3.5" />} />
            <QuickStat label="Tempo" value={formatDuration(order.estimated_minutes ?? 0)} icon={<Clock className="h-3.5 w-3.5" />} />
            <QuickStat label="Peso" value={`${order.cargo_weight_kg} kg`} icon={<Weight className="h-3.5 w-3.5" />} />
          </div>

          {/* Resumo da Rota */}
          <div className="mt-8 space-y-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Resumo da Rota</h3>
            <div className="relative pl-8">
              <div className="absolute left-[11px] top-2 h-[calc(100%-16px)] w-0.5 bg-muted/40" />
              
              <div className="relative mb-8">
                <div className="absolute -left-8 top-1 h-6 w-6 rounded-full bg-emerald-500/10 grid place-items-center">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase text-emerald-600">Coleta</div>
                  <div className="text-base font-bold">{order.origin_city}, {order.origin_state}</div>
                  <div className="text-xs text-muted-foreground">{order.origin_address}</div>
                </div>
              </div>

              <div className="relative">
                <div className="absolute -left-8 top-1 h-6 w-6 rounded-full bg-red-500/10 grid place-items-center">
                  <div className="h-2 w-2 rounded-full bg-red-500" />
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase text-red-600">Entrega</div>
                  <div className="text-base font-bold">{order.destination_city}, {order.destination_state}</div>
                  <div className="text-xs text-muted-foreground">{order.destination_address}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Seção de Detalhes (Visible when expanded) */}
          {isExpanded && (
            <div className="mt-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-2 gap-8">
                <DetailSection title="Operação">
                  <DetailItem label="Tipo de carga" value={order.cargo_type} />
                  <DetailItem label="Peso total" value={`${order.cargo_weight_kg} kg`} />
                  <DetailItem label="Volumes" value={String(order.volumes)} />
                  <DetailItem label="Valor segurado" value={order.insurance_value ? brl(order.insurance_value) : "—"} />
                </DetailSection>

                <DetailSection title="Exigências">
                  <CheckItem label="ANTT" checked={order.requires_antt} />
                  <CheckItem label="MOPP" checked={order.requires_mopp} />
                  <CheckItem label="Rastreador" checked={order.requires_tracker} />
                  <CheckItem label="Lona" checked={order.requires_tarp} />
                </DetailSection>
              </div>

              <div className="mt-8">
                <DetailSection title="Observações">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {order.notes || "Nenhuma observação adicional informada pela logística."}
                  </p>
                </DetailSection>
              </div>

              <div className="mt-8 mb-8">
                <DetailSection title="Pagamento">
                  <div className="rounded-2xl bg-surface-2 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground">Meio de pagamento</span>
                      <span className="text-sm font-bold">{program?.payment_method || "PIX"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Prazo</span>
                      <span className="text-sm font-bold">{program?.payment_term || "À vista na descarga"}</span>
                    </div>
                  </div>
                </DetailSection>
              </div>
            </div>
          )}
        </div>

        {/* BOTÕES FIXOS NA PARTE INFERIOR */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-border/40 bg-background/80 px-6 py-4 backdrop-blur">
          <div className="flex gap-3">
            <button 
              onClick={() => respond("decline")}
              disabled={!!busy || isExpired}
              className="flex-1 rounded-2xl border border-border bg-background py-4 text-sm font-bold uppercase tracking-widest hover:bg-accent disabled:opacity-40"
            >
              Recusar
            </button>
            <button 
              onClick={() => respond("accept")}
              disabled={!!busy || isExpired}
              className="flex-[2] rounded-2xl bg-brand py-4 text-sm font-black uppercase tracking-widest text-brand-foreground shadow-lg shadow-brand/20 hover:opacity-90 disabled:opacity-40"
            >
              {busy === "accept" ? "Aceitando..." : "Aceitar Frete"}
            </button>
          </div>
        </div>
      </div>

      {showChat && (
        <DriverQuickChat 
          open={showChat} 
          onClose={() => setShowChat(false)} 
          orderId={order.id} 
          orderCode={program?.pf_code || order.code} 
        />
      )}
    </div>
  );
}

function QuickStat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="flex shrink-0 items-center gap-2 rounded-2xl bg-surface-2 px-4 py-3">
      <div className="grid h-8 w-8 place-items-center rounded-full bg-brand/10 text-brand">
        {icon}
      </div>
      <div>
        <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="text-sm font-bold">{value}</div>
      </div>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{title}</h4>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-[10px] font-bold text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">{value || "—"}</div>
    </div>
  );
}

function CheckItem({ label, checked }: { label: string; checked?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`h-4 w-4 rounded-full grid place-items-center ${checked ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>
        {checked ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
      </div>
      <span className={`text-xs font-semibold ${checked ? "text-foreground" : "text-muted-foreground"}`}>
        {label}
      </span>
    </div>
  );
}

function CountdownLabel({ expiresAt, now }: { expiresAt: string; now: number }) {
  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) return <span className="text-red-500">Expirado</span>;
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return <span>{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}</span>;
}

function formatDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h <= 0) return `${m} min`;
  return `${h}h${String(m).padStart(2, "0")}`;
}
