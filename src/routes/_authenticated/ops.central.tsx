import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { FleetMap, type FleetVehicle } from "@/components/fleet-map";
import { KpiBar, type Kpi } from "@/components/ops/kpi-bar";
import { DispatchQueue, type DispatchOrder } from "@/components/ops/dispatch-queue";
import { ActiveFreights, type ActiveOrder } from "@/components/ops/active-freights";
import { AlertsPanel } from "@/components/ops/alerts-panel";
import {
  ACTIVE_STATUSES,
  AWAITING_STATUSES,
  type OpsAlert,
} from "@/lib/ops-central";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  Package,
  Plus,
  Route as RouteIcon,
  Truck,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/ops/central")({
  head: () => ({
    meta: [
      { title: "Central Operacional — InfinitLog" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CentralOperacional,
});

function CentralOperacional() {
  const qc = useQueryClient();
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // ------- Data ----------
  const ordersQ = useQuery({
    queryKey: ["central-orders"],
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, code, tracking_code, status, client_name, contact_phone, origin_city, destination_city, origin_lat, origin_lng, destination_lat, destination_lng, priority, cargo_weight_kg, volumes, price, pickup_window_start, pickup_window_end, delivery_window_start, delivery_window_end, distance_to_destination_km, initial_distance_km, eta_minutes, last_ping_at, driver_id, vehicle_id, created_at",
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data ?? [];
    },
  });

  const vehiclesQ = useQuery({
    queryKey: ["central-vehicles"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select(
          "id, plate, model, status, vehicle_type, current_lat, current_lng, current_city, current_state, current_speed_kmh, last_location_at, photo_url, owner_driver_id",
        );
      if (error) throw error;
      return data ?? [];
    },
  });

  const driversQ = useQuery({
    queryKey: ["central-drivers"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drivers")
        .select(
          "user_id, status, availability, current_lat, current_lng, city, last_seen_at, cnh_expires_at, antt_expires_at",
        );
      if (error) throw error;
      return data ?? [];
    },
  });

  const incidentsQ = useQuery({
    queryKey: ["central-incidents"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incidents")
        .select("id, order_id, type, description, severity, resolved_at, created_at")
        .is("resolved_at", null)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const offersQ = useQuery({
    queryKey: ["central-offers"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("freight_offers")
        .select("id, order_id, driver_id, status, created_at")
        .gte("created_at", since)
        .in("status", ["declined", "negotiating"] as any);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel("central-op")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () =>
        qc.invalidateQueries({ queryKey: ["central-orders"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "vehicles" }, () =>
        qc.invalidateQueries({ queryKey: ["central-vehicles"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "drivers" }, () =>
        qc.invalidateQueries({ queryKey: ["central-drivers"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "incidents" }, () =>
        qc.invalidateQueries({ queryKey: ["central-incidents"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "freight_offers" }, () =>
        qc.invalidateQueries({ queryKey: ["central-offers"] }),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "driver_locations" },
        () => {
          qc.invalidateQueries({ queryKey: ["central-orders"] });
          qc.invalidateQueries({ queryKey: ["central-vehicles"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const orders = ordersQ.data ?? [];
  const vehicles = vehiclesQ.data ?? [];
  const drivers = driversQ.data ?? [];
  const incidents = incidentsQ.data ?? [];
  const offers = offersQ.data ?? [];

  const driverIds = useMemo(() => {
    const ids = new Set<string>();
    for (const v of vehicles) if (v.owner_driver_id) ids.add(v.owner_driver_id);
    for (const o of orders) if (o.driver_id) ids.add(o.driver_id);
    return Array.from(ids);
  }, [vehicles, orders]);

  const profilesQ = useQuery({
    queryKey: ["central-profiles", driverIds],
    enabled: driverIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone")
        .in("id", driverIds);
      if (error) throw error;
      const map = new Map<string, { name?: string | null; phone?: string | null }>();
      for (const p of data ?? []) map.set(p.id, { name: p.full_name, phone: p.phone });
      return map;
    },
  });
  const profiles = profilesQ.data ?? new Map();

  // Filters
  const cities = useMemo(() => {
    const s = new Set<string>();
    for (const o of orders) {
      if (o.origin_city) s.add(o.origin_city);
      if (o.destination_city) s.add(o.destination_city);
    }
    return Array.from(s).sort();
  }, [orders]);

  function matchesFilters(o: (typeof orders)[number]) {
    if (
      cityFilter !== "all" &&
      o.origin_city !== cityFilter &&
      o.destination_city !== cityFilter
    )
      return false;
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    return true;
  }

  // Derived lists
  const filteredOrders = orders.filter(matchesFilters);
  const awaiting: DispatchOrder[] = filteredOrders.filter(
    (o) => AWAITING_STATUSES.includes(o.status) && !o.driver_id,
  );
  const active: ActiveOrder[] = filteredOrders
    .filter((o) => ACTIVE_STATUSES.includes(o.status))
    .map((o) => ({
      ...o,
      driverName: o.driver_id ? profiles.get(o.driver_id)?.name ?? null : null,
      vehiclePlate:
        vehicles.find((v) => v.id === o.vehicle_id)?.plate ?? null,
    }));

  // Fleet map data
  const orderByVehicle = new Map<string, (typeof orders)[number]>();
  for (const o of active) if (o.vehicle_id) orderByVehicle.set(o.vehicle_id, o as any);

  const fleet: FleetVehicle[] = useMemo(() => {
    return vehicles
      .filter((v) => v.current_lat != null && v.current_lng != null)
      .map((v) => {
        const o = orderByVehicle.get(v.id);
        const driverProfile = v.owner_driver_id
          ? profiles.get(v.owner_driver_id)
          : o?.driver_id
            ? profiles.get(o.driver_id)
            : undefined;
        return {
          id: v.id,
          plate: v.plate,
          model: v.model,
          status: v.status,
          lat: v.current_lat as number,
          lng: v.current_lng as number,
          speed: v.current_speed_kmh,
          driverName: driverProfile?.name ?? null,
          driverPhone: driverProfile?.phone ?? null,
          photoUrl: v.photo_url,
          order: o
            ? {
                id: o.id,
                tracking_code: o.tracking_code,
                client_name: o.client_name,
                origin_city: o.origin_city,
                destination_city: o.destination_city,
                status: o.status,
                eta_minutes: o.eta_minutes,
                distance_km: o.distance_to_destination_km,
                initial_distance_km: o.initial_distance_km,
                last_ping_at: o.last_ping_at,
              }
            : null,
        };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicles, active, profiles]);

  // KPIs
  const today = new Date().toISOString().slice(0, 10);
  const isToday = (d?: string | null) => d?.slice(0, 10) === today;
  const kpis: Kpi[] = [
    {
      key: "active",
      label: "Fretes ativos",
      value: orders.filter((o) => ACTIVE_STATUSES.includes(o.status)).length,
      icon: <Activity className="h-4 w-4" />,
      tint: "bg-sky-100 text-sky-700",
    },
    {
      key: "drivers-online",
      label: "Motoristas online",
      value: drivers.filter((d) => d.availability !== "offline" && d.status !== "offline").length,
      icon: <Users className="h-4 w-4" />,
      tint: "bg-emerald-100 text-emerald-700",
    },
    {
      key: "drivers-available",
      label: "Disponíveis",
      value: drivers.filter((d) => d.availability === "disponivel").length,
      icon: <CheckCircle2 className="h-4 w-4" />,
      tint: "bg-emerald-100 text-emerald-700",
    },
    {
      key: "veh-available",
      label: "Veículos disp.",
      value: vehicles.filter((v) => v.status === "disponivel").length,
      icon: <Truck className="h-4 w-4" />,
      tint: "bg-emerald-100 text-emerald-700",
    },
    {
      key: "awaiting",
      label: "Aguardando",
      value: awaiting.length,
      icon: <Clock className="h-4 w-4" />,
      tint: "bg-amber-100 text-amber-700",
    },
    {
      key: "in-transit",
      label: "Em trânsito",
      value: orders.filter((o) =>
        ["in_transit", "out_for_delivery", "picked_up", "loaded"].includes(o.status),
      ).length,
      icon: <RouteIcon className="h-4 w-4" />,
      tint: "bg-indigo-100 text-indigo-700",
    },
    {
      key: "near",
      label: "Próx. entrega",
      value: orders.filter((o) => o.status === "near_destination").length,
      icon: <Package className="h-4 w-4" />,
      tint: "bg-violet-100 text-violet-700",
    },
    {
      key: "delivered-today",
      label: "Entregues hoje",
      value: orders.filter(
        (o) =>
          (o.status === "delivered" || o.status === "finalized") && isToday(o.created_at),
      ).length,
      icon: <CheckCircle2 className="h-4 w-4" />,
      tint: "bg-emerald-100 text-emerald-700",
    },
    {
      key: "incidents",
      label: "Ocorrências",
      value: incidents.length,
      icon: <AlertTriangle className="h-4 w-4" />,
      tint: "bg-rose-100 text-rose-700",
    },
  ];

  // Alerts derivation
  const alerts: OpsAlert[] = useMemo(() => {
    const list: OpsAlert[] = [];
    const now = Date.now();

    for (const inc of incidents) {
      list.push({
        id: `inc-${inc.id}`,
        severity: inc.severity === "alta" || inc.severity === "critica" ? "critical" : "warn",
        kind: "Ocorrência",
        title: inc.type ?? "Ocorrência aberta",
        detail: inc.description ?? undefined,
        orderId: inc.order_id,
        createdAt: inc.created_at,
      });
    }

    for (const off of offers) {
      const order = orders.find((o) => o.id === off.order_id);
      list.push({
        id: `off-${off.id}`,
        severity: off.status === "declined" ? "warn" : "info",
        kind: off.status === "declined" ? "Recusa" : "Negociação",
        title:
          off.status === "declined"
            ? "Motorista recusou frete"
            : "Motorista em negociação",
        detail: order ? `${order.code} · ${order.client_name ?? ""}` : undefined,
        orderId: off.order_id,
        driverId: off.driver_id,
        createdAt: off.created_at,
      });
    }

    for (const o of orders) {
      if (!ACTIVE_STATUSES.includes(o.status)) continue;
      // GPS disconnected
      if (o.last_ping_at) {
        const diffMin = (now - new Date(o.last_ping_at).getTime()) / 60000;
        if (diffMin > 10) {
          list.push({
            id: `gps-${o.id}`,
            severity: diffMin > 30 ? "critical" : "warn",
            kind: "GPS",
            title: "GPS desconectado",
            detail: `${o.code} · sem sinal há ${Math.round(diffMin)} min`,
            orderId: o.id,
            createdAt: o.last_ping_at,
          });
        }
      }
      // Late delivery
      if (o.delivery_window_end && o.status !== "delivered" && o.status !== "finalized") {
        const end = new Date(o.delivery_window_end).getTime();
        if (end < now) {
          list.push({
            id: `late-${o.id}`,
            severity: "critical",
            kind: "Atraso",
            title: "Entrega atrasada",
            detail: `${o.code} · ${o.client_name ?? ""}`,
            orderId: o.id,
            createdAt: o.delivery_window_end,
          });
        }
      }
      // Driver offline on active order
      if (o.driver_id) {
        const d = drivers.find((x) => x.user_id === o.driver_id);
        if (d && (d.availability === "offline" || d.status === "offline")) {
          list.push({
            id: `doff-${o.id}`,
            severity: "warn",
            kind: "Motorista",
            title: "Motorista offline em frete ativo",
            detail: `${o.code}`,
            orderId: o.id,
            driverId: o.driver_id,
            createdAt: d.last_seen_at ?? new Date().toISOString(),
          });
        }
      }
    }

    // CNH/ANTT expiring in ≤30 days
    for (const d of drivers) {
      const p = profiles.get(d.user_id);
      const name = p?.name ?? "Motorista";
      for (const [field, label] of [
        ["cnh_expires_at", "CNH"],
        ["antt_expires_at", "ANTT"],
      ] as const) {
        const v = (d as any)[field] as string | null | undefined;
        if (!v) continue;
        const days = Math.round((new Date(v).getTime() - now) / 86400000);
        if (days <= 30 && days >= -30) {
          list.push({
            id: `doc-${d.user_id}-${field}`,
            severity: days < 0 ? "critical" : days <= 7 ? "warn" : "info",
            kind: "Documento",
            title: days < 0 ? `${label} vencida` : `${label} vencendo`,
            detail: `${name} · ${days < 0 ? `há ${-days}d` : `em ${days}d`}`,
            driverId: d.user_id,
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    return list;
  }, [orders, incidents, offers, drivers, profiles]);

  return (
    <AppShell
      title="Central Operacional"
      subtitle="Controle completo da operação em tempo real."
      actions={
        <Link
          to="/ops/pedidos/novo"
          className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground shadow-sm hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Nova entrega
        </Link>
      }
    >
      <KpiBar kpis={kpis} />

      {/* Filters */}
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card p-2">
        <Filter className="ml-2 h-4 w-4 text-muted-foreground" />
        <select
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          className="rounded-md border border-border bg-background px-2 py-1 text-xs"
        >
          <option value="all">Todas as cidades</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-border bg-background px-2 py-1 text-xs"
        >
          <option value="all">Todos os status</option>
          {ACTIVE_STATUSES.concat(AWAITING_STATUSES).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Main workspace grid */}
      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="card-soft overflow-hidden">
          <FleetMap vehicles={fleet} className="h-[560px] w-full lg:h-[720px]" />
        </div>

        <div className="grid grid-rows-3 gap-3 lg:h-[720px]">
          <div className="card-soft overflow-hidden">
            <DispatchQueue orders={awaiting} />
          </div>
          <div className="card-soft overflow-hidden">
            <ActiveFreights orders={active} />
          </div>
          <div className="card-soft overflow-hidden">
            <AlertsPanel alerts={alerts} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
