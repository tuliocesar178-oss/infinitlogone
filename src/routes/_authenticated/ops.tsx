import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { AlertTriangle, ArrowRight, Package, Plus, Truck, TruckIcon } from "lucide-react";
import { OPS_CARDS, STATUS_LABEL } from "@/lib/order-status";

export const Route = createFileRoute("/_authenticated/ops")({
  head: () => ({ meta: [{ title: "Logística — InfinitLog" }, { name: "robots", content: "noindex" }] }),
  component: OpsDashboard,
});

function OpsDashboard() {
  const { data: orders } = useQuery({
    queryKey: ["ops-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, code, tracking_code, status, client_name, origin_city, destination_city, priority, created_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: driversAvailable } = useQuery({
    queryKey: ["drivers-available"],
    queryFn: async () => {
      const { count } = await supabase
        .from("drivers")
        .select("*", { count: "exact", head: true })
        .eq("status", "available");
      return count ?? 0;
    },
  });

  const grouped = new Map<string, typeof orders>();
  for (const card of OPS_CARDS) grouped.set(card.key, []);
  for (const o of orders ?? []) {
    for (const card of OPS_CARDS) {
      if (card.statuses.includes(o.status)) {
        grouped.get(card.key)!.push(o);
        break;
      }
    }
  }

  return (
    <AppShell
      title="Central de Logística"
      subtitle="Cadastre pedidos, envie ofertas e acompanhe entregas."
      actions={
        <Link
          to="/ops/pedidos/novo"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Novo pedido
        </Link>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {OPS_CARDS.map((c) => (
          <a
            key={c.key}
            href={`#lista-${c.key}`}
            className="card-soft p-6 transition hover:shadow-md"
          >
            <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              {c.label}
            </div>
            <div className="mt-3 text-3xl font-semibold tracking-tight">
              {grouped.get(c.key)?.length ?? 0}
            </div>
          </a>
        ))}
        <div className="card-soft p-6">
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Motoristas disponíveis
          </div>
          <div className="mt-3 flex items-center gap-2 text-3xl font-semibold tracking-tight">
            <TruckIcon className="h-6 w-6 text-muted-foreground" />
            {driversAvailable ?? 0}
          </div>
        </div>
      </div>

      <div className="mt-10 space-y-10">
        {OPS_CARDS.map((c) => {
          const list = grouped.get(c.key) ?? [];
          if (list.length === 0) return null;
          return (
            <section key={c.key} id={`lista-${c.key}`}>
              <header className="mb-4 flex items-center gap-2">
                {c.key === "incident" ? (
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                ) : (
                  <Package className="h-4 w-4 text-muted-foreground" />
                )}
                <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                  {c.label} · {list.length}
                </h2>
              </header>
              <div className="grid gap-3">
                {list.map((o) => (
                  <Link
                    key={o.id}
                    to="/ops/pedidos/$id"
                    params={{ id: o.id }}
                    className="card-soft flex items-center gap-4 p-4 transition hover:shadow-md"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-surface-2">
                      <Truck className="h-5 w-5 text-muted-foreground" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="truncate font-semibold">{o.code}</div>
                        {o.priority && o.priority !== "normal" && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-primary">
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
          );
        })}

        {(orders?.length ?? 0) === 0 && (
          <div className="card-soft grid place-items-center p-16 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-surface-2 text-muted-foreground">
              <Package className="h-6 w-6" />
            </span>
            <h2 className="mt-6 text-xl font-semibold tracking-tight">Nenhum pedido ainda</h2>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Cadastre o primeiro pedido para iniciar a operação.
            </p>
            <Link
              to="/ops/pedidos/novo"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> Novo pedido
            </Link>
          </div>
        )}
      </div>
    </AppShell>
  );
}
