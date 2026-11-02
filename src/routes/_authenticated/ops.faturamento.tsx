import { COMMERCIAL_ORDERS } from "@/lib/order-projections";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FileText, Percent, Receipt, TrendingUp } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { KpiCard } from "@/components/finance/kpi-card";
import { ChartCard } from "@/components/finance/chart-card";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/ops-central";
import { compactBRL, lastMonths, monthKey, sum } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/ops/faturamento")({
  head: () => ({
    meta: [
      { name: "description", content: 'Faturamento — Receita e Margem | InfinitLog. Informações e acompanhamento na plataforma INFINITLOG VAPT VUPT.' },
      { property: "og:title", content: 'Faturamento — Receita e Margem | InfinitLog' },
      { property: "og:description", content: 'Faturamento — Receita e Margem | InfinitLog. Informações e acompanhamento na plataforma INFINITLOG VAPT VUPT.' },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Faturamento — Receita e Margem | InfinitLog" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FaturamentoPage,
});

type BillingOrder = {
  id: string;
  code: string;
  status: string;
  client_name: string | null;
  client_amount: number | null;
  driver_amount: number | null;
  margin_amount: number | null;
  invoice_number: string | null;
  invoice_value: number | null;
  completed_at: string | null;
  created_at: string;
};

async function fetchBilling(): Promise<BillingOrder[]> {
  const { data, error } = await supabase
    .from(COMMERCIAL_ORDERS)
    .select(
      "id, code, status, client_name, client_amount, driver_amount, margin_amount, invoice_number, invoice_value, completed_at, created_at",
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(error.message);
  return (data ?? []) as BillingOrder[];
}

function revenueOf(o: BillingOrder) {
  return Number(o.client_amount ?? 0) || 0;
}
function costOf(o: BillingOrder) {
  return Number(o.driver_amount ?? 0) || 0;
}
function refDate(o: BillingOrder) {
  return o.completed_at ?? o.created_at;
}

function FaturamentoPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["ops-billing-orders"],
    queryFn: fetchBilling,
    staleTime: 30_000,
  });

  const orders = useMemo(() => data ?? [], [data]);
  const thisMonth = monthKey(new Date().toISOString());

  const kpis = useMemo(() => {
    const monthOrders = orders.filter((o) => monthKey(refDate(o)) === thisMonth);
    const revenue = sum(monthOrders.map(revenueOf));
    const cost = sum(monthOrders.map(costOf));
    const toInvoice = orders.filter((o) => o.status === "delivered" && !o.invoice_number);
    return {
      revenue,
      cost,
      margin: revenue - cost,
      marginPct: revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0,
      count: monthOrders.length,
      toInvoice: sum(toInvoice.map(revenueOf)),
      toInvoiceCount: toInvoice.length,
      pendingList: toInvoice.slice(0, 12),
    };
  }, [orders, thisMonth]);

  const monthly = useMemo(() => {
    const buckets = lastMonths(6);
    return buckets.map((b) => {
      const inMonth = orders.filter((o) => monthKey(refDate(o)) === b.key);
      const receita = sum(inMonth.map(revenueOf));
      const custo = sum(inMonth.map(costOf));
      return { month: b.label, Receita: receita, Custo: custo, Margem: receita - custo };
    });
  }, [orders]);

  const byClient = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of orders) {
      const key = o.client_name?.trim() || "Sem cliente";
      map.set(key, (map.get(key) ?? 0) + revenueOf(o));
    }
    return Array.from(map.entries())
      .map(([cliente, Receita]) => ({ cliente, Receita }))
      .filter((x) => x.Receita > 0)
      .sort((a, b) => b.Receita - a.Receita)
      .slice(0, 8);
  }, [orders]);

  return (
    <AppShell title="Faturamento" subtitle="Receita, custo e margem dos fretes">
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Receita do mês"
            value={isLoading ? "…" : formatBRL(kpis.revenue)}
            hint={`${kpis.count} frete(s) no período`}
            icon={<TrendingUp className="h-4 w-4" />}
            tone="positive"
          />
          <KpiCard
            label="Custo do mês"
            value={isLoading ? "…" : formatBRL(kpis.cost)}
            hint="Valores pagos a motoristas"
            icon={<Receipt className="h-4 w-4" />}
          />
          <KpiCard
            label="Margem do mês"
            value={isLoading ? "…" : formatBRL(kpis.margin)}
            hint={`${kpis.marginPct.toFixed(1)}% de margem`}
            icon={<Percent className="h-4 w-4" />}
            tone={kpis.margin >= 0 ? "positive" : "danger"}
          />
          <KpiCard
            label="A faturar"
            value={isLoading ? "…" : formatBRL(kpis.toInvoice)}
            hint={`${kpis.toInvoiceCount} entrega(s) sem nota`}
            icon={<FileText className="h-4 w-4" />}
            tone="warning"
          />
        </div>

        {error ? (
          <p className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            Não foi possível carregar o faturamento: {(error as Error).message}
          </p>
        ) : null}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ChartCard
            className="lg:col-span-2"
            title="Receita x custo x margem"
            description="Últimos 6 meses"
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} className="text-xs" />
                <YAxis tickFormatter={(v) => compactBRL(Number(v))} tickLine={false} axisLine={false} width={80} className="text-xs" />
                <Tooltip formatter={(v) => formatBRL(Number(v))} />
                <Legend />
                <Area type="monotone" dataKey="Receita" stroke="#2563eb" fill="#2563eb" fillOpacity={0.15} />
                <Area type="monotone" dataKey="Custo" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.12} />
                <Area type="monotone" dataKey="Margem" stroke="#10b981" fill="#10b981" fillOpacity={0.12} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Top clientes" description="Receita acumulada">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byClient} layout="vertical" margin={{ left: 12 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => compactBRL(Number(v))} className="text-xs" />
                <YAxis type="category" dataKey="cliente" width={110} className="text-xs" />
                <Tooltip formatter={(v) => formatBRL(Number(v))} />
                <Bar dataKey="Receita" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <section className="rounded-xl border border-border bg-card">
          <header className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Entregas aguardando faturamento</h2>
          </header>
          {kpis.pendingList.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhuma entrega pendente de nota fiscal.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Frete</th>
                    <th className="px-4 py-3 text-left font-medium">Cliente</th>
                    <th className="px-4 py-3 text-left font-medium">Entregue em</th>
                    <th className="px-4 py-3 text-right font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {kpis.pendingList.map((o) => (
                    <tr key={o.id} className="border-t border-border/70 hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <Link to="/ops/pedidos/$id" params={{ id: o.id }} className="font-medium text-primary hover:underline">
                          {o.code}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{o.client_name ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {o.completed_at ? new Date(o.completed_at).toLocaleDateString("pt-BR") : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatBRL(revenueOf(o))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
