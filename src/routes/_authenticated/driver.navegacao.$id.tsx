import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RouteMiniMap } from "@/components/driver/route-mini-map";
import { useBackgroundTracking } from "@/hooks/use-background-tracking";
import { STATUS_LABEL } from "@/lib/order-status";
import { navTarget, distanceToTargetKm, isWithinActionRadius, fmtDistance } from "@/lib/geofence";
import { nextDriverAction, ACTION_LABEL, ACTION_TRANSITIONS, type DriverAction } from "@/lib/order-flow";
import {
  ArrowLeft, MessageCircle, AlertTriangle, PhoneCall, Camera, Flag, Gauge, Clock, Navigation,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/driver/navegacao/$id")({
  head: () => ({ meta: [{ title: "Modo navegação — Motorista" }, { name: "robots", content: "noindex" }] }),
  component: NavigationMode,
});

function NavigationMode() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [userId, setUserId] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? ""));
  }, []);

  const orderQ = useQuery({
    queryKey: ["nav-order", id],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
      return data as any;
    },
  });

  const order = orderQ.data;
  const live = useBackgroundTracking(order ?? null, userId || undefined);

  if (!order) {
    return <div className="grid h-[70vh] place-items-center text-sm text-muted-foreground">Carregando frete…</div>;
  }

  const target = navTarget(order.status, order);
  const driverPos: [number, number] | null = live ? [live.lng, live.lat] : null;
  const distKm =
    live?.distanceToTargetKm ??
    (driverPos ? distanceToTargetKm({ lat: driverPos[1], lng: driverPos[0] }, target) : null);
  const unlocked = isWithinActionRadius(order.status, distKm);
  const action = nextDriverAction(order.status as never);
  const etaMin =
    distKm != null ? Math.max(1, Math.round((distKm / Math.max(25, live?.speedKmh ?? 45)) * 60)) : order.eta_minutes;

  async function finishStep() {
    if (!action) return;
    if ((action === "start_loading" || action === "start_unloading") && !unlocked) {
      toast.error("Aproxime-se a 100 m do local para liberar esta etapa.");
      return;
    }
    if (action === "loaded" || action === "delivered") {
      navigate({ to: "/driver" });
      return;
    }
    const to = ACTION_TRANSITIONS[action as DriverAction].to;
    const { error } = await supabase
      .from("orders")
      .update({ status: to as never, updated_at: new Date().toISOString() } as never)
      .eq("id", order.id);
    if (error) return toast.error(error.message);
    await supabase.from("order_events").insert({
      order_id: order.id,
      event_type: `driver_${action}`,
      from_status: order.status as never,
      to_status: to as never,
      actor_id: userId,
      payload: { lat: driverPos?.[1] ?? null, lng: driverPos?.[0] ?? null } as never,
    } as never);
    toast.success(ACTION_LABEL[action as DriverAction]);
    orderQ.refetch();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="relative flex-1">
        <RouteMiniMap
          origin={order.origin_lat && order.origin_lng ? [order.origin_lng, order.origin_lat] : null}
          destination={order.destination_lat && order.destination_lng ? [order.destination_lng, order.destination_lat] : null}
          driver={driverPos}
          className="h-full w-full rounded-none"
        />

        <Link
          to="/driver"
          className="absolute left-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-background/95 shadow-lg backdrop-blur"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        <div className="absolute left-4 right-4 top-4 mx-auto max-w-md rounded-2xl bg-brand/95 px-5 py-4 text-brand-foreground shadow-xl backdrop-blur">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-80">
            <Navigation className="h-3.5 w-3.5" />
            {target.kind === "pickup" ? "Seguindo para coleta" : "Seguindo para entrega"}
          </div>
          <div className="mt-1 truncate text-sm font-semibold">{target.address}</div>
          <div className="mt-2 flex flex-wrap gap-3 text-xs font-bold">
            <span className="inline-flex items-center gap-1"><Flag className="h-3.5 w-3.5" /> {fmtDistance(distKm)}</span>
            <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {etaMin ? `${etaMin} min` : "—"}</span>
            <span className="inline-flex items-center gap-1"><Gauge className="h-3.5 w-3.5" /> {live?.speedKmh != null ? `${Math.round(live.speedKmh)} km/h` : "—"}</span>
          </div>
        </div>
      </div>

      <div className="space-y-3 border-t border-border bg-surface p-4 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-mono text-sm font-bold">{order.code}</div>
            <div className="text-xs text-muted-foreground">
              {order.client_name ?? "Cliente"} • {STATUS_LABEL[order.status] ?? order.status}
            </div>
          </div>
          {live?.gpsLost && <span className="rounded-full bg-red-100 px-2 py-1 text-[10px] font-bold text-red-700">GPS instável</span>}
        </div>

        <div className="grid grid-cols-5 gap-2">
          <QuickBtn to="/driver/fretes" icon={<MessageCircle className="h-4 w-4" />} label="Chat" />
          <QuickBtn to="/driver/ocorrencias" icon={<AlertTriangle className="h-4 w-4" />} label="Ocorrência" />
          <QuickBtn href="tel:190" icon={<AlertTriangle className="h-4 w-4 text-red-500" />} label="Emergência" />
          <QuickBtn href={order.contact_phone ? `tel:${order.contact_phone}` : "tel:"} icon={<PhoneCall className="h-4 w-4" />} label="Operação" />
          <QuickBtn to="/driver" icon={<Camera className="h-4 w-4" />} label="Fotos" />
        </div>

        {action && (
          <button
            onClick={finishStep}
            className={`w-full rounded-2xl px-6 py-5 text-sm font-black uppercase tracking-widest transition-all active:scale-[0.98] ${
              (action === "start_loading" || action === "start_unloading") && !unlocked
                ? "border border-border bg-background text-muted-foreground"
                : "bg-brand text-brand-foreground shadow-lg shadow-brand/20"
            }`}
          >
            {ACTION_LABEL[action]}
          </button>
        )}
      </div>
    </div>
  );
}

function QuickBtn({ to, href, icon, label }: { to?: string; href?: string; icon: React.ReactNode; label: string }) {
  const cls =
    "flex flex-col items-center gap-1 rounded-xl border border-border bg-background px-2 py-3 text-[10px] font-semibold hover:bg-accent";
  if (href) return <a href={href} className={cls}>{icon}{label}</a>;
  return <Link to={to as never} className={cls}>{icon}{label}</Link>;
}
