import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { getUserRolesCached } from "@/lib/roles";
import {
  PAYMENT_STATUS,
  money,
  dt,
  downloadCsv,
  paymentBadgeClass,
  paymentStatusLabel,
  type PaymentStatus,
} from "@/lib/finance";
import { STATUS_LABEL } from "@/lib/order-status";
import { ArrowRight, Download, Search, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ops/financeiro/")({
  beforeLoad: async ({ context }) => {
    const user = (context as { user?: { id: string } }).user;
    if (!user) throw redirect({ to: "/auth" });
    const roles = await getUserRolesCached(user.id);
    if (!roles.includes("admin") && !roles.includes("financeiro")) {
      throw redirect({ to: "/ops/central" });
    }
  },
  head: () => ({
    meta: [{ title: "Financeiro — InfinitLog" }, { name: "robots", content: "noindex" }],
  }),
  component: FinancePanel,
});

type Row = {
  id: string;
  order_id: string;
  driver_id: string | null;
  status: PaymentStatus;
  gross_amount: number;
  additions_amount: number;
  discounts_amount: number;
  net_amount: number;
  paid_amount: number | null;
  paid_at: string | null;
  delivered_at: string | null;
  orders: {
    code: string;
    status: string;
    client_name: string | null;
    origin_city: string | null;
    destination_city: string | null;
    distance_km: number | null;
    vehicle_id: string | null;
  } | null;
};

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function FinancePanel() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [driverFilter, setDriverFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");

  const { data: rows, isLoading } = useQuery({
    queryKey: ["finance-payments"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_payments")
        .select(
          "id, order_id, driver_id, status, gross_amount, additions_amount, discounts_amount, net_amount, paid_amount, paid_at, delivered_at, orders:order_id(code, status, client_name, origin_city, destination_city, distance_km, vehicle_id)",
        )
        .order("delivered_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const driverIds = useMemo(
    () => Array.from(new Set((rows ?? []).map((r) => r.driver_id).filter(Boolean) as string[])),
    [rows],
  );

  const { data: drivers } = useQuery({
    enabled: driverIds.length > 0,
    queryKey: ["finance-drivers", driverIds.join(",")],
    queryFn: async () => {
      const [{ data: profs }, { data: drv }] = await Promise.all([
        supabase.from("profiles").select("id, full_name").in("id", driverIds),
        supabase.from("drivers").select("user_id, cpf").in("user_id", driverIds),
      ]);
      const cpfs = new Map((drv ?? []).map((d) => [d.user_id as string, d.cpf as string | null]));
      const map = new Map<string, { name: string; cpf: string | null }>();
      for (const p of profs ?? [])
        map.set(p.id as string, {
          name: (p.full_name as string) ?? "—",
          cpf: cpfs.get(p.id as string) ?? null,
        });
      return map;
    },
  });

  const vehicleIds = useMemo(
    () =>
      Array.from(
        new Set((rows ?? []).map((r) => r.orders?.vehicle_id).filter(Boolean) as string[]),
      ),
    [rows],
  );

  const { data: vehicles } = useQuery({
    enabled: vehicleIds.length > 0,
    queryKey: ["finance-vehicles", vehicleIds.join(",")],
    queryFn: async () => {
      const { data } = await supabase
        .from("vehicles")
        .select("id, plate, model, vehicle_type")
        .in("id", vehicleIds);
      return new Map(
        (data ?? []).map((v) => [
          v.id as string,
          { plate: v.plate as string, model: (v.model as string) ?? "", type: (v.vehicle_type as string) ?? "" },
        ]),
      );
    },
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => {
      if (status && r.status !== status) return false;
      const when = r.delivered_at ? new Date(r.delivered_at) : null;
      if (from && (!when || when < new Date(from))) return false;
      if (to && (!when || when > new Date(`${to}T23:59:59`))) return false;

      const d = r.driver_id ? drivers?.get(r.driver_id) : null;
      const veh = r.orders?.vehicle_id ? vehicles?.get(r.orders.vehicle_id) : null;

      if (driverFilter && r.driver_id !== driverFilter) return false;
      if (clientFilter && (r.orders?.client_name ?? "") !== clientFilter) return false;

      if (!term) return true;
      return [
        r.orders?.code,
        r.orders?.client_name,
        d?.name,
        d?.cpf,
        veh?.plate,
        r.orders?.origin_city,
        r.orders?.destination_city,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [rows, q, status, from, to, driverFilter, clientFilter, drivers, vehicles]);

  const kpi = useMemo(() => {
    const list = filtered;
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const by = (s: PaymentStatus) => list.filter((r) => r.status === s);
    const sum = (arr: Row[], f: (r: Row) => number) => arr.reduce((a, r) => a + (f(r) || 0), 0);
    const paid = by("pago");
    const toPay = list.filter((r) => ["aprovado", "agendado"].includes(r.status));
    return {
      analysis: by("aguardando_analise").length,
      review: by("em_conferencia").length + by("devolvido").length,
      approved: by("aprovado").length,
      paidCount: paid.length,
      paidMonth: sum(
        paid.filter((r) => r.paid_at && new Date(r.paid_at) >= monthStart),
        (r) => Number(r.paid_amount ?? r.net_amount),
      ),
      toPayValue: sum(toPay, (r) => Number(r.net_amount)),
      paidValue: sum(paid, (r) => Number(r.paid_amount ?? r.net_amount)),
      delivered: list.length,
    };
  }, [filtered]);

  const clients = useMemo(
    () =>
      Array.from(
        new Set((rows ?? []).map((r) => r.orders?.client_name).filter(Boolean) as string[]),
      ).sort(),
    [rows],
  );

  function exportCsv() {
    downloadCsv(
      `financeiro-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((r) => ({
        Frete: r.orders?.code ?? "",
        Entrega: dt(r.delivered_at),
        Cliente: r.orders?.client_name ?? "",
        Motorista: (r.driver_id && drivers?.get(r.driver_id)?.name) || "",
        Placa: (r.orders?.vehicle_id && vehicles?.get(r.orders.vehicle_id)?.plate) || "",
        Origem: r.orders?.origin_city ?? "",
        Destino: r.orders?.destination_city ?? "",
        KM: r.orders?.distance_km ?? "",
        Bruto: r.gross_amount,
        Adicionais: r.additions_amount,
        Descontos: r.discounts_amount,
        Liquido: r.net_amount,
        Status: paymentStatusLabel(r.status),
        Pagamento: dt(r.paid_at),
      })),
    );
  }

  return (
    <AppShell
      title="Financeiro"
      subtitle="Conferência, aprovação e pagamento dos fretes concluídos"
      actions={
        <button
          onClick={exportCsv}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-accent"
        >
          <Download className="h-4 w-4" /> Exportar CSV
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card label="Aguardando análise" value={String(kpi.analysis)} />
        <Card label="Em conferência" value={String(kpi.review)} />
        <Card label="Aprovados" value={String(kpi.approved)} />
        <Card label="Pagamentos realizados" value={String(kpi.paidCount)} />
        <Card label="A pagar" value={money(kpi.toPayValue)} hint="Aprovados + agendados" />
        <Card label="Pago no mês" value={money(kpi.paidMonth)} />
        <Card label="Total pago" value={money(kpi.paidValue)} hint="No filtro atual" />
        <Card label="Fretes no período" value={String(kpi.delivered)} />
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
          <label className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Frete, motorista, CPF, placa, cliente…"
              className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-sm"
            />
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Todos os status</option>
            {PAYMENT_STATUS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Todos os clientes</option>
            {clients.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={driverFilter}
            onChange={(e) => setDriverFilter(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Todos os motoristas</option>
            {Array.from(drivers?.entries() ?? []).map(([id, d]) => (
              <option key={id} value={id}>
                {d.name}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-2 py-2 text-sm"
            />
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-2 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-surface-2/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Frete</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Motorista</th>
                <th className="px-4 py-3">Veículo</th>
                <th className="px-4 py-3">Rota</th>
                <th className="px-4 py-3">KM</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                    Carregando…
                  </td>
                </tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                    <Wallet className="mx-auto mb-2 h-6 w-6" />
                    Nenhum frete enviado ao financeiro com esses filtros.
                  </td>
                </tr>
              )}
              {filtered.map((r) => {
                const d = r.driver_id ? drivers?.get(r.driver_id) : null;
                const veh = r.orders?.vehicle_id ? vehicles?.get(r.orders.vehicle_id) : null;
                return (
                  <tr key={r.id} className="hover:bg-accent/40">
                    <td className="px-4 py-3">
                      <div className="font-semibold">{r.orders?.code ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {dt(r.delivered_at)} · {STATUS_LABEL[r.orders?.status ?? ""] ?? "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3">{r.orders?.client_name ?? "—"}</td>
                    <td className="px-4 py-3">{d?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div>{veh?.plate ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{veh?.model ?? ""}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {r.orders?.origin_city ?? "—"} → {r.orders?.destination_city ?? "—"}
                    </td>
                    <td className="px-4 py-3">{r.orders?.distance_km ?? "—"}</td>
                    <td className="px-4 py-3 font-semibold">{money(r.net_amount)}</td>
                    <td className="px-4 py-3">
                      <span className={paymentBadgeClass(r.status)}>
                        {paymentStatusLabel(r.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to="/ops/financeiro/$id"
                        params={{ id: r.id }}
                        className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
                      >
                        Analisar <ArrowRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
