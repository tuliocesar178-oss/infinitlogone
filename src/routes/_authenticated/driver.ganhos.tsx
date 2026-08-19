import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { dt, money, paymentBadgeClass, paymentStatusLabel } from "@/lib/finance";
import { CircleDollarSign, Clock, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/driver/ganhos")({
  head: () => ({
    meta: [{ title: "Meus ganhos — Motorista" }, { name: "robots", content: "noindex" }],
  }),
  component: DriverEarnings,
});

type Row = {
  id: string;
  status: string;
  net_amount: number;
  paid_amount: number | null;
  paid_at: string | null;
  delivered_at: string | null;
  orders: { code: string; origin_city: string | null; destination_city: string | null } | null;
};

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <div className="mt-2 text-xl font-bold tracking-tight">{value}</div>
    </div>
  );
}

function DriverEarnings() {
  const [userId, setUserId] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? ""));
  }, []);

  const { data: rows } = useQuery({
    enabled: !!userId,
    queryKey: ["driver-earnings", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("driver_payments")
        .select(
          "id, status, net_amount, paid_amount, paid_at, delivered_at, orders:order_id(code, origin_city, destination_city)",
        )
        .eq("driver_id", userId)
        .order("delivered_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const kpi = useMemo(() => {
    const list = rows ?? [];
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const paid = list.filter((r) => r.status === "pago");
    const pending = list.filter((r) => !["pago", "cancelado"].includes(r.status));
    const approved = list.filter((r) => ["aprovado", "agendado"].includes(r.status));
    const sum = (a: Row[], f: (r: Row) => number) => a.reduce((s, r) => s + (f(r) || 0), 0);
    return {
      total: list.length,
      paid: sum(paid, (r) => Number(r.paid_amount ?? r.net_amount)),
      month: sum(
        paid.filter((r) => r.paid_at && new Date(r.paid_at) >= monthStart),
        (r) => Number(r.paid_amount ?? r.net_amount),
      ),
      pending: sum(pending, (r) => Number(r.net_amount)),
      approved: sum(approved, (r) => Number(r.net_amount)),
    };
  }, [rows]);

  return (
    <div className="px-4 py-5">
      <h1 className="text-xl font-semibold tracking-tight">Meus ganhos</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Valores dos seus fretes concluídos, aprovações e pagamentos.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Stat label="Recebido no mês" value={money(kpi.month)} icon={CircleDollarSign} />
        <Stat label="Total recebido" value={money(kpi.paid)} icon={CheckCircle2} />
        <Stat label="Aprovado a receber" value={money(kpi.approved)} icon={Clock} />
        <Stat label="Em análise" value={money(kpi.pending)} icon={Clock} />
      </div>

      <h2 className="mt-7 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Histórico
      </h2>
      <ul className="mt-3 space-y-3">
        {(rows ?? []).map((r) => (
          <li key={r.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{r.orders?.code ?? "—"}</div>
                <div className="text-xs text-muted-foreground">
                  {r.orders?.origin_city ?? "—"} → {r.orders?.destination_city ?? "—"}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Entrega {dt(r.delivered_at)}
                  {r.paid_at ? ` · Pago em ${dt(r.paid_at)}` : ""}
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold">{money(r.paid_amount ?? r.net_amount)}</div>
                <span className={paymentBadgeClass(r.status)}>{paymentStatusLabel(r.status)}</span>
              </div>
            </div>
          </li>
        ))}
        {(rows ?? []).length === 0 && (
          <li className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Você ainda não possui fretes concluídos enviados ao financeiro.
          </li>
        )}
      </ul>

      <div className="mt-6 text-center">
        <Link to="/driver/faturamento" className="text-sm text-brand underline">
          Ver dados de faturamento e pagamento
        </Link>
      </div>
    </div>
  );
}
