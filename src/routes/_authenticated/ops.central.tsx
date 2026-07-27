import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { FleetMap, type FleetVehicle } from "@/components/fleet-map";
import { KpiBar, type Kpi } from "@/components/ops/kpi-bar";
import { AlertsPanel } from "@/components/ops/alerts-panel";
import { FreightMonitor, type MonitorOrder } from "@/components/ops/freight-monitor";
import { OperationalFeed } from "@/components/ops/operational-feed";
import { OrderDrawer } from "@/components/ops/order-drawer";
import { QuickActions } from "@/components/ops/quick-actions";
import { GlobalSearch } from "@/components/ops/global-search";
import { HealthIndicator, computeHealth } from "@/components/ops/health-indicator";
import { ManagerPanel } from "@/components/ops/manager-panel";
import { useTheme } from "@/hooks/use-theme";
import {
  ACTIVE_STATUSES,
  AWAITING_STATUSES,
  formatBRL,
  type OpsAlert,
} from "@/lib/ops-central";
import { STATUS_FILTER_OPTIONS } from "@/lib/order-status";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  Filter,
  Gauge,
  Monitor,
  Moon,
  Package,
  Plus,
  Route as RouteIcon,
  Sun,
  Truck,
  Users,
  Wifi,
  X,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/ops/central")({
  head: () => ({
    meta: [
      { title: "Central Operacional — InfinitLog" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: z.object({ tv: z.string().optional() }),
  component: CentralOperacional,
});

function CentralOperacional() {
  const qc = useQueryClient();
  const search = useSearch({ from: "/_authenticated/ops/central" });
  const tvMode = search.tv === "1";
  const { theme, toggle } = useTheme();

  const [cityFilter, setCityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [driverFilter, setDriverFilter] = useState<string>("all");
  const [drawerOrderId, setDrawerOrderId] = useState<string | null>(null);

  // ------- Data ----------
  const ordersQ = useQuery({
    queryKey: ["central-orders"],
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, code, tracking_code, status, client_name, contact_phone, origin_city, destination_city, origin_lat, origin_lng, destination_lat, destination_lng, priority, cargo_type, cargo_weight_kg, volumes, price, distance_km, pickup_window_start, pickup_window_end, delivery_window_start, delivery_window_end, distance_to_destination_km, initial_distance_km, eta_minutes, last_ping_at, driver_id, vehicle_id, created_at",
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

  const routesTodayQ = useQuery({
    queryKey: ["central-routes-today"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("route_summaries")
        .select("total_distance_km, total_minutes, created_at")
        .gte("created_at", start.toISOString());
      if (error) throw error;
      return data ?? [];
    },
  });

  const meRoleQ = useQuery({
    queryKey: ["me-role"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return "user";
      const { data: r } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.user.id);
      const roles = (r ?? []).map((x) => x.role as string);
      return roles.includes("admin") ? "admin" : roles[0] ?? "user";
    },
  });
  const isAdmin = meRoleQ.data === "admin";

  // Realtime — one channel for everything
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
  const routesToday = routesTodayQ.data ?? [];

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

  const activeDriversList = useMemo(() => {
    const out: { id: string; name: string }[] = [];
    for (const id of driverIds) {
      out.push({ id, name: profiles.get(id)?.name ?? "Motorista" });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }, [driverIds, profiles]);

  function matchesFilters(o: (typeof orders)[number]) {
    if (
      cityFilter !== "all" &&
      o.origin_city !== cityFilter &&
      o.destination_city !== cityFilter
    )
      return false;
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (driverFilter !== "all" && o.driver_id !== driverFilter) return false;
    return true;
  }

  const filteredOrders = orders.filter(matchesFilters);
  const awaitingCount = filteredOrders.filter(
    (o) => AWAITING_STATUSES.includes(o.status) && !o.driver_id,
  ).length;
  const activeOrders = filteredOrders.filter((o) => ACTIVE_STATUSES.includes(o.status));

  // Fleet map data
  const orderByVehicle = new Map<string, (typeof orders)[number]>();
  for (const o of activeOrders) if (o.vehicle_id) orderByVehicle.set(o.vehicle_id, o);

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
  }, [vehicles, activeOrders, profiles]);

  // KPIs
  const today = new Date().toISOString().slice(0, 10);
  const isToday = (d?: string | null) => d?.slice(0, 10) === today;
  const now = Date.now();
  const ordersToday = orders.filter((o) => isToday(o.created_at));
  const deliveredToday = orders.filter(
    (o) => (o.status === "delivered" || o.status === "finalized") && isToday(o.created_at),
  );
  const inTransit = orders.filter((o) => ACTIVE_STATUSES.includes(o.status)).length;
  const lateOrders = orders.filter(
    (o) =>
      ACTIVE_STATUSES.includes(o.status) &&
      o.delivery_window_end &&
      new Date(o.delivery_window_end).getTime() < now,
  ).length;
  const gpsOffline = orders.filter(
    (o) =>
      ACTIVE_STATUSES.includes(o.status) &&
      o.last_ping_at &&
      (now - new Date(o.last_ping_at).getTime()) / 60000 > 10,
  ).length;
  const driversOnline = drivers.filter(
    (d) => d.availability !== "offline" && d.status !== "offline",
  ).length;
  const driversAvailable = drivers.filter((d) => d.availability === "disponivel").length;
  const driversOnTrip = drivers.filter((d) => d.status === "on_trip").length;
  const driversOffline = drivers.filter(
    (d) => d.availability === "offline" || d.status === "offline",
  ).length;
  const vehiclesInOp = vehicles.filter((v) =>
    ["em_coleta", "em_transito", "em_entrega"].includes(v.status),
  ).length;
  const vehiclesIdle = vehicles.filter((v) => v.status === "disponivel").length;
  const kmToday = routesToday.reduce((s, r) => s + (Number(r.total_distance_km) || 0), 0);
  const revenueToday = ordersToday.reduce((s, o) => s + (Number(o.price) || 0), 0);
  const profitToday = revenueToday * 0.25;
  const deliveredCompleted = orders.filter(
    (o) => (o.status === "delivered" || o.status === "finalized") && (o as any).initial_distance_km,
  );
  const avgDeliveryMin =
    routesToday.length > 0
      ? Math.round(
          routesToday.reduce((s, r) => s + (Number(r.total_minutes) || 0), 0) / routesToday.length,
        )
      : 0;
  const deliveryRate =
    ordersToday.length > 0 ? Math.round((deliveredToday.length / ordersToday.length) * 100) : 100;
  const pickupPending = orders.filter((o) => ["at_pickup", "en_route_pickup"].includes(o.status)).length;

  const kpis: Kpi[] = [
    { key: "orders-today", label: "Pedidos hoje", value: ordersToday.length, icon: <Package className="h-4 w-4" />, tint: "bg-brand/10 text-brand" },
    { key: "in-progress", label: "Em andamento", value: inTransit, icon: <Activity className="h-4 w-4" />, tint: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200" },
    { key: "delivered-today", label: "Finalizadas", value: deliveredToday.length, icon: <CheckCircle2 className="h-4 w-4" />, tint: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200" },
    { key: "pickup-pending", label: "Coletas pend.", value: pickupPending, icon: <Clock className="h-4 w-4" />, tint: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200" },
    { key: "drivers-online", label: "Motoristas on-line", value: driversOnline, icon: <Users className="h-4 w-4" />, tint: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200" },
    { key: "drivers-available", label: "Disponíveis", value: driversAvailable, icon: <CheckCircle2 className="h-4 w-4" />, tint: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200" },
    { key: "drivers-on-trip", label: "Em viagem", value: driversOnTrip, icon: <RouteIcon className="h-4 w-4" />, tint: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200" },
    { key: "drivers-offline", label: "Off-line", value: driversOffline, icon: <Wifi className="h-4 w-4" />, tint: "bg-zinc-200 text-zinc-700 dark:bg-zinc-500/20 dark:text-zinc-200" },
    { key: "vehicles-in-op", label: "Veículos em op.", value: vehiclesInOp, icon: <Truck className="h-4 w-4" />, tint: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200" },
    { key: "vehicles-idle", label: "Veículos parados", value: vehiclesIdle, icon: <Truck className="h-4 w-4" />, tint: "bg-zinc-100 text-zinc-700 dark:bg-zinc-500/20 dark:text-zinc-200" },
    { key: "incidents", label: "Ocorrências", value: incidents.length, icon: <AlertTriangle className="h-4 w-4" />, tint: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200" },
    { key: "late", label: "Atrasados", value: lateOrders, icon: <Clock className="h-4 w-4" />, tint: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200" },
    { key: "avg-min", label: "Tempo médio", value: avgDeliveryMin ? `${avgDeliveryMin}min` : "—", icon: <Gauge className="h-4 w-4" />, tint: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200" },
    { key: "rate", label: "Taxa entrega", value: `${deliveryRate}%`, icon: <CheckCircle2 className="h-4 w-4" />, tint: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200" },
    { key: "km-today", label: "KM hoje", value: kmToday ? kmToday.toFixed(0) : "0", icon: <RouteIcon className="h-4 w-4" />, tint: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200" },
    { key: "revenue", label: "Faturado", value: formatBRL(revenueToday), icon: <DollarSign className="h-4 w-4" />, tint: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200" },
    { key: "profit", label: "Lucro estim.", value: formatBRL(profitToday), icon: <DollarSign className="h-4 w-4" />, tint: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200" },
  ];

  // Health
  const health = computeHealth({
    activeOrders: inTransit,
    lateOrders,
    incidents: incidents.length,
    gpsOffline,
    driversStopped: drivers.filter((d) => d.status === "offline" && d.availability !== "offline").length,
  });

  // Alerts
  const alerts: OpsAlert[] = useMemo(() => {
    const list: OpsAlert[] = [];
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
        title: off.status === "declined" ? "Motorista recusou frete" : "Motorista em negociação",
        detail: order ? `${order.code} · ${order.client_name ?? ""}` : undefined,
        orderId: off.order_id,
        driverId: off.driver_id,
        createdAt: off.created_at,
      });
    }
    for (const o of orders) {
      if (!ACTIVE_STATUSES.includes(o.status)) continue;
      if (o.last_ping_at) {
        const diffMin = (now - new Date(o.last_ping_at).getTime()) / 60000;
        if (diffMin > 15) {
          list.push({
            id: `stop-${o.id}`,
            severity: diffMin > 45 ? "critical" : "warn",
            kind: "Motorista parado",
            title: "Motorista parado / sem movimento",
            detail: `${o.code} · há ${Math.round(diffMin)} min`,
            orderId: o.id,
            createdAt: o.last_ping_at,
          });
        }
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
    }
    // Documents expiring
    for (const d of drivers) {
      const p = profiles.get(d.user_id);
      const name = p?.name ?? "Motorista";
      for (const [field, labelText] of [
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
            title: days < 0 ? `${labelText} vencida` : `${labelText} vencendo`,
            detail: `${name} · ${days < 0 ? `há ${-days}d` : `em ${days}d`}`,
            driverId: d.user_id,
            createdAt: new Date().toISOString(),
          });
        }
      }
    }
    // Vehicles in maintenance
    for (const v of vehicles) {
      if (v.status === "manutencao") {
        list.push({
          id: `veh-${v.id}`,
          severity: "info",
          kind: "Veículo",
          title: "Veículo em manutenção",
          detail: v.plate,
          createdAt: v.last_location_at ?? new Date().toISOString(),
        });
      }
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, incidents, offers, drivers, vehicles, profiles]);

  // Monitor data
  const monitorRows: MonitorOrder[] = activeOrders.map((o) => ({
    id: o.id,
    code: o.code,
    status: o.status,
    client_name: o.client_name,
    origin_city: o.origin_city,
    destination_city: o.destination_city,
    distance_to_destination_km: o.distance_to_destination_km,
    initial_distance_km: o.initial_distance_km,
    eta_minutes: o.eta_minutes,
    last_ping_at: o.last_ping_at,
    driverName: o.driver_id ? profiles.get(o.driver_id)?.name ?? null : null,
    vehiclePlate: vehicles.find((v) => v.id === o.vehicle_id)?.plate ?? null,
    hasIncident: incidents.some((i) => i.order_id === o.id),
  }));

  // ==== Layout ====
  const topBar = (
    <div className="flex flex-1 flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <GlobalSearch />
      </div>
      <div className="flex items-center gap-2">
        <HealthIndicator score={health.score} level={health.level} />
        <button
          type="button"
          onClick={toggle}
          className="grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground hover:bg-accent"
          title={theme === "dark" ? "Modo claro" : "Modo escuro"}
          aria-label="Alternar tema"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <Link
          to="/ops/central"
          search={{ tv: tvMode ? undefined : "1" }}
          className="grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground hover:bg-accent"
          title={tvMode ? "Sair do modo TV" : "Modo TV"}
        >
          {tvMode ? <X className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
        </Link>
        <Link
          to="/ops/pedidos/novo"
          className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-sm hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Novo frete
        </Link>
      </div>
    </div>
  );

  const filters = (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card p-2">
      <Filter className="ml-2 h-4 w-4 text-muted-foreground" />
      <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1 text-xs">
        <option value="all">Todas as cidades</option>
        {cities.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1 text-xs">
        <option value="all">Todos os status</option>
        {STATUS_FILTER_OPTIONS.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>
      <select value={driverFilter} onChange={(e) => setDriverFilter(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1 text-xs">
        <option value="all">Todos os motoristas</option>
        {activeDriversList.map((d) => (
          <option key={d.id} value={d.id}>{d.name}</option>
        ))}
      </select>
      <span className="ml-auto pr-2 text-[10px] uppercase tracking-widest text-muted-foreground">
        {filteredOrders.length} pedido(s) · {awaitingCount} aguardando
      </span>
    </div>
  );

  const mainBlocks = (
    <>
      <KpiBar kpis={kpis} />

      <div className="mt-3">{filters}</div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="card-soft overflow-hidden">
          <FleetMap vehicles={fleet} className="h-[520px] w-full xl:h-[640px]" />
        </div>
        <div className="grid gap-3 xl:h-[640px] xl:grid-rows-2">
          <div className="card-soft overflow-hidden">
            <AlertsPanel alerts={alerts} />
          </div>
          <div className="card-soft overflow-hidden">
            <OperationalFeed />
          </div>
        </div>
      </div>

      <div className="mt-3 card-soft overflow-hidden">
        <FreightMonitor orders={monitorRows} onSelect={setDrawerOrderId} />
      </div>

      {isAdmin && (
        <div className="mt-3">
          <ManagerPanel />
        </div>
      )}
    </>
  );

  // TV Mode — fullscreen, no shell
  if (tvMode) {
    return (
      <div className="min-h-screen bg-background p-4 text-foreground">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight">Central Operacional · Modo TV</h1>
            <HealthIndicator score={health.score} level={health.level} />
          </div>
          <Link
            to="/ops/central"
            search={{ tv: undefined }}
            className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-accent"
          >
            <X className="h-3.5 w-3.5" /> Sair
          </Link>
        </div>
        <KpiBar kpis={kpis} />
        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="card-soft overflow-hidden">
            <FleetMap vehicles={fleet} className="h-[calc(100vh-360px)] w-full" />
          </div>
          <div className="grid gap-3 lg:h-[calc(100vh-360px)] lg:grid-rows-2">
            <div className="card-soft overflow-hidden">
              <AlertsPanel alerts={alerts} />
            </div>
            <div className="card-soft overflow-hidden">
              <OperationalFeed />
            </div>
          </div>
        </div>
        <div className="mt-3 card-soft overflow-hidden">
          <FreightMonitor orders={monitorRows.slice(0, 8)} onSelect={setDrawerOrderId} />
        </div>
        <OrderDrawer orderId={drawerOrderId} onClose={() => setDrawerOrderId(null)} />
      </div>
    );
  }

  return (
    <>
      <AppShell
        title="Central Operacional"
        subtitle="Toda a operação em uma única tela — atualização em tempo real."
        actions={topBar}
      >
        <div className="mb-4">
          <QuickActions />
        </div>
        {mainBlocks}
      </AppShell>
      <OrderDrawer orderId={drawerOrderId} onClose={() => setDrawerOrderId(null)} />
    </>
  );
}
