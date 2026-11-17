import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  CalendarDays,
  Download,
  FileText,
  Loader2,
  MapPin,
  RefreshCw,
  Truck,
  UserRound,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_LABEL, statusBadgeClass } from "@/lib/order-status";

export const Route = createFileRoute("/_authenticated/client/relatorios")({
  head: () => ({ meta: [{ title: 'client · relatorios — INFINITLOG' }, { name: "description", content: 'client · relatorios — INFINITLOG. Informações e acompanhamento na plataforma INFINITLOG VAPT VUPT.' }, { property: "og:title", content: 'client · relatorios — INFINITLOG' }, { property: "og:description", content: 'client · relatorios — INFINITLOG. Informações e acompanhamento na plataforma INFINITLOG VAPT VUPT.' }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" } ] }),
  component: ClientReports,
});

type ClientWork = {
  id: string;
  name: string;
  code: string | null;
};

type ReportOrder = {
  id: string;
  code: string;
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

type Driver = {
  user_id: string;
  email: string | null;
  license_category: string | null;
};

type Vehicle = {
  id: string;
  brand: string | null;
  model: string | null;
  plate: string;
};

const COMPLETED = new Set(["delivered", "finalized", "completed"]);

function currentMonthStart() {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function distance(order: ReportOrder) {
  return order.recorded_distance_km ?? order.distance_km ?? order.antt_distance_km ?? 0;
}

function formatKm(value: number) {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR");
}

function routeLabel(city: string | null, state: string | null) {
  return [city, state].filter(Boolean).join("/") || "—";
}

function ClientReports() {
  const [workFilter, setWorkFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [driverFilter, setDriverFilter] = useState("all");
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [originFilter, setOriginFilter] = useState("all");
  const [destinationFilter, setDestinationFilter] = useState("all");
  const [from, setFrom] = useState(currentMonthStart);
  const [to, setTo] = useState(today);

  const reportQuery = useQuery({
    queryKey: [
      "client-work-reports",
      workFilter,
      statusFilter,
      driverFilter,
      vehicleFilter,
      originFilter,
      destinationFilter,
      from,
      to,
    ],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) throw new Error("Usuário não autenticado.");
      const { getClientIdentityIds } = await import('@/lib/client-identity.functions');
      const clientIds = await getClientIdentityIds();

      const [{ data: works, error: worksError }, { data: orders, error: ordersError }] =
        await Promise.all([
          supabase
            .from("works")
            .select("id, name, code")
            .in("client_id", clientIds)
            .order("name"),
          supabase
            .from("orders")
            .select(
              "id, code, work_id, status, created_at, origin_city, origin_state, destination_city, destination_state, distance_km, recorded_distance_km, antt_distance_km, driver_id, vehicle_id",
            )
            .in("client_id", clientIds)
            .is("deleted_at", null)
            .gte("created_at", `${from}T00:00:00`)
            .lte("created_at", `${to}T23:59:59`)
            .order("created_at", { ascending: false }),
        ]);

      if (worksError) throw worksError;
      if (ordersError) throw ordersError;

      const rows = (orders ?? []) as unknown as ReportOrder[];
      const driverIds = [...new Set(rows.map((row) => row.driver_id).filter(Boolean))] as string[];
      const vehicleIds = [...new Set(rows.map((row) => row.vehicle_id).filter(Boolean))] as string[];

      const [{ data: drivers }, { data: vehicles }] = await Promise.all([
        driverIds.length
          ? supabase
              .from("drivers")
              .select("user_id, email, license_category")
              .in("user_id", driverIds)
          : Promise.resolve({ data: [] as Driver[] }),
        vehicleIds.length
          ? supabase.from("vehicles").select("id, brand, model, plate").in("id", vehicleIds)
          : Promise.resolve({ data: [] as Vehicle[] }),
      ]);

      return {
        works: (works ?? []) as unknown as ClientWork[],
        orders: rows,
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
    () =>
      new Map(
        (data?.drivers ?? []).map((driver) => [
          driver.user_id,
          driver.email ?? "Motorista identificado",
        ]),
      ),
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

  const filteredOrders = useMemo(
    () =>
      (data?.orders ?? []).filter((order) => {
        if (workFilter !== "all" && order.work_id !== workFilter) return false;
        if (statusFilter !== "all" && order.status !== statusFilter) return false;
        if (driverFilter !== "all" && order.driver_id !== driverFilter) return false;
        if (vehicleFilter !== "all" && order.vehicle_id !== vehicleFilter) return false;
        if (originFilter !== "all" && order.origin_city !== originFilter) return false;
        if (destinationFilter !== "all" && order.destination_city !== destinationFilter) return false;
        return true;
      }),
    [
      data?.orders,
      workFilter,
      statusFilter,
      driverFilter,
      vehicleFilter,
      originFilter,
      destinationFilter,
    ],
  );

  const workRows = useMemo(() => {
    const grouped = new Map<string, ReportOrder[]>();

    for (const order of filteredOrders) {
      if (!order.work_id) continue;
      grouped.set(order.work_id, [...(grouped.get(order.work_id) ?? []), order]);
    }

    return (data?.works ?? [])
      .map((work) => {
        const orders = grouped.get(work.id) ?? [];
        const km = orders.reduce((total, order) => total + distance(order), 0);
        return {
          work,
          orders,
          km,
          average: orders.length ? km / orders.length : 0,
          lastFreight: orders[0]?.created_at ?? null,
        };
      })
      .filter((row) => workFilter === "all" || row.work.id === workFilter);
  }, [data?.works, filteredOrders, workFilter]);

  const totalKm = filteredOrders.reduce((total, order) => total + distance(order), 0);
  const averageKm = filteredOrders.length ? totalKm / filteredOrders.length : 0;
  const completed = filteredOrders.filter((order) => COMPLETED.has(order.status)).length;
  const statusOptions = [...new Set((data?.orders ?? []).map((order) => order.status))];
  const origins = [...new Set((data?.orders ?? []).map((order) => order.origin_city).filter(Boolean))] as string[];
  const destinations = [
    ...new Set((data?.orders ?? []).map((order) => order.destination_city).filter(Boolean)),
  ] as string[];

  function clearFilters() {
    setWorkFilter("all");
    setStatusFilter("all");
    setDriverFilter("all");
    setVehicleFilter("all");
    setOriginFilter("all");
    setDestinationFilter("all");
    setFrom(currentMonthStart());
    setTo(today());
  }

  function exportCsv() {
    const selectedWork =
      workFilter === "all" ? "todas-as-obras" : workMap.get(workFilter)?.name ?? "obra";

    const header = [
      "Data",
      "Obra",
      "Frete",
      "Motorista",
      "Veículo",
      "Origem",
      "Destino",
      "KM",
      "Status",
    ];
    const body = filteredOrders.map((order) => [
      formatDate(order.created_at),
      workMap.get(order.work_id ?? "")?.name ?? "Sem obra",
      order.code,
      driverMap.get(order.driver_id ?? "") ?? "—",
      vehicleMap.get(order.vehicle_id ?? "") ?? "—",
      routeLabel(order.origin_city, order.origin_state),
      routeLabel(order.destination_city, order.destination_state),
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
    anchor.download = `relatorio-${selectedWork}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell
      title="Relatórios das minhas obras"
      subtitle="Acompanhe os fretes e quilômetros rodados em cada uma das suas obras."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => reportQuery.refetch()}>
            <RefreshCw /> Atualizar
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <FileText /> Exportar PDF
          </Button>
          <Button variant="outline" onClick={exportCsv} disabled={!filteredOrders.length}>
            <Download /> Exportar Excel
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-widest">
              <BarChart3 className="h-4 w-4" /> Filtros do relatório
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FilterField label="Obra">
              <Select value={workFilter} onValueChange={setWorkFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as minhas obras" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as minhas obras</SelectItem>
                  {(data?.works ?? []).map((work) => (
                    <SelectItem key={work.id} value={work.id}>
                      {work.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>

            <FilterField label="Período — de">
              <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            </FilterField>

            <FilterField label="Período — até">
              <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </FilterField>

            <FilterField label="Status">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue placeholder="Todos os status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  {statusOptions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {STATUS_LABEL[status] ?? status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>

            <FilterField label="Motorista">
              <Select value={driverFilter} onValueChange={setDriverFilter}>
                <SelectTrigger><SelectValue placeholder="Todos os motoristas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os motoristas</SelectItem>
                  {(data?.drivers ?? []).map((driver) => (
                    <SelectItem key={driver.user_id} value={driver.user_id}>
                      {driverMap.get(driver.user_id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>

            <FilterField label="Veículo">
              <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
                <SelectTrigger><SelectValue placeholder="Todos os veículos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os veículos</SelectItem>
                  {(data?.vehicles ?? []).map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      {vehicleMap.get(vehicle.id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>

            <FilterField label="Cidade de origem">
              <Select value={originFilter} onValueChange={setOriginFilter}>
                <SelectTrigger><SelectValue placeholder="Todas as origens" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as origens</SelectItem>
                  {origins.map((origin) => <SelectItem key={origin} value={origin}>{origin}</SelectItem>)}
                </SelectContent>
              </Select>
            </FilterField>

            <FilterField label="Cidade de destino">
              <Select value={destinationFilter} onValueChange={setDestinationFilter}>
                <SelectTrigger><SelectValue placeholder="Todos os destinos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os destinos</SelectItem>
                  {destinations.map((destination) => (
                    <SelectItem key={destination} value={destination}>{destination}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>

            <div className="flex items-end">
              <Button variant="secondary" className="w-full" onClick={clearFilters}>
                Limpar filtros
              </Button>
            </div>
          </CardContent>
        </Card>

        {reportQuery.isLoading ? (
          <div className="card-soft grid min-h-48 place-items-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando dados reais…
          </div>
        ) : reportQuery.isError ? (
          <div className="card-soft p-6 text-sm text-destructive">
            Não foi possível carregar os relatórios das suas obras.
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Summary icon={<Truck />} label="Fretes realizados" value={String(filteredOrders.length)} />
              <Summary icon={<MapPin />} label="KM rodados" value={formatKm(totalKm)} />
              <Summary icon={<BarChart3 />} label="Obras" value={String(workRows.filter((row) => row.orders.length).length)} />
              <Summary icon={<CalendarDays />} label="KM médio por frete" value={formatKm(averageKm)} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Desempenho por obra</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {workRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma obra encontrada no período selecionado.
                  </p>
                ) : (
                  <table className="w-full min-w-[680px] text-sm">
                    <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-3">Obra</th>
                        <th className="px-3 py-3 text-right">Fretes</th>
                        <th className="px-3 py-3 text-right">KM rodados</th>
                        <th className="px-3 py-3 text-right">KM médio</th>
                        <th className="px-3 py-3">Último frete</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {workRows.map((row) => (
                        <tr key={row.work.id} className="transition-colors hover:bg-muted/30">
                          <td className="px-3 py-3">
                            <button
                              type="button"
                              onClick={() => setWorkFilter(row.work.id)}
                              className="text-left font-medium text-primary hover:underline"
                            >
                              {row.work.name}
                            </button>
                            {row.work.code && (
                              <span className="ml-2 text-xs text-muted-foreground">{row.work.code}</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">{row.orders.length}</td>
                          <td className="px-3 py-3 text-right font-medium tabular-nums">
                            {formatKm(row.km)}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">
                            {formatKm(row.average)}
                          </td>
                          <td className="px-3 py-3">
                            {row.lastFreight ? formatDate(row.lastFreight) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t border-border bg-muted/30 font-semibold">
                      <tr>
                        <td className="px-3 py-3">Total selecionado</td>
                        <td className="px-3 py-3 text-right">{filteredOrders.length}</td>
                        <td className="px-3 py-3 text-right">{formatKm(totalKm)}</td>
                        <td className="px-3 py-3 text-right">{formatKm(averageKm)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>Quilômetros rodados por obra</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {workRows.filter((row) => row.orders.length).map((row) => {
                    const maxKm = Math.max(...workRows.map((item) => item.km), 1);
                    return (
                      <div key={row.work.id}>
                        <div className="mb-1 flex justify-between gap-3 text-sm">
                          <span className="truncate">{row.work.name}</span>
                          <span className="font-medium">{formatKm(row.km)}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${(row.km / maxKm) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Fretes realizados por obra</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {workRows.filter((row) => row.orders.length).map((row) => {
                    const maxFreights = Math.max(...workRows.map((item) => item.orders.length), 1);
                    return (
                      <div key={row.work.id}>
                        <div className="mb-1 flex justify-between gap-3 text-sm">
                          <span className="truncate">{row.work.name}</span>
                          <span className="font-medium">{row.orders.length} fretes</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${(row.orders.length / maxFreights) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Fretes realizados</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {from} até {to} · {completed} concluídos
                </p>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {filteredOrders.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    Nenhum frete encontrado para os filtros selecionados.
                  </div>
                ) : (
                  <table className="w-full min-w-[900px] text-sm">
                    <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-3">Data</th>
                        <th className="px-3 py-3">Frete</th>
                        <th className="px-3 py-3">Obra</th>
                        <th className="px-3 py-3">Motorista</th>
                        <th className="px-3 py-3">Veículo</th>
                        <th className="px-3 py-3">Rota</th>
                        <th className="px-3 py-3 text-right">KM</th>
                        <th className="px-3 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredOrders.map((order) => (
                        <tr key={order.id} className="hover:bg-muted/30">
                          <td className="px-3 py-3">{formatDate(order.created_at)}</td>
                          <td className="px-3 py-3">
                            <Link
                              to="/client/fretes"
                              className="font-medium text-primary hover:underline"
                            >
                              #{order.code}
                            </Link>
                          </td>
                          <td className="px-3 py-3">{workMap.get(order.work_id ?? "")?.name ?? "—"}</td>
                          <td className="px-3 py-3">
                            <span className="inline-flex items-center gap-1.5">
                              <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
                              {driverMap.get(order.driver_id ?? "") ?? "Não atribuído"}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <span className="inline-flex items-center gap-1.5">
                              <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                              {vehicleMap.get(order.vehicle_id ?? "") ?? "Não atribuído"}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            {routeLabel(order.origin_city, order.origin_state)}
                            {" → "}
                            {routeLabel(order.destination_city, order.destination_state)}
                          </td>
                          <td className="px-3 py-3 text-right font-medium tabular-nums">
                            {formatKm(distance(order))}
                          </td>
                          <td className="px-3 py-3">
                            <Badge className={statusBadgeClass(order.status)} variant="outline">
                              {STATUS_LABEL[order.status] ?? order.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

            <p className="text-right text-xs text-muted-foreground">
              Última atualização: {data?.updatedAt.toLocaleString("pt-BR") ?? "—"}
            </p>
          </>
        )}
      </div>
    </AppShell>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5 text-sm">
      <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function Summary({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-5">
        <span className="rounded-lg bg-primary/10 p-2 text-primary">{icon}</span>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
