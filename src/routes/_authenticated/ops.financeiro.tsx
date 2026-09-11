import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, CheckCircle2, Clock, Wallet } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { KpiCard } from "@/components/finance/kpi-card";
import { ChartCard } from "@/components/finance/chart-card";
import { PaymentsTable, type PaymentRow } from "@/components/finance/payments-table";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/ops-central";
import {
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_ORDER,
  compactBRL,
  lastMonths,
  monthKey,
  sum,
  type DriverPaymentStatus,
} from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/ops/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro — Pagamentos de Motoristas | InfinitLog" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FinanceiroPage,
});

const PIE_COLORS = ["#2563eb", "#0ea5e9", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#64748b", "#14b8a6"];

async function fetchPayments(): Promise<PaymentRow[]> {
  const { data, error } = await supabase
    .from("driver_payments")
    .select(
      "id, order_id, driver_id, status, gross_amount, discounts_amount, additions_amount, net_amount, paid_at, scheduled_for, created_at, orders(code, client_name)",
    )
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const driverIds = Array.from(new Set(rows.map((r) => r.driver_id).filter(Boolean) as string[]));
  const { data: profiles } = driverIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", driverIds)
    : { data: [] as Array<{ id: string; full_name: string | null }> };

  return rows.map((r) => {
    const order = r.orders as { code?: string; client_name?: string | null } | null;
    return {
      id: r.id,
      order_id: r.order_id,
      status: r.status,
      gross_amount: Number(r.gross_amount) || 0,
      discounts_amount: Number(r.discounts_amount) || 0,
      additions_amount: Number(r.additions_amount) || 0,
      net_amount: Number(r.net_amount) || 0,
      paid_at: r.paid_at,
      scheduled_for: r.scheduled_for,
      created_at: r.created_at,
      driver_name:
        (profiles ?? []).find((p) => p.id === r.driver_id)?.full_name ?? "Motorista não identificado",
      order_code: order?.code ?? "—",
      client_name: order?.client_name ?? null,
    } satisfies PaymentRow;
  });
}

function FinanceiroPage() {
  const [statusFilter, setStatusFilter] = useState<DriverPaymentStatus | "all">("all");

  const { data, isLoading, error } = useQuery({
    queryKey: ["ops-driver-payments"],
    queryFn: fetchPayments,
    staleTime: 30_000,
  });

  const rows = useMemo(() => data ?? [], [data]);

  const kpis = useMemo(() => {
    const paid = rows.filter((r) => r.status === "pago");
    const pending = rows.filter((r) =>
      ["aguardando_analise", "em_conferencia", "aprovado", "agendado"].includes(r.status),
    );
    const issues = rows.filter((r) => r.status === "pendencia" || r.status === "devolvido");
    const thisMonth = monthKey(new Date().toISOString());
    const paidThisMonth = paid.filter((r) => monthKey(r.paid_at) === thisMonth);
    return {
      pending: sum(pending.map((r) => r.net_amount)),
      pendingCount: pending.length,
      paidMonth: sum(paidThisMonth.map((r) => r.net_amount)),
      paidMonthCount: paidThisMonth.length,
      issues: sum(issues.map((r) => r.net_amount)),
      issuesCount: issues.length,
      total: sum(rows.map((r) => r.net_amount)),
    };
  }, [rows]);

  const monthly = useMemo(() => {
    const buckets = lastMonths(6);
    return buckets.map((b) => {
      const paid = rows.filter((r) => r.status === "pago" && monthKey(r.paid_at) === b.key);
      const opened = rows.filter((r) => r.status !== "pago" && monthKey(r.created_at) === b.key);
      return {
        month: b.label,
        Pago: sum(paid.map((r) => r.net_amount)),
        "A pagar": sum(opened.map((r) => r.net_amount)),
      };
    });
  }, [rows]);

  const byStatus = useMemo(
    () =>
      PAYMENT_STATUS_ORDER.map((s) => ({
        name: PAYMENT_STATUS_LABEL[s],
        value: sum(rows.filter((r) => r.status === s).map((r) => r.net_amount)),
      })).filter((x) => x.value > 0),
    [rows],
  );

  const filtered = useMemo(
    () => (statusFilter === "all" ? rows : rows.filter((r) => r.status === statusFilter)),
    [rows, statusFilter],
  );

  return (
    <AppShell title="Financeiro" subtitle="Pagamentos de motoristas e saúde do caixa operacional">
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="A pagar"
            value={isLoading ? "…" : formatBRL(kpis.pending)}
            hint={`${kpis.pendingCount} pagamento(s) em aberto`}
            icon={<Clock className="h-4 w-4" />}
            tone="warning"
          />
          <KpiCard
            label="Pago no mês"
            value={isLoading ? "…" : formatBRL(kpis.paidMonth)}
            hint={`${kpis.paidMonthCount} pagamento(s) liquidado(s)`}
            icon={<CheckCircle2 className="h-4 w-4" />}
            tone="positive"
          />
          <KpiCard
            label="Pendências"
            value={isLoading ? "…" : formatBRL(kpis.issues)}
            hint={`${kpis.issuesCount} caso(s) a resolver`}
            icon={<AlertTriangle className="h-4 w-4" />}
            tone="danger"
          />
          <KpiCard
            label="Volume total"
            value={isLoading ? "…" : formatBRL(kpis.total)}
            hint={`${rows.length} pagamento(s) registrados`}
            icon={<Wallet className="h-4 w-4" />}
          />
        </div>

        {error ? (
          <p className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            Não foi possível carregar os pagamentos: {(error as Error).message}
          </p>
        ) : null}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ChartCard
            className="lg:col-span-2"
            title="Pagamentos por mês"
            description="Últimos 6 meses — liquidado x em aberto"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} className="text-xs" />
                <YAxis tickFormatter={(v) => compactBRL(Number(v))} tickLine={false} axisLine={false} width={80} className="text-xs" />
                <Tooltip formatter={(v) => formatBRL(Number(v))} />
                <Legend />
                <Bar dataKey="Pago" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="A pagar" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Distribuição por status" description="Valor líquido acumulado">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byStatus} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85}>
                  {byStatus.map((entry, i) => (
                    <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatBRL(Number(v))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <div className="flex flex-wrap gap-2">
          {(["all", ...PAYMENT_STATUS_ORDER] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                statusFilter === s
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {s === "all" ? "Todos" : PAYMENT_STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        <PaymentsTable rows={filtered} />
      </div>
    </AppShell>
  );
}
