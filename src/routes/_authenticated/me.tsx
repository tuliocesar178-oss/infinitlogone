import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Package, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/me")({
  head: () => ({ meta: [{ title: "Minhas encomendas — InfinitLog" }, { name: "robots", content: "noindex" }] }),
  component: ClientDashboard,
});

function ClientDashboard() {
  const { data: orders, isLoading } = useQuery({
    queryKey: ["my-orders"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data, error } = await supabase
        .from("orders")
        .select("id, code, tracking_code, status, origin_city, destination_city, created_at")
        .eq("client_id", u.user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <AppShell title="Minhas encomendas" subtitle="Acompanhe todos os seus pedidos.">
      {isLoading && <div className="card-soft h-40 animate-pulse bg-surface-2" />}

      {!isLoading && (!orders || orders.length === 0) && (
        <div className="card-soft grid place-items-center p-16 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-surface-2 text-muted-foreground">
            <Package className="h-6 w-6" />
          </span>
          <h2 className="mt-6 text-xl font-semibold tracking-tight">Nenhuma encomenda ainda</h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Quando o time criar um pedido para você, ele aparecerá aqui em tempo real.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-background px-5 py-2.5 text-sm font-medium hover:bg-accent"
          >
            <Search className="h-4 w-4" /> Rastrear por código
          </Link>
        </div>
      )}

      {!!orders?.length && (
        <div className="grid gap-3">
          {orders.map((o) => (
            <Link
              key={o.id}
              to="/rastreio/$code"
              params={{ code: o.tracking_code }}
              className="card-soft flex items-center gap-4 p-5 transition hover:shadow-md"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-surface-2">
                <Package className="h-5 w-5 text-muted-foreground" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{o.code}</div>
                <div className="truncate text-sm text-muted-foreground">
                  {o.origin_city ?? "—"} → {o.destination_city ?? "—"}
                </div>
              </div>
              <span className="rounded-full bg-surface-2 px-3 py-1 text-xs text-muted-foreground">
                {o.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
