import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/pf";
import { ArrowLeft, Check, Clock, X, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/driver/ofertas/historico")({
  head: () => ({ meta: [{ title: "Histórico de ofertas — Motorista" }, { name: "robots", content: "noindex" }] }),
  component: OffersHistory,
});

const STATUS_META: Record<string, { label: string; icon: any; cls: string }> = {
  accepted: { label: "Aceita", icon: Check, cls: "bg-emerald-100 text-emerald-800" },
  declined: { label: "Recusada", icon: X, cls: "bg-red-100 text-red-700" },
  expired: { label: "Expirada", icon: Clock, cls: "bg-muted text-muted-foreground" },
  cancelled: { label: "Cancelada", icon: X, cls: "bg-muted text-muted-foreground" },
  negotiating: { label: "Em negociação", icon: MessageCircle, cls: "bg-brand/10 text-brand" },
};

function OffersHistory() {
  const [userId, setUserId] = useState("");
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) setUserId(data.user.id);
    })();
  }, []);

  const q = useQuery({
    enabled: !!userId,
    queryKey: ["driver-offers-history", userId],
    queryFn: async () => {
      const { data: offers } = await supabase
        .from("freight_offers")
        .select("*")
        .eq("driver_id", userId)
        .in("status", ["accepted", "declined", "expired", "cancelled"])
        .order("created_at", { ascending: false })
        .limit(80);
      if (!offers?.length) return [];
      const ids = offers.map((o) => o.order_id);
      const { data: orders } = await supabase.from("orders").select("id, code, origin_city, destination_city").in("id", ids);
      return offers.map((o) => ({ offer: o, order: orders?.find((x) => x.id === o.order_id) }));
    },
  });

  const items = q.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/driver/ofertas" className="grid h-9 w-9 place-items-center rounded-full border border-border bg-surface hover:bg-accent">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Histórico de ofertas</h1>
          <p className="text-sm text-muted-foreground">Últimas 80 ofertas concluídas.</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="card-soft grid place-items-center p-12 text-center text-sm text-muted-foreground">
          Nenhuma oferta no histórico ainda.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map(({ offer, order }) => {
            const meta = STATUS_META[offer.status] ?? STATUS_META.expired;
            const Icon = meta.icon;
            return (
              <li key={offer.id} className="card-soft flex items-center gap-3 p-3">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${meta.cls}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    {order?.origin_city ?? "—"} → {order?.destination_city ?? "—"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {order?.code ?? ""} · {new Date(offer.created_at).toLocaleString("pt-BR")}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold">{brl(Number(offer.offered_price))}</div>
                  <div className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.cls}`}>
                    {meta.label}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
