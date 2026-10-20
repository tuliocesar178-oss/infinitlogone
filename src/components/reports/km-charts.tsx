import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  buildEvolution,
  formatKm,
  type Granularity,
  type KmOrder,
  type WorkStat,
} from "@/lib/km-report";

type WorkInfo = { id: string; name: string; code: string | null };

type BarMetric = "km" | "freights" | "average";

const METRIC_LABEL: Record<BarMetric, string> = {
  km: "KM rodados",
  freights: "Fretes",
  average: "KM médio por frete",
};

function metricValue(stat: WorkStat, metric: BarMetric) {
  if (metric === "freights") return stat.freights;
  if (metric === "average") return stat.freights ? stat.km / stat.freights : 0;
  return stat.km;
}

function formatMetric(value: number, metric: BarMetric) {
  return metric === "freights" ? String(value) : formatKm(value);
}

/** Barras horizontais ordenadas; clicar em uma obra filtra o dashboard. */
export function KmBarChart({
  stats,
  workMap,
  selectedWorkId,
  onSelectWork,
}: {
  stats: WorkStat[];
  workMap: Map<string, WorkInfo>;
  selectedWorkId: string;
  onSelectWork: (workId: string) => void;
}) {
  const [metric, setMetric] = useState<BarMetric>("km");
  const sorted = useMemo(
    () => [...stats].sort((a, b) => metricValue(b, metric) - metricValue(a, metric)),
    [stats, metric],
  );
  const max = sorted.length ? metricValue(sorted[0], metric) : 0;
  const totalKm = stats.reduce((total, stat) => total + stat.km, 0);

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle>KM por obra</CardTitle>
        <div className="flex gap-1 rounded-lg border border-border p-1">
          {(Object.keys(METRIC_LABEL) as BarMetric[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setMetric(key)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition",
                metric === key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {METRIC_LABEL[key]}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum frete vinculado a uma obra no período selecionado.
          </p>
        ) : (
          sorted.map((stat) => {
            const value = metricValue(stat, metric);
            const width = max > 0 ? (value / max) * 100 : 0;
            const share = totalKm > 0 ? (stat.km / totalKm) * 100 : 0;
            const work = workMap.get(stat.workId);
            const active = selectedWorkId === stat.workId;
            return (
              <button
                key={stat.workId}
                type="button"
                onClick={() => onSelectWork(active ? "" : stat.workId)}
                className={cn(
                  "block w-full rounded-lg border p-3 text-left transition hover:border-primary/50",
                  active ? "border-primary bg-primary/5" : "border-transparent",
                )}
              >
                <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{work?.name ?? "Obra"}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {stat.clientName ?? "Cliente não identificado"} · {stat.freights} frete(s) ·{" "}
                      {share.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do total
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {formatMetric(value, metric)}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-500"
                    style={{ width: `${width}%` }}
                  />
                </div>
              </button>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

const LINE_COLORS = ["#2563eb", "#0ea5e9", "#14b8a6", "#f59e0b", "#8b5cf6"];
const MAX_SELECTED = 5;

const GRANULARITY_LABEL: Record<Granularity, string> = {
  day: "Dia",
  week: "Semana",
  month: "Mês",
};

/** Evolução do KM ao longo do tempo, comparando várias obras. */
export function KmEvolutionChart({
  orders,
  stats,
  workMap,
  from,
  to,
}: {
  orders: KmOrder[];
  stats: WorkStat[];
  workMap: Map<string, WorkInfo>;
  from: string;
  to: string;
}) {
  const [granularity, setGranularity] = useState<Granularity>("day");
  const topWorkIds = useMemo(
    () => [...stats].sort((a, b) => b.km - a.km).slice(0, 3).map((stat) => stat.workId),
    [stats],
  );
  const [selected, setSelected] = useState<string[] | null>(null);
  const selectedIds = selected ?? topWorkIds;

  const data = useMemo(
    () => buildEvolution(orders, selectedIds, granularity, from, to),
    [orders, selectedIds, granularity, from, to],
  );

  function toggleWork(workId: string) {
    const base = selected ?? topWorkIds;
    const next = base.includes(workId)
      ? base.filter((id) => id !== workId)
      : base.length < MAX_SELECTED
        ? [...base, workId]
        : base;
    setSelected(next);
  }

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle>Evolução do KM no período</CardTitle>
        <div className="flex gap-1 rounded-lg border border-border p-1">
          {(Object.keys(GRANULARITY_LABEL) as Granularity[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setGranularity(key)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition",
                granularity === key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {GRANULARITY_LABEL[key]}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {stats.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados no período selecionado.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {[...stats]
                .sort((a, b) => b.km - a.km)
                .map((stat, index) => {
                  const active = selectedIds.includes(stat.workId);
                  return (
                    <button
                      key={stat.workId}
                      type="button"
                      onClick={() => toggleWork(stat.workId)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium transition",
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-muted",
                      )}
                    >
                      <span
                        className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                        style={{ background: LINE_COLORS[index % LINE_COLORS.length] }}
                      />
                      {workMap.get(stat.workId)?.name ?? "Obra"}
                    </button>
                  );
                })}
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="bucket" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      borderColor: "var(--border)",
                      color: "var(--foreground)",
                    }}
                    formatter={(value: number, name: string) => [
                      formatKm(value),
                      workMap.get(name)?.name ?? name,
                    ]}
                  />
                  <Legend formatter={(id: string) => workMap.get(id)?.name ?? id} />
                  {selectedIds.map((workId) => {
                    const index = stats.findIndex((stat) => stat.workId === workId);
                    return (
                      <Line
                        key={workId}
                        type="monotone"
                        dataKey={workId}
                        stroke={LINE_COLORS[(index < 0 ? 0 : index) % LINE_COLORS.length]}
                        strokeWidth={2}
                        dot={false}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
