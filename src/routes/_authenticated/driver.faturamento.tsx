import { driverValueLabel } from "@/lib/freight-values";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/pf";
import { CircleDollarSign, Clock, Truck, Wallet } from "lucide-react";
import { STATUS_LABEL } from "@/lib/order-status";
import { getDriverFinancials } from "@/lib/secure-driver-financials.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/_authenticated/driver/faturamento")({
  head: () => ({ meta: [
      { name: "description", content: 'Meu faturamento — Motorista. Informações e acompanhamento na plataforma INFINITLOG VAPT VUPT.' },
      { property: "og:title", content: 'Meu faturamento — Motorista' },
      { property: "og:description", content: 'Meu faturamento — Motorista. Informações e acompanhamento na plataforma INFINITLOG VAPT VUPT.' },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },{ title: "Meu faturamento — Motorista" }, { name: "robots", content: "noindex" }] }),
  component: DriverBilling,
});

function DriverBilling() {
  const [userId, setUserId] = useState("");
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (u.user) setUserId(u.user.id);
    })();
  }, []);

  const loadFinancials = useServerFn(getDriverFinancials);

  const driverQ = useQuery({
    enabled: !!userId,
    queryKey: ["driver-billing-profile", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("drivers")
        .select("preferred_payment_method, payment_term_days")
        .eq("user_id", userId)
        .maybeSingle();
      let financials: Awaited<ReturnType<typeof loadFinancials>> = null;
      try {
        financials = await loadFinancials({ data: { user_id: userId } });
      } catch {
        financials = null;
      }
      return { ...(data ?? {}), ...(financials ?? {}) } as any;
    },
  });

  const start = useMemo(() => new Date(year, month, 1).toISOString(), [year, month]);
  const end = useMemo(() => new Date(year, month + 1, 1).toISOString(), [year, month]);

  const ordersQ = useQuery({
    enabled: !!userId,
    queryKey: ["driver-billing-orders", userId, start, end],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, code, status, driver_amount, created_at, updated_at, origin_city, destination_city")
        .eq("driver_id", userId)
        .gte("updated_at", start)
        .lt("updated_at", end)
        .order("updated_at", { ascending: false });
      return data ?? [];
    },
  });

  const orders = ordersQ.data ?? [];
  const paymentsQ = useQuery({
    enabled: !!userId,
    queryKey: ['driver-payments', userId, start, end],
    queryFn: async () => {
      const { data, error } = await supabase.from('driver_payments')
        .select('order_id,status,gross_amount,net_amount,paid_amount,paid_at,created_at')
        .eq('driver_id', userId).gte('created_at', start).lt('created_at', end);
      if (error) throw error;
      return data ?? [];
    },
  });
  const payments = paymentsQ.data ?? [];
  const done = orders.filter((o) => ["delivered", "finalized"].includes(o.status));
  const inProgress = orders.filter((o) => !["delivered", "finalized", "cancelled"].includes(o.status));
  const paidIds = new Set(payments.filter(p => p.status === 'pago').map(p => p.order_id));
  const awaitingPay = done.filter((o) => !paidIds.has(o.id));
  const paid = done.filter((o) => paidIds.has(o.id));
  const total = done.reduce((s, o) => s + (Number(o.driver_amount) || 0), 0);
  const toReceive = awaitingPay.reduce((s, o) => s + Number(payments.find(p => p.order_id === o.id && p.status !== 'cancelado')?.net_amount ?? o.driver_amount ?? 0), 0);
  const received = payments.filter(p => p.status === 'pago').reduce((s, p) => s + Number(p.paid_amount ?? p.net_amount), 0);

  const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const years = [now.getFullYear() - 1, now.getFullYear()];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Meu faturamento</h1>
        <p className="mt-1 text-sm text-muted-foreground">Somente suas informações financeiras — nada de outros motoristas ou da empresa.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
          className="h-10 rounded-xl border border-border bg-surface px-3 text-sm">
          {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))}
          className="h-10 rounded-xl border border-border bg-surface px-3 text-sm">
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Metric label="Total do período" value={brl(total)} icon={<CircleDollarSign className="h-4 w-4" />} tone="brand" />
        <Metric label="Recebido" value={brl(received)} icon={<Wallet className="h-4 w-4" />} tone="success" />
        <Metric label="A receber" value={brl(toReceive)} icon={<Clock className="h-4 w-4" />} tone="amber" />
        <Metric label="Fretes concluídos" value={String(done.length)} icon={<Truck className="h-4 w-4" />} />
      </div>

      <section className="card-soft p-5">
        <SectionTitle>Dados de pagamento</SectionTitle>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Info label="PIX" value={driverQ.data?.pix_key ?? "—"} />
          <Info label="Tipo PIX" value={driverQ.data?.pix_key_type ?? "—"} />
          <Info label="Banco" value={driverQ.data?.bank_name ?? "—"} />
          <Info label="Agência" value={driverQ.data?.bank_agency ?? "—"} />
          <Info label="Conta" value={driverQ.data?.bank_account ? `${driverQ.data.bank_account}-${driverQ.data.bank_account_digit ?? ""}` : "—"} />
          <Info label="Tipo conta" value={driverQ.data?.bank_account_type ?? "—"} />
          <Info label="Favorecido" value={driverQ.data?.favored_name ?? "—"} />
          <Info label="Prazo pgto" value={driverQ.data?.payment_term_days ? `${driverQ.data.payment_term_days}d` : "—"} />
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle>Fretes em andamento ({inProgress.length})</SectionTitle>
        {inProgress.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-4 text-sm text-muted-foreground">Nenhum frete em andamento neste período.</div>
        ) : (
          <ul className="space-y-2">
            {inProgress.map((o) => <FreightLine key={o.id} o={o} />)}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <SectionTitle>Aguardando pagamento ({awaitingPay.length})</SectionTitle>
        {awaitingPay.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-4 text-sm text-muted-foreground">Nenhum frete aguardando pagamento.</div>
        ) : (
          <ul className="space-y-2">
            {awaitingPay.map((o) => <FreightLine key={o.id} o={o} />)}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <SectionTitle>Histórico de pagamentos ({paid.length})</SectionTitle>
        {paid.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-4 text-sm text-muted-foreground">Nenhum pagamento registrado no período.</div>
        ) : (
          <ul className="space-y-2">
            {paid.map((o) => <FreightLine key={o.id} o={o} />)}
          </ul>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value, icon, tone = "default" }: { label: string; value: string; icon: React.ReactNode; tone?: "default" | "brand" | "success" | "amber" }) {
  const map: Record<string, string> = {
    default: "border-border bg-surface",
    brand: "border-brand/40 bg-brand/5",
    success: "border-emerald-200 bg-emerald-50",
    amber: "border-amber-200 bg-amber-50",
  };
  return (
    <div className={`rounded-2xl border p-4 ${map[tone]}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-1 text-xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function FreightLine({ o }: { o: any }) {
  return (
    <li className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 text-sm">
      <div className="min-w-0">
        <div className="font-mono text-xs font-semibold">{o.code}</div>
        <div className="truncate text-xs text-muted-foreground">
          {o.origin_city ?? "—"} → {o.destination_city ?? "—"} · {STATUS_LABEL[o.status] ?? o.status}
        </div>
      </div>
      <div className="text-right">
        <div className="font-semibold">{driverValueLabel(o.driver_amount)}</div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {new Date(o.updated_at).toLocaleDateString("pt-BR")}
        </div>
      </div>
    </li>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{children}</h2>;
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface-2 px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-sm font-medium">{value}</div>
    </div>
  );
}
