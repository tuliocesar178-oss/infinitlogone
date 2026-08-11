import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RouteMiniMap } from "@/components/driver/route-mini-map";
import { 
  ChevronLeft, Navigation, Map as MapIcon, 
  Target, Zap, Compass, ArrowRight 
} from "lucide-react";
import { brl } from "@/lib/pf";
import { fmtDistance } from "@/lib/geofence";

export const Route = createFileRoute("/_authenticated/driver/navegacao/$id")({
  head: () => ({ meta: [{ title: "Navegação — InfinitLog" }] }),
  component: DriverNavigationPage,
});

function DriverNavigationPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [driverPos, setDriverPos] = useState<[number, number] | null>(null);
  const [mapStats, setMapStats] = useState<{ distanceKm: number; durationMin: number } | null>(null);
  const [viewMode, setViewMode] = useState<"route" | "driver">("route");

  const { data: order, isLoading } = useQuery({
    queryKey: ["driver-nav-order", id],
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setDriverPos([pos.coords.longitude, pos.coords.latitude]),
      (err) => console.error("Nav Geo error:", err),
      { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  if (isLoading) return <div className="grid h-screen place-items-center bg-background"><Zap className="h-8 w-8 animate-pulse text-brand" /></div>;
  if (!order) return <div className="p-10 text-center font-black uppercase tracking-widest text-muted-foreground">Pedido não encontrado</div>;

  const isToPickup = ["driver_assigned", "en_route_pickup", "near_pickup", "arriving_pickup", "at_pickup", "loading"].includes(order.status);
  const targetLabel = isToPickup ? "Coleta" : "Entrega";
  const targetAddress = isToPickup ? order.origin_address : order.destination_address;
  const targetCity = isToPickup ? order.origin_city : order.destination_city;

  const openExternalNav = () => {
    const lat = isToPickup ? order.origin_lat : order.destination_lat;
    const lng = isToPickup ? order.origin_lng : order.destination_lng;
    if (!lat || !lng) return;
    
    // Fallback order: Google Maps -> Waze -> Apple Maps
    const gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    window.open(gmapsUrl, '_blank');
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      {/* MAPA FULLSCREEN */}
      <RouteMiniMap
        origin={order.origin_lat && order.origin_lng ? [order.origin_lng, order.origin_lat] : null}
        destination={order.destination_lat && order.destination_lng ? [order.destination_lng, order.destination_lat] : null}
        driver={driverPos}
        orderStatus={order.status}
        interactive={true}
        showRoute={true}
        onStatsUpdate={setMapStats}
        className="h-full w-full"
        originInfo={{ title: "Coleta", address: order.origin_address || "" }}
        destinationInfo={{ title: "Entrega", address: order.destination_address || "" }}
      />

      {/* CONTROLES SUPERIORES */}
      <div className="absolute top-6 left-6 right-6 z-20 flex items-center justify-between">
        <button 
          onClick={() => window.history.back()}
          className="grid h-14 w-14 place-items-center rounded-2xl bg-background/90 shadow-2xl backdrop-blur-xl ring-1 ring-border active:scale-90 transition-transform"
        >
          <ChevronLeft className="h-7 w-7" />
        </button>

        <div className="flex flex-col items-end gap-3">
          <div className="rounded-2xl bg-brand p-4 text-white shadow-2xl ring-4 ring-brand/20 backdrop-blur-xl animate-in fade-in slide-in-from-top-4">
            <div className="text-[10px] font-black uppercase tracking-widest opacity-80">
              {isToPickup ? "Indo para Coleta" : "Indo para Entrega"}
            </div>
            <div className="mt-0.5 text-lg font-black leading-tight">
              {targetCity}
            </div>
          </div>
        </div>
      </div>

      {/* BOTÕES FLUTUANTES LATERAIS */}
      <div className="absolute right-6 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-3">
        <button 
          onClick={() => setViewMode(prev => prev === "route" ? "driver" : "route")}
          className="grid h-14 w-14 place-items-center rounded-2xl bg-background/90 shadow-2xl backdrop-blur-xl ring-1 ring-border active:scale-90 transition-transform"
          title="Alternar Visualização"
        >
          {viewMode === "route" ? <Compass className="h-6 w-6 text-brand" /> : <Target className="h-6 w-6 text-brand" />}
        </button>
      </div>

      {/* PAINEL INFERIOR - UBER STYLE */}
      <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-8">
        <div className="mx-auto max-w-lg overflow-hidden rounded-[32px] bg-background/95 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.3)] backdrop-blur-2xl ring-1 ring-border/50 animate-in fade-in slide-in-from-bottom-8">
          
          {/* Status e Stats Reais */}
          <div className="mb-6 flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Estimativa Real</div>
              <div className="flex items-center gap-3">
                <span className="text-3xl font-black tracking-tighter text-brand">
                  {mapStats ? fmtDistance(mapStats.distanceKm) : "---"}
                </span>
                <div className="h-6 w-[2px] bg-border" />
                <span className="text-3xl font-black tracking-tighter text-foreground">
                  {mapStats ? `${Math.round(mapStats.durationMin)} min` : "---"}
                </span>
              </div>
            </div>
            <div className="h-14 w-14 rounded-2xl bg-brand/10 grid place-items-center text-brand">
              <Navigation className="h-7 w-7" />
            </div>
          </div>

          {/* Barra de Progresso Real */}
          <div className="relative mb-6">
            <div className="h-2 w-full rounded-full bg-muted/30" />
            <div 
              className="absolute top-0 h-2 rounded-full bg-brand transition-all duration-1000" 
              style={{ width: `${isToPickup ? 0 : 50}%` }} 
            />
            <div className="mt-2 flex justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              <span>Coleta</span>
              <span>Entrega</span>
            </div>
          </div>

          <div className="mb-8 space-y-1">
            <div className="text-[10px] font-black uppercase tracking-widest text-brand">Destino Atual</div>
            <div className="text-lg font-black leading-tight truncate">{targetAddress}</div>
          </div>

          <button 
            onClick={openExternalNav}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-brand py-5 text-sm font-black uppercase tracking-[0.2em] text-white shadow-2xl shadow-brand/30 hover:opacity-95 active:scale-[0.98] transition-all"
          >
            Iniciar Navegação <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
