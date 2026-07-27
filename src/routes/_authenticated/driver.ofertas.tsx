import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/pf";
import { readFavorites, routeKey } from "@/lib/driver-prefs";
import { Clock, MapPin, Package, ChevronRight, MessageCircle, AlertTriangle, Star, History } from "lucide-react";

export const Route = createFileRoute("/_authenticated/driver/ofertas")({
  head: () => ({ meta: [{ title: "Ofertas — Motorista" }, { name: "robots", content: "noindex" }] }),
  component: DriverOffers,
});

type FilterKey = "novas" | "negociacao" | "expirando" | "favoritas" | "todas";

function useFavorites(): string[] {
  const snapshot = useSyncExternalStore(
    (cb) => {
      window.addEventListener("driver-favorites-changed", cb);
      return () => window.removeEventListener("driver-favorites-changed", cb);
    },
    () => JSON.stringify(readFavorites()),
    () => "[]",
  );
  return useMemo(() => JSON.parse(snapshot) as string[], [snapshot]);
}

const EXPIRING_WINDOW_MS = 5 * 60 * 1000;

function DriverOffers() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState("");
  const [now, setNow] = useState(Date.now());
  const [filter, setFilter] = useState<FilterKey>("novas");
  const favorites = useFavorites();

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

  const all = q.data ?? [];

  const counts = useMemo(() => {
    let novas = 0, negociacao = 0, expirando = 0, favoritas = 0;
    for (const it of all) {
      if (it.offer.status === "negotiating") negociacao++;
      else {
        novas++;
        if (it.offer.expires_at) {
          const ms = new Date(it.offer.expires_at).getTime() - now;
          if (ms > 0 && ms <= EXPIRING_WINDOW_MS) expirando++;
        }
      }
      if (favorites.includes(routeKey(it.order?.origin_city, it.order?.destination_city))) favoritas++;
    }
    return { novas, negociacao, expirando, favoritas, todas: all.length };
  }, [all, now, favorites]);

  const items = useMemo(() => {
    if (filter === "todas") return all;
    if (filter === "negociacao") return all.filter((i) => i.offer.status === "negotiating");
    if (filter === "novas") return all.filter((i) => i.offer.status === "pending");
    if (filter === "favoritas")
      return all.filter((i) => favorites.includes(routeKey(i.order?.origin_city, i.order?.destination_city)));
    return all.filter((i) => {
      if (i.offer.status !== "pending" || !i.offer.expires_at) return false;
      const ms = new Date(i.offer.expires_at).getTime() - now;
      return ms > 0 && ms <= EXPIRING_WINDOW_MS;
    });
  }, [all, filter, now, favorites]);

  const tabs: { key: FilterKey; label: string; count: number; tone?: string }[] = [
    { key: "novas", label: "Novas", count: counts.novas },
    { key: "expirando", label: "Expirando", count: counts.expirando, tone: "text-red-500" },
    { key: "negociacao", label: "Em negociação", count: counts.negociacao, tone: "text-brand" },
    { key: "favoritas", label: "Favoritas", count: counts.favoritas, tone: "text-amber-500" },
    { key: "todas", label: "Todas", count: counts.todas },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ofertas de fretes</h1>
          <p className="mt-1 text-sm text-muted-foreground">Toque em uma oferta para ver a rota, valores e aceitar.</p>
        </div>
        <Link
          to="/driver/ofertas/historico"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-2 text-xs font-semibold hover:bg-accent"
        >
          <History className="h-3.5 w-3.5" /> Histórico
        </Link>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => {
          const active = filter === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
                active
                  ? "border-brand bg-brand text-brand-foreground"
                  : "border-border bg-surface hover:border-brand/40"
              }`}
            >
              <span>{t.label}</span>
              <span
                className={`inline-flex min-w-[1.25rem] justify-center rounded-full px-1.5 text-[11px] font-semibold ${
                  active ? "bg-white/20 text-brand-foreground" : `bg-surface-2 ${t.tone ?? "text-muted-foreground"}`
                }`}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {items.length === 0 ? (
        <div className="card-soft grid place-items-center p-12 text-center">
          <Package className="h-10 w-10 text-brand" />
          <p className="mt-3 text-sm text-muted-foreground">
            {filter === "expirando"
              ? "Nenhuma oferta prestes a expirar."
              : filter === "negociacao"
                ? "Nenhuma negociação aguardando resposta."
                : filter === "favoritas"
                  ? "Nenhuma oferta em rotas favoritas."
                  : "Nenhuma oferta aguardando sua resposta."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map(({ offer, order, program }) => {
            const expMs = offer.expires_at ? new Date(offer.expires_at).getTime() - now : null;
            const isExpiring = offer.status === "pending" && expMs !== null && expMs > 0 && expMs <= EXPIRING_WINDOW_MS;
            const fav = favorites.includes(routeKey(order?.origin_city, order?.destination_city));
            return (
              <li key={offer.id}>
                <Link
                  to="/driver/ofertas/$id"
                  params={{ id: offer.id }}
                  className={`card-soft block overflow-hidden transition hover:border-brand/40 hover:shadow-md ${
                    isExpiring ? "border-red-500/50 ring-1 ring-red-500/20" : ""
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-border/60 bg-surface-2 px-4 py-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      {isExpiring && <AlertTriangle className="h-3 w-3 text-red-500" />}
                      {fav && <Star className="h-3 w-3 fill-amber-500 stroke-amber-500" />}
                      {program?.pf_code ?? order?.code ?? "Nova oferta"}
                    </span>
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
            );
          })}
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
