import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Download, FileText, Loader2, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Work } from "@/lib/work";
import { STATUS_LABEL } from "@/lib/order-status";

type WorkOrder = {
  id: string;
  code: string;
  created_at: string;
  scheduled_at: string | null;
  status: string;
  origin_city: string | null;
  origin_state: string | null;
  destination_city: string | null;
  destination_state: string | null;
  distance_km: number | null;
  recorded_distance_km: number | null;
  antt_distance_km: number | null;
  driver_id: string | null;
  vehicle_id: string | null;
};

type ReportRow = WorkOrder & {
  driverName: string;
  vehicleLabel: string;
  distance: number;
};

const COMPLETED_STATUSES = new Set(["delivered", "finalized"]);
const ACTIVE_STATUSES = new Set([
  "planning",
  "created",
  "preparing",
  "awaiting_driver",
  "negotiating",
  "driver_assigned",
  "en_route_pickup",
  "at_pickup",
  "loaded",
  "picked_up",
  "out_for_delivery",
  "in_transit",
  "near_destination",
  "at_destination",
  "incident",
]);

function formatKm(value: number) {
  return `${value.toLocaleString("pt-BR", {
    maximumFractionDigits: 2,
  })} km`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR");
}

function monthStart() {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
}

function monthEnd() {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);
}

export function WorkKmReport({ work }: { work: Work }) {
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(monthEnd);

  const reportQuery = useQuery({
    queryKey: ["work-km-report", work.id, from, to],
    queryFn: async () => {
      const start = `${from}T00:00:00`;
      const end = `${to}T23:59:59`;

      const { data: orders, error } = await supabase
        .from("orders")
        .select(
          "id, code, created_at, scheduled_at, status, origin_city, origin_state, destination_city, destination_state, distance_km, recorded_distance_km, antt_distance_km, driver_id, vehicle_id",
        )
        .eq("work_id", work.id)
        .gte("created_at", start)
        .lte("created_at", end)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const rows = (orders ?? []) as WorkOrder[];
      const driverIds = [...new Set(rows.map((row) => row.driver_id).filter(Boolean))] as string[];
      const vehicleIds = [...new Set(rows.map((row) => row.vehicle_id).filter(Boolean))] as string[];

      const [{ data: drivers }, { data: vehicles }] = await Promise.all([
        driverIds.length
          ? supabase.from("drivers").select("user_id, email").in("user_id", driverIds)
          : Promise.resolve({ data: [] }),
        vehicleIds.length
          ? supabase.from("vehicles").select("id, brand, model, plate").in("id", vehicleIds)
          : Promise.resolve({ data: [] }),
      ]);

      const driverMap = new Map(
        (drivers ?? []).map((driver) => [
          driver.user_id,
          driver.email ?? "Motorista identificado",
        ]),
      );
      const vehicleMap = new Map(
        (vehicles ?? []).map((vehicle) => [
          vehicle.id,
          [vehicle.brand, vehicle.model, vehicle.plate].filter(Boolean).join(" · ") ||
            "Veículo identificado",
        ]),
      );

      return rows.map((row): ReportRow => ({
        ...row,
        distance:
          row.recorded_distance_km ??
          row.distance_km ??
          row.antt_distance_km ??
          0,
        driverName: row.driver_id
          ? driverMap.get(row.driver_id) ?? "Motorista identificado"
          : "Não atribuído",
        vehicleLabel: row.vehicle_id
          ? vehicleMap.get(row.vehicle_id) ?? "Veículo identificado"
          : "Não atribuído",
      }));
    },
  });

  const rows = reportQuery.data ?? [];
  const totalKm = useMemo(
    () => rows.reduce((total, row) => total + row.distance, 0),
    [rows],
  );
  const completed = rows.filter((row) => COMPLETED_STATUSES.has(row.status)).length;
  const active = rows.filter((row) => ACTIVE_STATUSES.has(row.status)).length;
  const average = rows.length ? totalKm / rows.length : 0;

  function exportCsv() {
    const header = [
      "Data",
      "Frete",
      "Motorista",
      "Veículo",
      "Origem",
      "Destino",
      "KM",
      "Status",
    ];

    const body = rows.map((row) => [
      formatDate(row.created_at),
      row.code,
      row.driverName,
      row.vehicleLabel,
      [row.origin_city, row.origin_state].filter(Boolean).join("/"),
      [row.destination_city, row.destination_state].filter(Boolean).join("/"),
      row.distance.toFixed(2),
      STATUS_LABEL[row.status] ?? row.status,
    ]);

    const csv = [header, ...body]
      .map((line) =>
        line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(";"),
      )
      .join("\n");

    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `relatorio-km-${work.code || work.name}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Relatório individual por obra
          </p>
          <h2 className="mt-1 text-2xl font-semibold">
            Relatório de KM — {work.name}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Somente fretes vinculados à obra selecionada.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer /> Exportar PDF
          </Button>
          <Button variant="outline" onClick={exportCsv} disabled={!rows.length}>
            <Download /> Exportar Excel
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
            De
          </span>
          <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label className="text-sm">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Até
          </span>
          <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
        <div className="flex items-end">
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              setFrom(monthStart());
              setTo(monthEnd());
            }}
          >
            Este mês
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Total de fretes" value={String(rows.length)} />
        <Metric label="Total de KM rodados" value={formatKm(totalKm)} />
        <Metric label="KM médio por frete" value={formatKm(average)} />
        <Metric
          label="Concluídos / em andamento"
          value={`${completed} / ${active}`}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h3 className="font-semibold">Fretes da obra</h3>
            <p className="text-xs text-muted-foreground">
              {from} até {to}
            </p>
          </div>
          {reportQuery.isFetching && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {reportQuery.isError ? (
          <p className="p-6 text-sm text-destructive">
            Não foi possível carregar o relatório desta obra.
          </p>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center">
            <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Nenhum frete encontrado para esta obra no período selecionado.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Frete</th>
                  <th className="px-4 py-3">Motorista</th>
                  <th className="px-4 py-3">Veículo</th>
                  <th className="px-4 py-3">Rota</th>
                  <th className="px-4 py-3 text-right">KM</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">{formatDate(row.created_at)}</td>
                    <td className="px-4 py-3 font-medium">
                      <Link
                        to="/ops/pedidos/$id"
                        params={{ id: row.id }}
                        className="text-primary hover:underline"
                      >
                        #{row.code}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{row.driverName}</td>
                    <td className="px-4 py-3">{row.vehicleLabel}</td>
                    <td className="px-4 py-3">
                      {[row.origin_city, row.origin_state].filter(Boolean).join("/") || "—"}
                      {" → "}
                      {[row.destination_city, row.destination_state]
                        .filter(Boolean)
                        .join("/") || "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {formatKm(row.distance)}
                    </td>
                    <td className="px-4 py-3">
                      {STATUS_LABEL[row.status] ?? row.status}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-border bg-muted/30 font-semibold">
                <tr>
                  <td className="px-4 py-3" colSpan={5}>
                    Total
                  </td>
                  <td className="px-4 py-3 text-right">{formatKm(totalKm)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}