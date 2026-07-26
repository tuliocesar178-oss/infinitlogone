import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  MapPin,
  Package,
  Plus,
  TrendingUp,
  Truck,
  TruckIcon,
  XCircle,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { OPS_CARDS, STATUS_LABEL } from "@/lib/order-status";

export const Route = createFileRoute("/_authenticated/ops")({
  head: () => ({ meta: [{ title: "Logística — InfinitLog" }, { name: "robots", content: "noindex" }] }),
  component: OpsDashboard,
});

const TINTS: Record<
  string,
  { bg: string; fg: string; icon: React.ComponentType<{ className?: string }> }
> = {
  total: { bg: "bg-brand/10", fg: "text-brand", icon: Package },
  today: { bg: "bg-sky-100", fg: "text-sky-600", icon: Clock },
  transit: { bg: "bg-indigo-100", fg: "text-indigo-600", icon: Truck },
  delivered: { bg: "bg-emerald-100", fg: "text-emerald-600", icon: CheckCircle2 },
  waiting: { bg: "bg-amber-100", fg: "text-amber-700", icon: Clock },
  incident: { bg: "bg-red-100", fg: "text-red-600", icon: AlertTriangle },
  cancelled: { bg: "bg-rose-100", fg: "text-rose-600", icon: XCircle },
  rate: { bg: "bg-emerald-100", fg: "text-emerald-600", icon: TrendingUp },
};

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

  // Stats
  const list = orders ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const isSameDay = (d: string | null) => d?.slice(0, 10) === today;
  const transitStatuses = ["in_transit", "out_for_delivery", "near_destination", "picked_up"];
  const waitingStatuses = ["preparing", "awaiting_pickup", "offered"];
  const deliveredCount = list.filter((o) => o.status === "delivered").length;
  const cancelledCount = list.filter((o) => o.status === "cancelled").length;
  const finished = deliveredCount + cancelledCount;
  const deliveryRate = finished > 0 ? Math.round((deliveredCount / finished) * 100) : 0;

  const stats = [
    { key: "total", label: "Total", value: list.length },
    { key: "today", label: "Hoje", value: list.filter((o) => isSameDay(o.created_at)).length },
    { key: "transit", label: "Em trânsito", value: list.filter((o) => transitStatuses.includes(o.status)).length },
    { key: "delivered", label: "Entregues", value: deliveredCount },
    { key: "waiting", label: "Aguardando coleta", value: list.filter((o) => waitingStatuses.includes(o.status)).length },
    { key: "incident", label: "Ocorrências", value: list.filter((o) => o.status === "incident").length },
    { key: "cancelled", label: "Canceladas", value: cancelledCount },
    { key: "rate", label: "Taxa de entrega", value: `${deliveryRate}%` },
  ];

  // 7-day chart
  const days: { label: string; date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    days.push({
      date: iso,
      label: d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""),
      count: list.filter((o) => o.created_at?.slice(0, 10) === iso).length,
    });
  }

  return (
    <AppShell
      title={`${greet()}, ${firstName()}`}
      subtitle="Visão geral da operação em tempo real."
      actions={
        <Link
          to="/ops/pedidos/novo"
          className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground shadow-sm hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Nova entrega
        </Link>
      }
    >
      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const tint = TINTS[s.key];
          const Icon = tint.icon;
          return (
            <div key={s.key} className="card-soft p-5">
              <div className="flex items-center gap-4">
                <span className={`grid h-12 w-12 place-items-center rounded-2xl ${tint.bg} ${tint.fg}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-muted-foreground">{s.label}</div>
                  <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
                    {s.value}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Chart + Map */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="card-soft p-6 lg:col-span-2">
          <div className="flex items-baseline justify-between">
            <div>
              <h2 className="text-base font-semibold tracking-tight">Entregas nos últimos 7 dias</h2>
              <p className="text-xs text-muted-foreground">Volume diário criado no sistema</p>
            </div>
          </div>
          <div className="mt-6 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={days} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ fill: "var(--color-surface-2)" }}
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" fill="var(--color-brand)" radius={[6, 6, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-soft p-6">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-brand" />
            <h2 className="text-base font-semibold tracking-tight">Mapa</h2>
          </div>
          <p className="text-xs text-muted-foreground">Visualização em tempo real</p>
          <div className="mt-6 grid h-64 place-items-center rounded-2xl bg-surface-2 text-center">
            <div>
              <MapPin className="mx-auto h-8 w-8 text-brand" />
              <div className="mt-3 text-sm font-medium">Abrir rastreamento ao vivo</div>
              <p className="mx-auto mt-1 max-w-[220px] text-xs text-muted-foreground">
                Acompanhe as entregas em andamento no mapa completo.
              </p>
            </div>
          </div>
        </div>
      </div>

      <NearDeliveriesPanel />

      {/* Order lists */}
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
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand/10 text-brand">
                      <Truck className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="truncate font-semibold">{o.code}</div>
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
          );
        })}

        {(orders?.length ?? 0) === 0 && (
          <div className="card-soft grid place-items-center p-16 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-brand">
              <Package className="h-6 w-6" />
            </span>
            <h2 className="mt-6 text-xl font-semibold tracking-tight">Nenhum pedido ainda</h2>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Cadastre o primeiro pedido para iniciar a operação.
            </p>
            <Link
              to="/ops/pedidos/novo"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> Nova entrega
            </Link>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function greet() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function firstName() {
  return "operação";
}

function NearDeliveriesPanel() {
  const { data } = useQuery({
    queryKey: ["near-deliveries"],
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select(
          "id, code, client_name, destination_city, distance_to_destination_km, eta_minutes, current_city, status, last_ping_at",
        )
        .is("deleted_at", null)
        .not("distance_to_destination_km", "is", null)
        .lte("distance_to_destination_km", 20)
        .in("status", ["in_transit", "out_for_delivery", "near_destination"])
        .order("distance_to_destination_km", { ascending: true })
        .limit(10);
      return data ?? [];
    },
  });

  if (!data || data.length === 0) return null;

  return (
    <section className="mt-8">
      <header className="mb-4 flex items-center gap-2">
        <TruckIcon className="h-4 w-4 text-brand" />
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Entregas próximas · ao vivo
        </h2>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        {data.map((o) => {
          const km = o.distance_to_destination_km ?? 0;
          const near = km <= 5;
          return (
            <Link
              key={o.id}
              to="/ops/pedidos/$id"
              params={{ id: o.id }}
              className="card-soft flex items-center justify-between gap-4 p-4 transition hover:shadow-md"
            >
              <div className="min-w-0">
                <div className="font-mono text-sm font-semibold">{o.code}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {o.client_name ?? "—"} · {o.current_city ?? "—"} → {o.destination_city ?? "—"}
                </div>
              </div>
              <div className="text-right">
                <div
                  className={`text-lg font-bold tabular-nums ${
                    near ? "text-brand" : "text-foreground"
                  }`}
                >
                  {km.toFixed(1)} km
                </div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {o.eta_minutes != null ? `~${o.eta_minutes} min` : "—"}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
