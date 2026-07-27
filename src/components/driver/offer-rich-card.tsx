import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { brl } from "@/lib/pf";
import { haversineKm } from "@/lib/geo";
import { RouteMiniMap } from "@/components/driver/route-mini-map";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Clock,
  Fuel,
  MapPin,
  MessageCircle,
  Package,
  Star,
  Truck,
  Weight,
  X,
} from "lucide-react";

type Offer = {
  id: string;
  offered_price: number;
  status: string;
  expires_at: string | null;
  created_at: string;
  duration_seconds?: number | null;
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
};

const PRIORITY: Record<string, { label: string; cls: string }> = {
  alta: { label: "🔥 Urgente", cls: "bg-red-500 text-white" },
  media: { label: "Média", cls: "bg-amber-500 text-white" },
  baixa: { label: "Baixa", cls: "bg-emerald-500 text-white" },
};

// Estimativas operacionais (ajustáveis por motorista via localStorage)
const FUEL_KM_PER_L = 3.5;
const FUEL_PRICE = 6.0;
const TOLL_PER_KM = 0.15;

export function OfferRichCard({
  offer,
  order,
  pfCode,
  isFav,
  now,
  onOpenDetails,
  onOpenChat,
  onNegotiate,
}: {
  offer: Offer;
  order: Order | undefined;
  pfCode: string | null;
  isFav: boolean;
  now: number;
  onOpenDetails: () => void;
  onOpenChat: () => void;
  onNegotiate: () => void;
}) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState<null | "accept" | "decline">(null);

  const distanceKm =
    order?.distance_km != null
      ? Number(order.distance_km)
      : order?.origin_lat && order?.origin_lng && order?.destination_lat && order?.destination_lng
        ? haversineKm(
            { lat: order.origin_lat, lng: order.origin_lng },
            { lat: order.destination_lat, lng: order.destination_lng },
          )
        : null;
  const etaMinutes =
    order?.estimated_minutes ?? (distanceKm ? Math.round(distanceKm) : null); // ~60 km/h → min≈km

  // Countdown + progresso
  const expMs = null;
  const isExpired = false;
  const totalWindow =
    offer.expires_at && offer.created_at
      ? new Date(offer.expires_at).getTime() - new Date(offer.created_at).getTime()
      : null;
  const progressPct =
    totalWindow && expMs !== null
      ? Math.max(0, Math.min(100, (expMs / totalWindow) * 100))
      : null;
  const urgent = expMs !== null && expMs > 0 && expMs < 5 * 60_000;

  const priority = (order?.priority ?? "").toLowerCase();
  const prio = PRIORITY[priority];

  // Ganho estimado
  const gross = Number(offer.offered_price ?? 0);
  const fuelCost = distanceKm ? (distanceKm / FUEL_KM_PER_L) * FUEL_PRICE : 0;
  const tollCost = distanceKm ? distanceKm * TOLL_PER_KM : 0;
  const netEstimate = gross - fuelCost - tollCost;
  const marginPct = gross > 0 ? (netEstimate / gross) * 100 : 0;

  async function respond(action: "accept" | "decline") {
    setBusy(action);
    try {
      if (!order) throw new Error("Pedido não encontrado");
      const { data: userData } = await supabase.auth.getUser();
      const patch =
        action === "accept"
          ? { 
              status: "accepted" as const, 
              accepted_at: new Date().toISOString(),
              driver_id: userData.user?.id 
            }
          : { status: "declined" as const };
      
      const { error } = await supabase.from("freight_offers").update(patch).eq("id", offer.id);
      if (error) throw error;

      if (action === "accept") {
        await supabase.from("orders").update({
          driver_id: userData.user?.id,
          status: "driver_assigned" as any,
          updated_at: new Date().toISOString()
        }).eq("id", order.id);
      }

      toast.success(action === "accept" ? "Frete aceito! Vá para Minhas Rotas." : "Oferta recusada");
      if (action === "accept") navigate({ to: "/driver" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao processar");
    } finally {
      setBusy(null);
    }
  }

  if (!order) return null;

  return (
    <div
      className={`card-soft overflow-hidden ${
        urgent ? "border-red-500/60 ring-2 ring-red-500/20" : ""
      }`}
    >
      {/* Header */}
      <div className="bg-surface px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
              Nova oferta
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <Clock className="h-3.5 w-3.5" />
            Oferta ativa
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Valor</div>
            <div className="text-3xl font-black tracking-tighter text-brand">
              {brl(gross)}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {prio && (
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${prio.cls}`}>
              {prio.label}
            </span>
          )}
          {isFav && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-amber-700">
              <Star className="h-3 w-3 fill-current" /> Favorita
            </span>
          )}
        </div>
      </div>

      {/* Mapa */}
      <div className="relative">
        <RouteMiniMap
          origin={
            order.origin_lat && order.origin_lng
              ? [order.origin_lng, order.origin_lat]
              : null
          }
          destination={
            order.destination_lat && order.destination_lng
              ? [order.destination_lng, order.destination_lat]
              : null
          }
          className="h-40 rounded-none"
        />
        {distanceKm != null && (
          <div className="absolute right-2 top-2 rounded-full bg-background/95 px-3 py-1 text-[11px] font-bold shadow-md backdrop-blur">
            {distanceKm.toFixed(0)} km
            {etaMinutes ? ` · ${formatDuration(etaMinutes)}` : ""}
          </div>
        )}
      </div>

      {/* Rota */}
      <div className="border-b border-border/60 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="mt-1 flex flex-col items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
            <span className="h-6 w-px bg-border" />
            <span className="h-2.5 w-2.5 rounded-full bg-red-500 ring-4 ring-red-500/20" />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div>
              <div className="truncate text-sm font-semibold">
                {order.origin_city ?? order.origin_address}
              </div>
              <div className="truncate text-[11px] text-muted-foreground">
                {order.origin_address}
              </div>
              {order.pickup_window_start && (
                <div className="mt-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                  Coleta {formatDateTime(order.pickup_window_start)}
                </div>
              )}
            </div>
            <div>
              <div className="truncate text-sm font-semibold">
                {order.destination_city ?? order.destination_address}
              </div>
              <div className="truncate text-[11px] text-muted-foreground">
                {order.destination_address}
              </div>
              {order.delivery_window_end && (
                <div className="mt-0.5 text-[10px] font-medium text-red-700 dark:text-red-400">
                  Entrega {formatDateTime(order.delivery_window_end)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Carga */}
      <div className="grid grid-cols-3 gap-2 border-b border-border/60 px-4 py-3 text-center">
        <MicroKPI
          icon={<Package className="h-3.5 w-3.5" />}
          label="Tipo"
          value={order.cargo_type ?? "—"}
        />
        <MicroKPI
          icon={<Weight className="h-3.5 w-3.5" />}
          label="Peso"
          value={order.cargo_weight_kg ? `${order.cargo_weight_kg} kg` : "—"}
        />
        <MicroKPI
          icon={<Truck className="h-3.5 w-3.5" />}
          label="Volumes"
          value={order.volumes ? String(order.volumes) : "—"}
        />
      </div>

      {/* Ganho estimado */}
      {distanceKm && (
        <div className="border-b border-border/60 bg-surface-2/50 px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              💰 Ganho estimado
            </span>
            <span
              className={`text-[10px] font-bold ${
                marginPct >= 40
                  ? "text-emerald-600"
                  : marginPct >= 20
                    ? "text-amber-600"
                    : "text-red-600"
              }`}
            >
              {marginPct.toFixed(0)}% líquido
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2 text-[11px]">
            <MiniBox label="Frete" value={brl(gross)} tone="text-foreground" />
            <MiniBox
              label="Pedágio"
              value={`- ${brl(tollCost)}`}
              tone="text-muted-foreground"
            />
            <MiniBox
              label={
                <span className="inline-flex items-center gap-0.5">
                  <Fuel className="h-2.5 w-2.5" /> Diesel
                </span>
              }
              value={`- ${brl(fuelCost)}`}
              tone="text-muted-foreground"
            />
            <MiniBox
              label="Líquido"
              value={brl(netEstimate)}
              tone={
                marginPct >= 20
                  ? "text-emerald-600 font-bold"
                  : "text-red-600 font-bold"
              }
            />
          </div>
        </div>
      )}

      {isExpired && (
        <div className="flex items-center gap-2 border-b border-border/60 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-600">
          <AlertTriangle className="h-3.5 w-3.5" /> Oferta expirada
        </div>
      )}

      {offer.status === "negotiating" && (
        <div className="flex items-center gap-2 border-b border-border/60 bg-brand/5 px-4 py-2 text-xs font-semibold text-brand">
          <MessageCircle className="h-3.5 w-3.5" /> Aguardando resposta da logística
        </div>
      )}

      {/* Ações */}
      <div className="flex gap-3 p-4 bg-surface">
        <button
          disabled={!!busy || isExpired || offer.status === "negotiating"}
          onClick={() => respond("decline")}
          className="flex-1 rounded-2xl border border-border bg-background py-4 text-sm font-bold uppercase tracking-widest hover:bg-accent disabled:opacity-40"
        >
          <X className="h-4 w-4" /> Recusar
        </button>
        <button
          disabled={!!busy || isExpired || offer.status === "negotiating"}
          onClick={onNegotiate}
          className="flex-1 rounded-2xl border border-brand bg-background py-4 text-sm font-bold uppercase tracking-widest text-brand hover:bg-brand/5 disabled:opacity-40"
        >
          <MessageCircle className="h-4 w-4" /> Negociar
        </button>
        <button
          disabled={!!busy || isExpired || offer.status === "negotiating"}
          onClick={() => respond("accept")}
          className="flex-[1.5] rounded-2xl bg-brand py-4 text-sm font-black uppercase tracking-widest text-brand-foreground shadow-lg shadow-brand/20 hover:opacity-90 disabled:opacity-40"
        >
          <Check className="h-4 w-4" /> Aceitar
        </button>
      </div>

      {/* Rodapé com chat */}
      <div className="flex items-center justify-between border-t border-border/60 bg-surface px-4 py-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          {distanceKm ? `${distanceKm.toFixed(0)} km` : "—"}
          {etaMinutes ? ` • ${formatDuration(etaMinutes)}` : ""}
        </span>
        <button
          onClick={onOpenChat}
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold text-brand hover:bg-brand/10"
        >
          <MessageCircle className="h-3.5 w-3.5" /> Chat logística
        </button>
      </div>
    </div>
  );
}

function CountdownLabel({ expiresAt, now }: { expiresAt: string; now: number }) {
  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) return <span className="text-red-200">Expirada</span>;
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const label =
    h > 0
      ? `${h}h ${String(m).padStart(2, "0")}m`
      : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return <span>{label}</span>;
}

function MicroKPI({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-0.5 truncate text-xs font-semibold">{value}</div>
    </div>
  );
}

function MiniBox({
  label,
  value,
  tone,
}: {
  label: React.ReactNode;
  value: string;
  tone: string;
}) {
  return (
    <div className="rounded-lg bg-background px-2 py-1.5 text-center">
      <div className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className={`mt-0.5 text-[11px] ${tone}`}>{value}</div>
    </div>
  );
}

function formatDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h <= 0) return `${m} min`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
