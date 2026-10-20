import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ArrowUpRight, Clock, MapPin, Package, Route, Truck, X } from "lucide-react";
import { STATUS_BADGE_CLASS } from "@/lib/order-status";
import { formatBRL, progressPercent, statusLabel, timeAgo } from "@/lib/ops-central";
import { Button } from "@/components/ui/button";

export function OrderDrawer({ orderId, onClose }: { orderId: string | null; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const q = useQuery({
    queryKey: ["order-drawer", orderId],
    enabled: !!orderId,
    queryFn: async () => {
      if (!orderId) return null;
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, code, tracking_code, status, client_name, contact_phone, origin_city, origin_address, destination_city, destination_address, destination_lat, destination_lng, distance_km, distance_to_destination_km, initial_distance_km, eta_minutes, last_ping_at, price, cargo_description, cargo_weight_kg, volumes, driver_id, vehicle_id, delivery_window_end, created_at",
        )
        .eq("id", orderId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const [driverRes, vehicleRes, eventsRes] = await Promise.all([
        data.driver_id
          ? supabase.from("profiles").select("full_name, phone").eq("id", data.driver_id).maybeSingle()
          : Promise.resolve({ data: null }),
        data.vehicle_id
          ? supabase.from("vehicles").select("plate, model").eq("id", data.vehicle_id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase
          .from("order_events")
          .select("id, event_type, to_status, created_at, payload")
          .eq("order_id", data.id)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);
      return {
        order: data,
        driver: driverRes.data as { full_name: string | null; phone: string | null } | null,
        vehicle: vehicleRes.data as { plate: string; model: string | null } | null,
        events: eventsRes.data ?? [],
      };
    },
  });

  if (!orderId) return null;

  const o = q.data?.order;
  const badge = o ? STATUS_BADGE_CLASS[o.status] ?? "bg-muted text-muted-foreground" : "";

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1 bg-foreground/40 backdrop-blur-sm" />
      <aside
        className="flex h-full w-full max-w-md flex-col bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold">{o?.code ?? "…"}</span>
              {o && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge}`}>
                  {statusLabel(o.status)}
                </span>
              )}
            </div>
            <div className="mt-0.5 truncate text-xs text-muted-foreground">{o?.client_name ?? "—"}</div>
          </div>
          <Button variant="ghost" size="icon" aria-label="Fechar ficha do frete" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </header>

        {q.isError ? <p role="alert" className="p-5 text-destructive">Não foi possível carregar o histórico.</p> : q.isLoading || !o ? (
          <div className="grid flex-1 place-items-center text-xs text-muted-foreground">Carregando…</div>
        ) : (
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            <section className="rounded-xl border border-border/60 p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                <Route className="h-3.5 w-3.5" /> Rota
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 text-success" />
                  <div>
                    <div className="font-medium">{o.origin_city ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{o.origin_address}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 text-brand" />
                  <div>
                    <div className="font-medium">{o.destination_city ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{o.destination_address}</div>
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${progressPercent(o)}%` }} />
                </div>
                <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                  <span>{progressPercent(o)}% concluído</span>
                  <span>
                    {o.distance_to_destination_km != null
                      ? `${o.distance_to_destination_km.toFixed(1)} km restantes`
                      : o.distance_km
                        ? `${Number(o.distance_km).toFixed(1)} km totais`
                        : ""}
                  </span>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-2 gap-2">
              <Stat icon={<Clock className="h-3.5 w-3.5" />} label="ETA" value={o.eta_minutes != null && o.last_ping_at && Date.now()-Date.parse(o.last_ping_at)<=180000 ? `${o.eta_minutes} min` : "Sem previsão confiável"} />
              <Stat icon={<Package className="h-3.5 w-3.5" />} label="Valor" value={formatBRL(o.price)} />
              <Stat icon={<Truck className="h-3.5 w-3.5" />} label="Motorista" value={q.data?.driver?.full_name ?? "—"} />
              <Stat icon={<Truck className="h-3.5 w-3.5" />} label="Veículo" value={q.data?.vehicle?.plate ?? "—"} />
            </section>

            <section className="rounded-xl border border-border/60 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Últimos eventos
              </div>
              {q.data?.events?.length ? (
                <ol className="space-y-2 text-sm">
                  {q.data.events.map((e) => (
                    <li key={e.id} className="flex items-baseline justify-between gap-2">
                      <span className="truncate">{statusLabel(e.to_status) !== "—" ? statusLabel(e.to_status) : e.event_type}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">{timeAgo(e.created_at)}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-xs text-muted-foreground">Sem eventos.</p>
              )}
            </section>
          </div>
        )}

        <footer className="border-t border-border/60 p-4">
          <Link
            to="/ops/pedidos/$id"
            params={{ id: orderId }}
            onClick={onClose}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground hover:opacity-90"
          >
            Abrir detalhes completos <ArrowUpRight className="h-4 w-4" />
          </Link>
        </footer>
      </aside>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 p-3">
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-1 truncate text-sm font-semibold">{value}</div>
    </div>
  );
}
