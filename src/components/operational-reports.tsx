import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Download, Loader2, Printer, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_LABEL } from "@/lib/order-status";
import { CANCELLED_STATUS, previousPeriod } from "@/lib/km-report";
import { KmComparative } from "@/components/reports/km-comparative";

type ReportOrder = {
  id: string;
  code: string;
  client_id: string | null;
  client_name: string | null;
  work_id: string | null;
  status: string;
  created_at: string;
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

type ReportWork = {
  id: string;
  client_id: string;
  name: string;
  code: string | null;
};

type Driver = { user_id: string; email: string | null };
type Vehicle = {
  id: string;
  brand: string | null;
  model: string | null;
  plate: string;
};

const COMPLETED = new Set(["delivered", "finalized", "completed"]);

function startOfMonth() {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
}

function formatKm(value: number) {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR");
}

function distance(order: ReportOrder) {
  return order.recorded_distance_km ?? order.distance_km ?? order.antt_distance_km ?? 0;
}

export function OperationalReports() {
  const [clientFilter, setClientFilter] = useState("");
  const [workFilter, setWorkFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [driverFilter, setDriverFilter] = useState("");
  const [vehicleFilter, setVehicleFilter] = useState("");
  const [originFilter, setOriginFilter] = useState("");
  const [destinationFilter, setDestinationFilter] = useState("");
  const [from, setFrom] = useState(startOfMonth);
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const accessQuery = useQuery({
    queryKey: ["operational-reports-access"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return { userId: null, role: "client" };

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      return {
        userId: user.id,
        role: roles?.some((item) => ["admin", "logistics", "supervisor", "operacional"].includes(item.role))
          ? "staff"
          : "client",
      };
    },
  });

  const reportQuery = useQuery({
    queryKey: ["operational-reports", accessQuery.data, from, to],
    enabled: !!accessQuery.data,
    queryFn: async () => {
      const isClient = accessQuery.data?.role === "client";
      const userId = accessQuery.data?.userId;
      const previous = previousPeriod(from, to);

      let ordersQuery = supabase
        .from("orders")
        .select(
          "id, code, client_id, client_name, work_id, status, created_at, origin_city, origin_state, destination_city, destination_state, distance_km, recorded_distance_km, antt_distance_km, driver_id, vehicle_id",
        )
        .is("deleted_at", null)
        .gte("created_at", `${previous.from}T00:00:00`)
        .lte("created_at", `${to}T23:59:59`)
        .order("created_at", { ascending: false });

      if (isClient && userId) ordersQuery = ordersQuery.eq("client_id", userId);

      const [{ data: orders, error: ordersError }, { data: works, error: worksError }] =
        await Promise.all([
          ordersQuery,
          (() => {
            let query = supabase
              .from("works")
              .select("id, client_id, name, code")
              .order("name");
            if (isClient && userId) query = query.eq("client_id", userId);
            return query;
          })(),
        ]);

      if (ordersError) throw ordersError;
      if (worksError) throw worksError;

      const rows = (orders ?? []) as ReportOrder[];
      const cutoff = `${from}T00:00:00`;
      const currentRows = rows.filter((row) => row.created_at >= cutoff);
      const previousRows = rows.filter((row) => row.created_at < cutoff);
      const driverIds = [...new Set(rows.map((row) => row.driver_id).filter(Boolean))] as string[];
      const vehicleIds = [...new Set(rows.map((row) => row.vehicle_id).filter(Boolean))] as string[];

      const [{ data: drivers }, { data: vehicles }] = await Promise.all([
        driverIds.length
          ? supabase.from("drivers").select("user_id, email").in("user_id", driverIds)
          : Promise.resolve({ data: [] as Driver[] }),
        vehicleIds.length
          ? supabase.from("vehicles").select("id, brand, model, plate").in("id", vehicleIds)
          : Promise.resolve({ data: [] as Vehicle[] }),
      ]);

      return {
        orders: currentRows,
        previousOrders: previousRows,
        works: ((works ?? []) as ReportWork[]),
        drivers: (drivers ?? []) as Driver[],
        vehicles: (vehicles ?? []) as Vehicle[],
        updatedAt: new Date(),
      };
    },
  });

  const data = reportQuery.data;
  const workMap = useMemo(
    () => new Map((data?.works ?? []).map((work) => [work.id, work])),
    [data?.works],
  );
  const driverMap = useMemo(
    () => new Map((data?.drivers ?? []).map((driver) => [driver.user_id, driver.email ?? "Motorista identificado"])),
    [data?.drivers],
  );
  const vehicleMap = useMemo(
    () =>
      new Map(
        (data?.vehicles ?? []).map((vehicle) => [
          vehicle.id,
          `${[vehicle.brand, vehicle.model].filter(Boolean).join(" ") || "Veículo identificado"} · ${vehicle.plate}`,
        ]),
      ),
    [data?.vehicles],
  );

  const applyFilters = useMemo(
    () => (orders: ReportOrder[]) =>
      orders.filter((order) => {
        if (!order.work_id) return false;
        // Cancelados não entram nos totais, salvo filtro explícito pelo status.
        if (!statusFilter && order.status === CANCELLED_STATUS) return false;
        if (clientFilter && order.client_id !== clientFilter) return false;
        if (workFilter && order.work_id !== workFilter) return false;
        if (statusFilter && order.status !== statusFilter) return false;
        if (driverFilter && order.driver_id !== driverFilter) return false;
        if (vehicleFilter && order.vehicle_id !== vehicleFilter) return false;
        if (originFilter && order.origin_city !== originFilter) return false;
        if (destinationFilter && order.destination_city !== destinationFilter) return false;
        return true;
      }),
    [clientFilter, workFilter, statusFilter, driverFilter, vehicleFilter, originFilter, destinationFilter],
  );

  const filteredOrders = useMemo(
    () => applyFilters(data?.orders ?? []),
    [applyFilters, data?.orders],
  );
  const filteredPrevious = useMemo(
    () => applyFilters(data?.previousOrders ?? []),
    [applyFilters, data?.previousOrders],
  );

  const workRows = useMemo(() => {
    const grouped = new Map<string, ReportOrder[]>();
    for (const order of filteredOrders) {
      if (!order.work_id) continue;
      grouped.set(order.work_id, [...(grouped.get(order.work_id) ?? []), order]);
    }

    return [...grouped.entries()]
      .map(([workId, orders]) => ({
        work: workMap.get(workId),
        orders,
        km: orders.reduce((total, order) => total + distance(order), 0),
        completed: orders.filter((order) => COMPLETED.has(order.status)).length,
      }))
      .filter((row) => row.work);
  }, [filteredOrders, workMap]);

  const totalKm = filteredOrders.reduce((total, order) => total + distance(order), 0);
  const completed = filteredOrders.filter((order) => COMPLETED.has(order.status)).length;
  const clients = [...new Map(
    (data?.orders ?? [])
      .filter((order) => order.client_id)
      .map((order) => [order.client_id, order.client_name ?? "Cliente identificado"]),
  )];

  const originCities = [...new Set(
    (data?.orders ?? []).map((order) => order.origin_city).filter(Boolean),
  )].sort() as string[];
  const destinationCities = [...new Set(
    (data?.orders ?? []).map((order) => order.destination_city).filter(Boolean),
  )].sort() as string[];

  function clearFilters() {
    setClientFilter("");
    setWorkFilter("");
    setStatusFilter("");
    setDriverFilter("");
    setVehicleFilter("");
    setOriginFilter("");
    setDestinationFilter("");
    setFrom(startOfMonth());
    setTo(new Date().toISOString().slice(0, 10));
  }

  function exportCsv() {
    const header = ["Data", "Cliente", "Obra", "Frete", "Motorista", "Veículo", "Origem", "Destino", "KM", "Status"];
    const body = filteredOrders.map((order) => [
      formatDate(order.created_at),
      order.client_name ?? "—",
      workMap.get(order.work_id ?? "")?.name ?? "—",
      order.code,
      driverMap.get(order.driver_id ?? "") ?? "—",
      vehicleMap.get(order.vehicle_id ?? "") ?? "—",
      [order.origin_city, order.origin_state].filter(Boolean).join("/"),
      [order.destination_city, order.destination_state].filter(Boolean).join("/"),
      distance(order).toFixed(2),
      STATUS_LABEL[order.status] ?? order.status,
    ]);

    const csv = [header, ...body]
      .map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(";"))
      .join("\n");

    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "relatorio-operacional.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório exportado.");
  }

  const availableWorks = (data?.works ?? []).filter(
    (work) => !clientFilter || work.client_id === clientFilter,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Centro de análise
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">Relatórios operacionais</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Clientes, obras, fretes e quilômetros rodados com dados reais da operação.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => reportQuery.refetch()}>
            <RefreshCw className="h-4 w-4" /> Atualizar
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Imprimir / PDF
          </Button>
          <Button variant="outline" onClick={exportCsv} disabled={!filteredOrders.length}>
            <Download className="h-4 w-4" /> Excel
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-widest">
            <Search className="h-4 w-4" /> Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {accessQuery.data?.role === "staff" && (
            <label className="text-sm">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Cliente</span>
              <select
                value={clientFilter}
                onChange={(event) => {
                  setClientFilter(event.target.value);
                  setWorkFilter("");
                }}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
              >
                <option value="">Todos os clientes</option>
                {clients.map(([id, name]) => (
                  <option key={id} value={id ?? ""}>{name}</option>
                ))}
              </select>
            </label>
          )}

          <label className="text-sm">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Obra</span>
            <select
              value={workFilter}
              onChange={(event) => setWorkFilter(event.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
            >
              <option value="">Todas as obras</option>
              {availableWorks.map((work) => (
                <option key={work.id} value={work.id}>{work.name}</option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
            >
              <option value="">Todos</option>
              {Object.entries(STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Motorista</span>
            <select
              value={driverFilter}
              onChange={(event) => setDriverFilter(event.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
            >
              <option value="">Todos</option>
              {(data?.drivers ?? []).map((driver) => (
                <option key={driver.user_id} value={driver.user_id}>
                  {driverMap.get(driver.user_id)}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Veículo</span>
            <select
              value={vehicleFilter}
              onChange={(event) => setVehicleFilter(event.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
            >
              <option value="">Todos</option>
              {(data?.vehicles ?? []).map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicleMap.get(vehicle.id)}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Origem</span>
            <select
              value={originFilter}
              onChange={(event) => setOriginFilter(event.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
            >
              <option value="">Todas as cidades</option>
              {originCities.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Destino</span>
            <select
              value={destinationFilter}
              onChange={(event) => setDestinationFilter(event.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
            >
              <option value="">Todas as cidades</option>
              {destinationCities.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">De</span>
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label className="text-sm">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Até</span>
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </label>

          <div className="flex items-end">
            <Button variant="secondary" className="w-full" onClick={clearFilters}>
              Limpar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {reportQuery.isLoading ? (
        <div className="card-soft grid min-h-48 place-items-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando dados reais da operação…
        </div>
      ) : reportQuery.isError ? (
        <div className="card-soft p-6 text-sm text-destructive">
          Não foi possível carregar os relatórios.
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Summary label="Total de fretes" value={filteredOrders.length.toLocaleString("pt-BR")} />
            <Summary label="KM rodados" value={formatKm(totalKm)} />
            <Summary
              label="KM médio por frete"
              value={formatKm(filteredOrders.length ? totalKm / filteredOrders.length : 0)}
            />
            <Summary label="Obras atendidas" value={String(workRows.length)} />
            <Summary
              label="Motoristas"
              value={String(new Set(filteredOrders.map((order) => order.driver_id).filter(Boolean)).size)}
            />
            <Summary
              label="Veículos"
              value={String(new Set(filteredOrders.map((order) => order.vehicle_id).filter(Boolean)).size)}
            />
            <Summary label="Fretes concluídos" value={String(completed)} />
            <Summary
              label="Em andamento"
              value={String(filteredOrders.length - completed)}
            />
          </div>

          <KmComparative
            currentOrders={filteredOrders}
            previousOrders={filteredPrevious}
            works={data?.works ?? []}
            driverMap={driverMap}
            vehicleMap={vehicleMap}
            workFilter={workFilter}
            from={from}
            to={to}
            onSelectWork={setWorkFilter}
          />

          <Card>
            <CardHeader>
              <CardTitle>Quilômetros rodados por obra</CardTitle>
            </CardHeader>
            <CardContent>
              {workRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum frete vinculado a uma obra no período selecionado.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-3">Cliente</th>
                        <th className="px-3 py-3">Obra</th>
                        <th className="px-3 py-3 text-right">Fretes</th>
                        <th className="px-3 py-3 text-right">KM rodados</th>
                        <th className="px-3 py-3 text-right">KM médio</th>
                        <th className="px-3 py-3 text-right">Concluídos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {workRows.map((row) => (
                        <tr key={row.work?.id} className="transition hover:bg-muted/30">
                          <td className="px-3 py-3">{row.orders[0]?.client_name ?? "—"}</td>
                          <td className="px-3 py-3 font-medium">
                            <Link
                              to="/ops/obras"
                              className="text-primary hover:underline"
                            >
                              {row.work?.name}
                            </Link>
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">{row.orders.length}</td>
                          <td className="px-3 py-3 text-right font-medium tabular-nums">
                            {formatKm(row.km)}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">
                            {formatKm(row.orders.length ? row.km / row.orders.length : 0)}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">{row.completed}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>KM por obra</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {workRows.map((row) => {
                  const percentage = totalKm ? (row.km / totalKm) * 100 : 0;
                  return (
                    <div key={row.work?.id}>
                      <div className="mb-1 flex justify-between gap-3 text-sm">
                        <span className="truncate">{row.work?.name}</span>
                        <span className="shrink-0 font-medium">{formatKm(row.km)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${percentage}%` }} />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Detalhamento dos fretes</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-sm">
                  <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-2 py-3">Data</th>
                      <th className="px-2 py-3">Frete</th>
                      <th className="px-2 py-3">Obra</th>
                      <th className="px-2 py-3">Motorista</th>
                      <th className="px-2 py-3">Veículo</th>
                      <th className="px-2 py-3 text-right">KM</th>
                      <th className="px-2 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredOrders.slice(0, 100).map((order) => (
                      <tr key={order.id}>
                        <td className="px-2 py-3">{formatDate(order.created_at)}</td>
                        <td className="px-2 py-3">
                          <Link
                            to="/ops/pedidos/$id"
                            params={{ id: order.id }}
                            className="font-medium text-primary hover:underline"
                          >
                            #{order.code}
                          </Link>
                        </td>
                        <td className="px-2 py-3">{workMap.get(order.work_id ?? "")?.name ?? "—"}</td>
                        <td className="px-2 py-3">{driverMap.get(order.driver_id ?? "") ?? "—"}</td>
                        <td className="px-2 py-3">{vehicleMap.get(order.vehicle_id ?? "") ?? "—"}</td>
                        <td className="px-2 py-3 text-right tabular-nums">{formatKm(distance(order))}</td>
                        <td className="px-2 py-3">{STATUS_LABEL[order.status] ?? order.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredOrders.length > 100 && (
                  <p className="mt-4 text-xs text-muted-foreground">
                    Exibindo os 100 primeiros fretes. Use os filtros para refinar o resultado.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <p className="text-right text-xs text-muted-foreground">
            Última atualização: {data?.updatedAt.toLocaleString("pt-BR") ?? "—"}
          </p>
        </>
      )}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}