import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/ops-central";
import { Award, Building2, Crown, DollarSign, Route, Truck } from "lucide-react";

export function ManagerPanel() {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthISO = monthStart.toISOString();

  const dataQ = useQuery({
    queryKey: ["manager-panel", monthISO],
    refetchInterval: 60_000,
    queryFn: async () => {
      const [ordersRes, costsRes, routesRes, vehiclesRes] = await Promise.all([
        supabase
          .from("orders")
          .select("id, price, distance_km, driver_id, client_name, vehicle_id, status, created_at")
          .gte("created_at", monthISO)
          .is("deleted_at", null),
        supabase.from("freight_costs").select("amount, kind, created_at").gte("created_at", monthISO),
        supabase
          .from("route_summaries")
          .select("total_distance_km, driver_id, created_at")
          .gte("created_at", monthISO),
        supabase.from("vehicles").select("id, plate"),
      ]);
      const orders = ordersRes.data ?? [];
      const costs = costsRes.data ?? [];
      const routes = routesRes.data ?? [];
      const vehicles = vehiclesRes.data ?? [];

      const faturamento = orders.reduce((s, o) => s + (Number(o.price) || 0), 0);
      const despesas = costs.reduce((s, c) => s + (Number(c.amount) || 0), 0);
      const lucro = faturamento - despesas;
      const totalKm = routes.reduce((s, r) => s + (Number(r.total_distance_km) || 0), 0);
      const custoPorKm = totalKm > 0 ? despesas / totalKm : 0;
      const delivered = orders.filter((o) => o.status === "delivered" || o.status === "finalized");
      const freteMedio = delivered.length > 0 ? faturamento / delivered.length : 0;

      const byDriver = new Map<string, { deliveries: number; revenue: number }>();
      for (const o of delivered) {
        if (!o.driver_id) continue;
        const cur = byDriver.get(o.driver_id) ?? { deliveries: 0, revenue: 0 };
        cur.deliveries++;
        cur.revenue += Number(o.price) || 0;
        byDriver.set(o.driver_id, cur);
      }
      const driverIds = Array.from(byDriver.keys());
      let driverNames = new Map<string, string>();
      if (driverIds.length) {
        const { data } = await supabase.from("profiles").select("id, full_name").in("id", driverIds);
        for (const p of data ?? []) driverNames.set(p.id, p.full_name ?? "Motorista");
      }
      const topDrivers = Array.from(byDriver.entries())
        .sort((a, b) => b[1].deliveries - a[1].deliveries)
        .slice(0, 5)
        .map(([id, v]) => ({ id, name: driverNames.get(id) ?? "Motorista", ...v }));

      const byClient = new Map<string, { revenue: number; count: number }>();
      for (const o of orders) {
        const key = o.client_name ?? "—";
        const cur = byClient.get(key) ?? { revenue: 0, count: 0 };
        cur.revenue += Number(o.price) || 0;
        cur.count++;
        byClient.set(key, cur);
      }
      const topClients = Array.from(byClient.entries())
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .slice(0, 5)
        .map(([name, v]) => ({ name, ...v }));

      const byVehicle = new Map<string, number>();
      for (const o of orders) if (o.vehicle_id) byVehicle.set(o.vehicle_id, (byVehicle.get(o.vehicle_id) ?? 0) + 1);
      const vehiclePlates = new Map(vehicles.map((v) => [v.id, v.plate]));
      const topVehicles = Array.from(byVehicle.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, count]) => ({ id, plate: vehiclePlates.get(id) ?? id.slice(0, 6), count }));

      return {
        faturamento,
        despesas,
        lucro,
        custoPorKm,
        freteMedio,
        totalKm,
        topDrivers,
        topClients,
        topVehicles,
      };
    },
  });

  const d = dataQ.data;

  const kpis = [
    { label: "Faturamento", value: formatBRL(d?.faturamento ?? 0), icon: DollarSign, tint: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200" },
    { label: "Despesas", value: formatBRL(d?.despesas ?? 0), icon: DollarSign, tint: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200" },
    { label: "Lucro", value: formatBRL(d?.lucro ?? 0), icon: Crown, tint: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200" },
    { label: "Custo por km", value: formatBRL(d?.custoPorKm ?? 0), icon: Route, tint: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200" },
    { label: "Frete médio", value: formatBRL(d?.freteMedio ?? 0), icon: Award, tint: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200" },
  ];

  return (
    <section className="card-soft p-5">
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Crown className="h-4 w-4 text-amber-500" />
          <h2 className="text-sm font-semibold">Painel do gestor · mês atual</h2>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Somente admin</span>
      </header>

      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3">
              <span className={`grid h-9 w-9 place-items-center rounded-lg ${k.tint}`}>
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="truncate text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {k.label}
                </div>
                <div className="text-base font-semibold tabular-nums">{k.value}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <RankCard title="Top motoristas" icon={<Award className="h-4 w-4 text-emerald-600" />}>
          {d?.topDrivers?.length ? (
            d.topDrivers.map((r, i) => (
              <RankRow key={r.id} pos={i + 1} name={r.name} value={`${r.deliveries} entregas`} extra={formatBRL(r.revenue)} />
            ))
          ) : (
            <Empty />
          )}
        </RankCard>
        <RankCard title="Clientes que mais faturam" icon={<Building2 className="h-4 w-4 text-indigo-600" />}>
          {d?.topClients?.length ? (
            d.topClients.map((r, i) => (
              <RankRow key={r.name} pos={i + 1} name={r.name} value={`${r.count} fretes`} extra={formatBRL(r.revenue)} />
            ))
          ) : (
            <Empty />
          )}
        </RankCard>
        <RankCard title="Veículos mais utilizados" icon={<Truck className="h-4 w-4 text-violet-600" />}>
          {d?.topVehicles?.length ? (
            d.topVehicles.map((r, i) => (
              <RankRow key={r.id} pos={i + 1} name={r.plate} value={`${r.count} fretes`} />
            ))
          ) : (
            <Empty />
          )}
        </RankCard>
      </div>
    </section>
  );
}

function RankCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <header className="mb-2 flex items-center gap-2 text-sm font-semibold">
        {icon} {title}
      </header>
      <ul className="space-y-1.5">{children}</ul>
    </div>
  );
}

function RankRow({ pos, name, value, extra }: { pos: number; name: string; value: string; extra?: string }) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-accent/40">
      <span className="flex min-w-0 items-center gap-2">
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand/10 text-[10px] font-bold text-brand">
          {pos}
        </span>
        <span className="truncate font-medium">{name}</span>
      </span>
      <span className="shrink-0 text-right text-[11px] text-muted-foreground">
        {value}
        {extra ? <span className="ml-1 font-semibold text-foreground">· {extra}</span> : null}
      </span>
    </li>
  );
}

function Empty() {
  return <li className="py-4 text-center text-xs text-muted-foreground">Sem dados no período.</li>;
}
