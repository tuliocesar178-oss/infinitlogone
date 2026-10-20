import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STATUS_LABEL } from "@/lib/order-status";
import {
  buildWorkStats,
  compareKm,
  countedKm,
  formatKm,
  formatReportDate,
  type KmOrder,
  type WorkStat,
} from "@/lib/km-report";
import { KmBarChart, KmEvolutionChart } from "./km-charts";

type WorkInfo = { id: string; name: string; code: string | null };

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 truncate text-2xl font-semibold tabular-nums" title={value}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Variation({ current, previous }: { current: number; previous: number }) {
  const { abs, pct } = compareKm(current, previous);
  if (pct == null) {
    return <span className="text-xs text-muted-foreground">Sem dados para comparação</span>;
  }
  const up = abs >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${
        up ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {up ? "+" : ""}
      {formatKm(abs)} ({up ? "+" : ""}
      {pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%)
    </span>
  );
}

/** Dashboard comparativo de KM rodados por obra, com período anterior equivalente. */
export function KmComparative({
  currentOrders,
  previousOrders,
  works,
  driverMap,
  vehicleMap,
  workFilter,
  from,
  to,
  onSelectWork,
}: {
  currentOrders: KmOrder[];
  previousOrders: KmOrder[];
  works: WorkInfo[];
  driverMap: Map<string, string>;
  vehicleMap: Map<string, string>;
  workFilter: string;
  from: string;
  to: string;
  onSelectWork: (workId: string) => void;
}) {
  const [expandedWork, setExpandedWork] = useState<string | null>(null);
  const workMap = useMemo(() => new Map(works.map((work) => [work.id, work])), [works]);

  const stats = useMemo(() => [...buildWorkStats(currentOrders).values()], [currentOrders]);
  const previousStats = useMemo(() => buildWorkStats(previousOrders), [previousOrders]);

  const totalKm = stats.reduce((total, stat) => total + stat.km, 0);
  const estimatedKm = stats.reduce((total, stat) => total + stat.estimatedKm, 0);
  const totalFreights = stats.reduce((total, stat) => total + stat.freights, 0);
  const previousKm = [...previousStats.values()].reduce((total, stat) => total + stat.km, 0);
  const topWork = stats.length ? [...stats].sort((a, b) => b.km - a.km)[0] : null;

  const comparisonRows = useMemo(() => {
    const ids = new Set([...stats.map((s) => s.workId), ...previousStats.keys()]);
    return [...ids]
      .map((id) => ({
        workId: id,
        current: stats.find((s) => s.workId === id)?.km ?? 0,
        previous: previousStats.get(id)?.km ?? 0,
      }))
      .sort((a, b) => b.current - a.current);
  }, [stats, previousStats]);

  return (
    <section className="space-y-6" aria-label="Dashboard comparativo de KM por obra">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi
          label="Total de KM rodados"
          value={formatKm(totalKm)}
          hint={
            estimatedKm > 0
              ? `Inclui ${formatKm(estimatedKm)} planejados/estimados`
              : "Todos medidos nos fretes"
          }
        />
        <Kpi label="Obras atendidas" value={String(stats.length)} />
        <Kpi label="Total de fretes" value={totalFreights.toLocaleString("pt-BR")} />
        <Kpi
          label="Média de KM por frete"
          value={formatKm(totalFreights ? totalKm / totalFreights : 0)}
        />
        <Kpi
          label="Obra com maior KM"
          value={topWork ? (workMap.get(topWork.workId)?.name ?? "—") : "—"}
          hint={topWork ? formatKm(topWork.km) : undefined}
        />
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Vs. período anterior
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{formatKm(previousKm)}</p>
          <p className="mt-1">
            <Variation current={totalKm} previous={previousKm} />
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <KmBarChart
          stats={stats}
          workMap={workMap}
          selectedWorkId={workFilter}
          onSelectWork={onSelectWork}
        />
        <KmEvolutionChart orders={currentOrders} stats={stats} workMap={workMap} from={from} to={to} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Comparação com o período anterior equivalente</CardTitle>
        </CardHeader>
        <CardContent>
          {previousOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados para comparação.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3">Obra</th>
                    <th className="px-3 py-3 text-right">Período atual</th>
                    <th className="px-3 py-3 text-right">Período anterior</th>
                    <th className="px-3 py-3 text-right">Variação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {comparisonRows.map((row) => (
                    <tr key={row.workId}>
                      <td className="px-3 py-3 font-medium">
                        {workMap.get(row.workId)?.name ?? "Obra"}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatKm(row.current)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatKm(row.previous)}</td>
                      <td className="px-3 py-3 text-right">
                        <Variation current={row.current} previous={row.previous} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detalhamento por obra</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum frete vinculado a uma obra no período selecionado.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3" aria-label="Expandir" />
                    <th className="px-3 py-3">Cliente</th>
                    <th className="px-3 py-3">Obra</th>
                    <th className="px-3 py-3 text-right">Fretes</th>
                    <th className="px-3 py-3 text-right">KM total</th>
                    <th className="px-3 py-3 text-right">KM médio</th>
                    <th className="px-3 py-3 text-right">Motoristas</th>
                    <th className="px-3 py-3 text-right">Veículos</th>
                    <th className="px-3 py-3">Último frete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[...stats]
                    .sort((a, b) => b.km - a.km)
                    .map((stat) => {
                      const expanded = expandedWork === stat.workId;
                      const workOrders = currentOrders.filter(
                        (order) => order.work_id === stat.workId,
                      );
                      return [
                        <tr
                          key={stat.workId}
                          className="cursor-pointer transition hover:bg-muted/30"
                          onClick={() => setExpandedWork(expanded ? null : stat.workId)}
                        >
                          <td className="px-3 py-3">
                            {expanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </td>
                          <td className="px-3 py-3">{stat.clientName ?? "—"}</td>
                          <td className="px-3 py-3 font-medium">
                            {workMap.get(stat.workId)?.name ?? "Obra"}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">{stat.freights}</td>
                          <td className="px-3 py-3 text-right font-medium tabular-nums">
                            {formatKm(stat.km)}
                            {stat.estimatedKm > 0 && (
                              <span className="block text-xs font-normal text-muted-foreground">
                                {formatKm(stat.estimatedKm)} estimados
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">
                            {formatKm(stat.freights ? stat.km / stat.freights : 0)}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">{stat.drivers.size}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{stat.vehicles.size}</td>
                          <td className="px-3 py-3">
                            {stat.lastAt ? formatReportDate(stat.lastAt) : "—"}
                          </td>
                        </tr>,
                        expanded ? (
                          <tr key={`${stat.workId}-detail`} className="bg-muted/20">
                            <td colSpan={9} className="px-6 py-4">
                              <table className="w-full min-w-[640px] text-xs">
                                <thead className="text-left uppercase tracking-wide text-muted-foreground">
                                  <tr>
                                    <th className="py-2 pr-3">Data</th>
                                    <th className="py-2 pr-3">Frete</th>
                                    <th className="py-2 pr-3">Motorista</th>
                                    <th className="py-2 pr-3">Veículo</th>
                                    <th className="py-2 pr-3">Rota</th>
                                    <th className="py-2 pr-3 text-right">KM</th>
                                    <th className="py-2">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60">
                                  {workOrders.map((order) => {
                                    const { km, estimated } = countedKm(order);
                                    return (
                                      <tr key={order.id}>
                                        <td className="py-2 pr-3">
                                          {formatReportDate(order.created_at)}
                                        </td>
                                        <td className="py-2 pr-3 font-medium">
                                          <Link
                                            to="/ops/pedidos/$id"
                                            params={{ id: order.id }}
                                            className="text-primary hover:underline"
                                          >
                                            #{order.code}
                                          </Link>
                                        </td>
                                        <td className="py-2 pr-3">
                                          {driverMap.get(order.driver_id ?? "") ?? "—"}
                                        </td>
                                        <td className="py-2 pr-3">
                                          {vehicleMap.get(order.vehicle_id ?? "") ?? "—"}
                                        </td>
                                        <td className="py-2 pr-3">
                                          {[order.origin_city, order.origin_state]
                                            .filter(Boolean)
                                            .join("/") || "—"}
                                          {" → "}
                                          {[order.destination_city, order.destination_state]
                                            .filter(Boolean)
                                            .join("/") || "—"}
                                        </td>
                                        <td className="py-2 pr-3 text-right tabular-nums">
                                          {formatKm(km)}
                                          {estimated && (
                                            <span className="ml-1 text-muted-foreground">
                                              (est.)
                                            </span>
                                          )}
                                        </td>
                                        <td className="py-2">
                                          {STATUS_LABEL[order.status] ?? order.status}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        ) : null,
                      ];
                    })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        KM efetivo medido no frete; quando indisponível, usa o KM planejado marcado como estimado.
        Fretes cancelados não entram nos totais — filtre pelo status Cancelado para consultá-los.
      </p>
    </section>
  );
}
