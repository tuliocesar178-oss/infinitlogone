import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Plus, ArrowRight, Truck, AlertTriangle } from "lucide-react";
import { StatusCards } from "@/components/orders/status-cards";
import { DASHBOARD_CARDS, STATUS_LABEL, type DashboardCardKey } from "@/lib/order-status";

export const Route = createFileRoute("/_authenticated/ops")({
  head: () => ({ meta: [{ title: "Gestão de Fretes — InfinitLog" }, { name: "robots", content: "noindex" }] }),
  component: FreightDashboard,
});

type OrderRow = {
  id: string;
  code: string;
  status: string;
  client_name: string | null;
  origin_city: string | null;
  destination_city: string | null;
  priority: string | null;
  created_at: string;
};

function FreightDashboard() {
  const qc = useQueryClient();

  const { data: orders } = useQuery({
    queryKey: ["freight-dashboard-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, code, status, client_name, origin_city, destination_city, priority, created_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as OrderRow[];
    },
  });

  const { data: offerIds } = useQuery({
    queryKey: ["freight-dashboard-offer-ids"],
    queryFn: async () => {
      const { data } = await supabase
        .from("freight_offers")
        .select("order_id")
        .eq("status", "pending");
      return new Set((data ?? []).map((o) => o.order_id as string));
    },
  });

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("dashboard-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        qc.invalidateQueries({ queryKey: ["freight-dashboard-orders"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "freight_offers" }, () => {
        qc.invalidateQueries({ queryKey: ["freight-dashboard-offer-ids"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const list = orders ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const offers = offerIds ?? new Set<string>();

  const counts: Record<DashboardCardKey, number> = {
    preparing: 0,
    awaiting_driver: 0,
    offer_sent: 0,
    en_route_pickup: 0,
    at_pickup: 0,
    in_transit: 0,
    near_destination: 0,
    delivered_today: 0,
    incident: 0,
  };

  for (const o of list) {
    if (o.status === "preparing" || o.status === "created") counts.preparing++;
    else if (o.status === "awaiting_driver") {
      if (offers.has(o.id)) counts.offer_sent++;
      else counts.awaiting_driver++;
    } else if (["driver_assigned", "en_route_pickup", "in_transit_to_pickup"].includes(o.status))
      counts.en_route_pickup++;
    else if (["at_pickup", "picked_up", "loaded"].includes(o.status)) counts.at_pickup++;
    else if (["out_for_delivery", "in_transit"].includes(o.status)) counts.in_transit++;
    else if (o.status === "near_destination") counts.near_destination++;
    else if (
      (o.status === "delivered" || o.status === "finalized") &&
      o.created_at?.slice(0, 10) === today
    )
      counts.delivered_today++;
    else if (o.status === "incident") counts.incident++;
  }

  const recent = list.slice(0, 8);
  const incidents = list.filter((o) => o.status === "incident").slice(0, 5);

  return (
    <AppShell
      title="Gestão de Fretes"
      subtitle="Toda a operação em tempo real. Clique em um card para abrir a lista."
      actions={
        <Link
          to="/ops/pedidos/novo"
          className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground shadow-sm hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Novo frete
        </Link>
      }
    >
      <StatusCards counts={counts} />

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <section className="card-soft p-6 lg:col-span-2">
          <header className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold tracking-tight">Fretes recentes</h2>
              <p className="text-xs text-muted-foreground">Últimos pedidos cadastrados</p>
            </div>
            <Link to="/ops/pedidos" className="text-xs font-medium text-brand hover:underline">
              Ver todos
            </Link>
          </header>
          <div className="space-y-2">
            {recent.length === 0 && (
              <div className="grid place-items-center rounded-2xl bg-surface-2 p-10 text-center">
                <Truck className="h-8 w-8 text-brand" />
                <div className="mt-3 text-sm font-medium">Nenhum frete ainda</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Cadastre o primeiro para iniciar a operação.
                </p>
              </div>
            )}
            {recent.map((o) => (
              <Link
                key={o.id}
                to="/ops/pedidos/$id"
                params={{ id: o.id }}
                className="flex items-center gap-4 rounded-xl border border-border/60 p-3 transition hover:bg-surface-2"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
                  <Truck className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="truncate font-mono text-sm font-semibold">{o.code}</div>
                    {o.priority && o.priority !== "normal" && (
                      <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-brand">
                        {o.priority}
                      </span>
                    )}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {o.client_name ?? "—"} · {o.origin_city ?? "—"} → {o.destination_city ?? "—"}
                  </div>
                </div>
                <span className="hidden rounded-full bg-surface-2 px-3 py-1 text-xs text-muted-foreground sm:inline-block">
                  {STATUS_LABEL[o.status] ?? o.status}
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </section>

        <section className="card-soft p-6">
          <header className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <h2 className="text-sm font-semibold tracking-tight">Ocorrências ativas</h2>
          </header>
          {incidents.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma ocorrência no momento.</p>
          ) : (
            <div className="space-y-2">
              {incidents.map((o) => (
                <Link
                  key={o.id}
                  to="/ops/pedidos/$id"
                  params={{ id: o.id }}
                  className="block rounded-xl border border-destructive/20 bg-destructive/5 p-3 hover:bg-destructive/10"
                >
                  <div className="font-mono text-sm font-semibold">{o.code}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {o.client_name ?? "—"} · {o.destination_city ?? "—"}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
