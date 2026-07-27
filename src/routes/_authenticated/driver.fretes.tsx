import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_LABEL, STATUS_BADGE_CLASS } from "@/lib/order-status";
import { brl } from "@/lib/pf";
import { MapPin, Truck, Navigation, ChevronRight, Package, MessageCircle } from "lucide-react";
import { RouteMiniMap } from "@/components/driver/route-mini-map";
import { NavLauncherModal } from "@/components/driver/nav-launcher-modal";
import { DriverQuickChat } from "@/components/driver/quick-chat";
import type { NavTarget } from "@/lib/nav-launcher";

export const Route = createFileRoute("/_authenticated/driver/fretes")({
  head: () => ({ meta: [{ title: "Minhas rotas — Motorista" }, { name: "robots", content: "noindex" }] }),
  component: DriverFreights,
});

const FILTERS = [
  { key: "active", label: "Em andamento" },
  { key: "all", label: "Todos" },
  { key: "done", label: "Concluídos" },
] as const;

const ACTIVE_STATUSES = ["driver_assigned","en_route_pickup","at_pickup","loaded","in_transit_to_pickup","picked_up","out_for_delivery","in_transit","near_destination"];

function DriverFreights() {
  const [userId, setUserId] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("active");
  const [navTarget, setNavTarget] = useState<NavTarget | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (u.user) setUserId(u.user.id);
    })();
  }, []);

  const q = useQuery({
    enabled: !!userId,
    queryKey: ["driver-freights", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, code, tracking_code, status, origin_address, origin_city, destination_address, destination_city, origin_lat, origin_lng, destination_lat, destination_lng, current_lat, current_lng, price, distance_km, cargo_description, updated_at")
        .eq("driver_id", userId)
        .order("updated_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  const items = useMemo(() => {
    const all = q.data ?? [];
    if (filter === "active") return all.filter((o) => ACTIVE_STATUSES.includes(o.status));
    if (filter === "done") return all.filter((o) => ["delivered","finalized"].includes(o.status));
    return all;
  }, [q.data, filter]);

  return (
    <div className="space-y-5 pb-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Minhas rotas</h1>
        <p className="mt-1 text-sm text-muted-foreground">Acompanhe cada frete e inicie a navegação com um toque.</p>
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold transition ${
              filter === f.key ? "bg-brand text-brand-foreground" : "bg-surface text-muted-foreground hover:bg-accent"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="card-soft grid place-items-center p-12 text-center">
          <Truck className="h-10 w-10 text-brand" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhum frete encontrado.</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {items.map((o) => {
            const isActive = ACTIVE_STATUSES.includes(o.status);
            // Choose next nav target: if going to pickup, use origin; else destination
            const goingToPickup = ["driver_assigned","en_route_pickup","in_transit_to_pickup"].includes(o.status);
            const target = goingToPickup
              ? o.origin_lat && o.origin_lng
                ? { lat: o.origin_lat as number, lng: o.origin_lng as number, label: o.origin_address ?? undefined }
                : null
              : o.destination_lat && o.destination_lng
              ? { lat: o.destination_lat as number, lng: o.destination_lng as number, label: o.destination_address ?? undefined }
              : null;

            const origin = o.origin_lng && o.origin_lat ? ([o.origin_lng as number, o.origin_lat as number] as [number, number]) : null;
            const dest = o.destination_lng && o.destination_lat ? ([o.destination_lng as number, o.destination_lat as number] as [number, number]) : null;
            const driver = o.current_lng && o.current_lat ? ([o.current_lng as number, o.current_lat as number] as [number, number]) : null;

            return (
              <li key={o.id} className="card-soft overflow-hidden p-0">
                <RouteMiniMap origin={origin} destination={dest} driver={driver} className="h-36 w-full" />
                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-mono text-sm font-semibold">{o.code}</div>
                      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{o.origin_city ?? "—"} → {o.destination_city ?? "—"}</span>
                      </div>
                    </div>
                    <span className={STATUS_BADGE_CLASS[o.status] ?? "inline-flex rounded-full bg-surface-2 px-2.5 py-1 text-xs"}>
                      {STATUS_LABEL[o.status] ?? o.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-lg bg-surface p-2">
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Valor</div>
                      <div className="mt-0.5 font-semibold">{brl(o.price)}</div>
                    </div>
                    <div className="rounded-lg bg-surface p-2">
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Distância</div>
                      <div className="mt-0.5 font-semibold">{o.distance_km ? `${Number(o.distance_km).toFixed(0)} km` : "—"}</div>
                    </div>
                    <div className="rounded-lg bg-surface p-2">
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Atualizado</div>
                      <div className="mt-0.5 font-semibold">{new Date(o.updated_at).toLocaleDateString("pt-BR")}</div>
                    </div>
                  </div>

                  {o.cargo_description ? (
                    <div className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Package className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span className="line-clamp-2">{o.cargo_description}</span>
                    </div>
                  ) : null}

                  <div className="flex gap-2">
                    {isActive && target ? (
                      <button
                        onClick={() => setNavTarget(target)}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground shadow-sm transition hover:opacity-95"
                      >
                        <Navigation className="h-4 w-4" />
                        {goingToPickup ? "Navegar até coleta" : "Navegar até entrega"}
                      </button>
                    ) : null}
                    <Link
                      to="/driver"
                      className="flex items-center justify-center gap-1 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold transition hover:bg-surface-2"
                    >
                      Detalhes
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <NavLauncherModal open={!!navTarget} target={navTarget} onClose={() => setNavTarget(null)} />
    </div>
  );
}
