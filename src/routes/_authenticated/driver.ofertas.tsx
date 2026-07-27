import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/pf";
import { Clock, MapPin, Package, ChevronRight, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/driver/ofertas/")({
  head: () => ({ meta: [{ title: "Ofertas — Motorista" }, { name: "robots", content: "noindex" }] }),
  component: DriverOffers,
});

function DriverOffers() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState("");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (u.user) setUserId(u.user.id);
    })();
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const q = useQuery({
    enabled: !!userId,
    queryKey: ["driver-offers-all", userId],
    queryFn: async () => {
      const { data: offers } = await supabase
        .from("freight_offers")
        .select("*")
        .eq("driver_id", userId)
        .in("status", ["pending", "negotiating"])
        .order("created_at", { ascending: false });
      if (!offers?.length) return [];
      const ids = offers.map((o) => o.order_id);
      const [{ data: orders }, { data: programs }] = await Promise.all([
        supabase.from("orders").select("*").in("id", ids),
        supabase.from("freight_programs").select("*").in("order_id", ids),
      ]);
      return offers.map((o) => ({
        offer: o,
        order: orders?.find((x) => x.id === o.order_id),
        program: programs?.find((p) => p.order_id === o.order_id),
      }));
    },
  });

  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`driver-offers-page-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "freight_offers", filter: `driver_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: ["driver-offers-all", userId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, qc]);

  const items = q.data ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ofertas de fretes</h1>
        <p className="mt-1 text-sm text-muted-foreground">Toque em uma oferta para ver a rota, valores e aceitar.</p>
      </div>

      {items.length === 0 ? (
        <div className="card-soft grid place-items-center p-12 text-center">
          <Package className="h-10 w-10 text-brand" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhuma oferta aguardando sua resposta.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map(({ offer, order, program }) => (
            <li key={offer.id}>
              <Link
                to="/driver/ofertas/$id"
                params={{ id: offer.id }}
                className="card-soft block overflow-hidden transition hover:border-brand/40 hover:shadow-md"
              >
                <div className="flex items-center justify-between border-b border-border/60 bg-surface-2 px-4 py-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                  <span>{program?.pf_code ?? order?.code ?? "Nova oferta"}</span>
                  <ExpireBadge expiresAt={offer.expires_at} now={now} negotiating={offer.status === "negotiating"} />
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 p-4">
                  <div className="min-w-0 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                      <span className="truncate font-medium">{order?.origin_city ?? order?.origin_address ?? "—"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
                      <span className="truncate font-medium">{order?.destination_city ?? order?.destination_address ?? "—"}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      {order?.distance_km && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {Number(order.distance_km).toFixed(0)} km
                        </span>
                      )}
                      {order?.cargo_type && (
                        <span className="inline-flex items-center gap-1">
                          <Package className="h-3 w-3" /> {order.cargo_type}
                        </span>
                      )}
                      {order?.cargo_weight_kg && <span>{order.cargo_weight_kg} kg</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold tracking-tight">{brl(Number(offer.offered_price))}</div>
                    {offer.status === "negotiating" ? (
                      <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-brand">
                        <MessageCircle className="h-3 w-3" /> Em negociação
                      </div>
                    ) : (
                      <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-brand">
                        Detalhes <ChevronRight className="h-3 w-3" />
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ExpireBadge({ expiresAt, now, negotiating }: { expiresAt: string | null; now: number; negotiating: boolean }) {
  if (negotiating) return <span className="text-brand">Aguardando logística</span>;
  if (!expiresAt) return <span>Sem prazo</span>;
  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) return <span className="text-red-500">Expirada</span>;
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const label = h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return (
    <span className={`inline-flex items-center gap-1 ${ms < 60_000 ? "text-red-500" : ""}`}>
      <Clock className="h-3 w-3" /> {label}
    </span>
  );
}
