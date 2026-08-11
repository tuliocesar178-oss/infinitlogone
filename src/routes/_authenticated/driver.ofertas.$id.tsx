import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RouteMiniMap } from "@/components/driver/route-mini-map";
import { brl } from "@/lib/pf";
import { Clock, MapPin, Navigation, Package, Truck, Weight, X, ChevronLeft, Calendar } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/driver/ofertas/$id")({
  component: DriverOfferDetailsPage,
});

function DriverOfferDetailsPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [driverPos, setDriverPos] = useState<[number, number] | null>(null);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setDriverPos([pos.coords.longitude, pos.coords.latitude]),
      () => console.log("Geo failed")
    );
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

  if (isLoading) return <div>Carregando...</div>;
  if (!data?.offer || !data?.order) return <div>Oferta não encontrada.</div>;

  const { offer, order } = data;

  async function respond(action: "accept" | "decline") {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      if (action === "accept") {
        await supabase.from("freight_offers").update({ status: "accepted", driver_id: user.id }).eq("id", id);
        await supabase.from("orders").update({ driver_id: user.id, status: "driver_assigned" }).eq("id", order.id);
        toast.success("Frete aceito!");
        navigate({ to: "/driver" });
      } else {
        await supabase.from("freight_offers").update({ status: "declined" }).eq("id", id);
        navigate({ to: "/driver/ofertas" });
      }
    } catch {
      toast.error("Erro ao processar");
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <div className="h-[60vh] w-full">
        <RouteMiniMap
          origin={order.origin_lat && order.origin_lng ? [order.origin_lng, order.origin_lat] : null}
          destination={order.destination_lat && order.destination_lng ? [order.destination_lng, order.destination_lat] : null}
          driver={driverPos}
          className="h-full w-full rounded-none"
        />
      </div>
      
      <button 
        onClick={() => navigate({ to: "/driver/ofertas" })}
        className="absolute top-4 left-4 z-10 grid h-10 w-10 place-items-center rounded-full bg-background/80 shadow backdrop-blur"
      >
        <ChevronLeft />
      </button>

      <div className="relative -mt-10 flex-1 rounded-t-[32px] bg-background p-6 shadow-[0_-10px_20px_rgba(0,0,0,0.1)]">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nova Oferta</div>
            <div className="text-3xl font-black text-brand">{brl(offer.offered_price)}</div>
            <div className="text-sm text-muted-foreground">{order.distance_km?.toFixed(0)} km</div>
          </div>
          <div className="rounded-2xl bg-brand/10 p-4 text-center">
            <div className="text-xs font-bold text-brand">Coleta</div>
            <div className="text-sm font-black">{order.pickup_window_start ? new Date(order.pickup_window_start).toLocaleDateString() : "--/--"}</div>
          </div>
        </div>

        <div className="mt-8 space-y-6">
          <div className="flex items-center gap-4">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-emerald-100 text-emerald-700">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-muted-foreground">Origem</div>
              <div className="font-semibold">{order.origin_city}</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-red-100 text-red-700">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-muted-foreground">Destino</div>
              <div className="font-semibold">{order.destination_city}</div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4">
          <div className="rounded-2xl border bg-surface p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Weight className="h-4 w-4" /> <span className="text-[10px] uppercase font-bold">Peso</span>
            </div>
            <div className="mt-1 font-bold text-sm">{order.cargo_weight_kg} kg</div>
          </div>
          <div className="rounded-2xl border bg-surface p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Package className="h-4 w-4" /> <span className="text-[10px] uppercase font-bold">Volume</span>
            </div>
            <div className="mt-1 font-bold text-sm">{order.volumes} vol</div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 flex gap-4 p-6 bg-background border-t">
        <button onClick={() => respond("decline")} className="flex-1 rounded-2xl border py-4 font-bold text-sm">RECUSAR</button>
        <button onClick={() => respond("accept")} className="flex-[2] rounded-2xl bg-brand text-white py-4 font-black text-sm uppercase shadow-lg">Aceitar Frete</button>
      </div>
    </div>
  );
}
