import { COMMERCIAL_ORDERS } from "@/lib/order-projections";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { TrackingMap, type MapPin, type MapUnit } from "@/components/ops/tracking-map";
import { fetchDrivingRoute } from "@/lib/tracking.functions";
import { STATUS_LABEL } from "@/lib/order-status";
import { haversineKm } from "@/lib/geo";
import { navTarget, distanceToTargetKm, fmtDistance } from "@/lib/geofence";
import {
  TRACK_KIND,
  TRACK_FILTERS,
  trackKind,
  computeAlerts,
  fmtEta,
  fmtAgo,
  type TrackKind,
} from "@/lib/tracking-center";
import { fetchUserRoles, primaryRole, type AppRole } from "@/lib/roles";
import { DRIVER_COLUMNS } from "@/lib/driver-columns";
import {
  Search, PanelLeftClose, PanelLeftOpen, AlertTriangle, Gauge, Clock, MapPin as PinIcon,
  Truck, Phone, PlayCircle, PauseCircle, X, Radio, Package, CheckCircle2, WifiOff,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/ops/rastreamento")({
  head: () => ({
    meta: [
      { property: "og:title", content: 'Rastreamento em Tempo Real — InfinitLog' },
      { property: "og:description", content: 'Rastreamento em Tempo Real — InfinitLog. Informações e acompanhamento na plataforma INFINITLOG VAPT VUPT.' },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Rastreamento em Tempo Real — InfinitLog" },
      { name: "description", content: "Central de monitoramento de motoristas, veículos e operações em tempo real." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TrackingCenter,
});

const ACTIVE_EXCLUDE = "(delivered,finalized,cancelled)";

type Unit = {
  id: string;
  order: any;
  driver: any;
  profile: any;
  vehicle: any;
  lat: number | null;
  lng: number | null;
  speed: number | null;
  lastSeen: string | null;
  kind: TrackKind;
  distanceKm: number | null;
  etaMinutes: number | null;
  alerts: ReturnType<typeof computeAlerts>;
};

function TrackingCenter() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<AppRole | null>(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [uf, setUf] = useState("");
  const [vType, setVType] = useState("");
  const [day, setDay] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [focusToken, setFocusToken] = useState(0);
  const [fitToken, setFitToken] = useState(0);
  const [replayIdx, setReplayIdx] = useState(0);
  const [replaying, setReplaying] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      setUserId(data.user.id);
      setRole(primaryRole(await fetchUserRoles(data.user.id)));
    })();
  }, []);

  const dataQ = useQuery({
    enabled: !!role,
    queryKey: ["tracking-center", role, userId],
    refetchInterval: 8000,
    queryFn: async () => {
      let oq = supabase.from(COMMERCIAL_ORDERS).select("*, vehicle:vehicles(*)").is("deleted_at", null);
      if (role === "client") oq = oq.eq("client_id", userId);
      if (role === "driver") oq = oq.eq("driver_id", userId);
      const { data: orders, error } = await oq.order("updated_at", { ascending: false }).limit(400);
      if (error) throw error;

      const assignedDriverIds = Array.from(new Set((orders ?? []).map((o) => o.driver_id).filter(Boolean))) as string[];
      const canSeeFleet = role === "admin" || role === "logistics";
      const driversQuery = canSeeFleet
        ? supabase.from("drivers").select(DRIVER_COLUMNS as "*")
        : assignedDriverIds.length
          ? supabase.from("drivers").select(DRIVER_COLUMNS as "*").in("user_id", assignedDriverIds)
          : null;
      const { data: fleetDrivers } = driversQuery ? await driversQuery : { data: [] as any[] };
      const driverIds = Array.from(new Set((fleetDrivers ?? []).map((driver: any) => driver.user_id).filter(Boolean))) as string[];
      const { data: profiles } = driverIds.length
        ? await supabase.from("profiles").select("id, full_name, phone, avatar_url").in("id", driverIds)
        : { data: [] as any[] };
      return { orders: orders ?? [], drivers: fleetDrivers ?? [], profiles: profiles ?? [] };
    },
  });

  const kmTodayQ = useQuery({
    queryKey: ["tracking-km-today"],
    refetchInterval: 60000,
    queryFn: async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("order_tracking_points")
        .select("order_id, lat, lng, created_at")
        .gte("created_at", start.toISOString())
        .order("created_at", { ascending: true })
        .limit(5000);
      let km = 0;
      const last: Record<string, { lat: number; lng: number }> = {};
      for (const p of data ?? []) {
        const prev = last[p.order_id];
        if (prev) km += haversineKm(prev, { lat: p.lat, lng: p.lng });
        last[p.order_id] = { lat: p.lat, lng: p.lng };
      }
      return Math.round(km);
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("tracking-center-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () =>
        qc.invalidateQueries({ queryKey: ["tracking-center"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "drivers" }, () =>
        qc.invalidateQueries({ queryKey: ["tracking-center"] }),
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_tracking_points" }, () =>
        qc.invalidateQueries({ queryKey: ["tracking-center"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const units: Unit[] = useMemo(() => {
    const d = dataQ.data;
    if (!d) return [];
    const dm = new Map(d.drivers.map((x: any) => [x.user_id, x]));
    const pm = new Map(d.profiles.map((x: any) => [x.id, x]));
    return d.orders
      .filter((o: any) => !["cancelled"].includes(o.status))
      .map((o: any) => {
        const driver = o.driver_id ? dm.get(o.driver_id) : null;
        const profile = o.driver_id ? pm.get(o.driver_id) : null;
        const lat = o.current_lat ?? driver?.current_lat ?? null;
        const lng = o.current_lng ?? driver?.current_lng ?? null;
        const speed = driver?.current_speed ?? null;
        const lastSeen = o.last_ping_at ?? driver?.last_seen_at ?? null;
        const done = ["delivered", "finalized"].includes(o.status);
        const kind: TrackKind = done
          ? "offline"
          : trackKind({ status: o.status, speedKmh: speed, lastSeenAt: lastSeen });
        const target = navTarget(o.status, o);
        const distanceKm =
          lat != null && lng != null ? distanceToTargetKm({ lat, lng }, target) : o.distance_to_destination_km ?? null;
        const etaMinutes = o.eta_minutes ?? (distanceKm != null ? Math.round((distanceKm / 55) * 60) : null);
        return {
          id: o.id,
          order: o,
          driver,
          profile,
          vehicle: o.vehicle,
          lat,
          lng,
          speed,
          lastSeen,
          kind,
          distanceKm,
          etaMinutes,
          alerts: done
            ? []
            : computeAlerts({
                status: o.status,
                speedKmh: speed,
                lastSeenAt: lastSeen,
                etaMinutes,
                windowEnd: o.delivery_window_end,
              }),
        } as Unit;
      });
  }, [dataQ.data]);

  const activeUnits = useMemo(
    () => units.filter((u) => !["delivered", "finalized"].includes(u.order.status)),
    [units],
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return units.filter((u) => {
      const o = u.order;
      const done = ["delivered", "finalized"].includes(o.status);
      if (statusFilter === "all" && done) return term.length > 0;
      if (statusFilter === "delivered" && !done) return false;
      if (statusFilter !== "all" && statusFilter !== "delivered" && u.kind !== statusFilter) return false;
      if (uf && ![o.origin_state, o.destination_state].includes(uf)) return false;
      if (vType && u.vehicle?.vehicle_type !== vType) return false;
      if (day) {
        const dd = new Date(o.updated_at).toISOString().slice(0, 10);
        if (dd !== day) return false;
      }
      if (!term) return true;
      return [
        u.profile?.full_name,
        o.client_name,
        o.code,
        o.tracking_code,
        o.origin_city,
        o.destination_city,
        o.current_city,
        o.origin_state,
        o.destination_state,
        u.vehicle?.plate,
        u.vehicle?.vehicle_type,
      ]
        .filter(Boolean)
        .some((v: string) => String(v).toLowerCase().includes(term));
    });
  }, [units, q, statusFilter, uf, vType, day]);

  const selected = units.find((u) => u.id === selectedId) ?? null;
  const isFinished = selected ? ["delivered", "finalized"].includes(selected.order.status) : false;

  // Rota planejada (Directions) do ponto atual até o alvo
  const routeFn = useServerFn(fetchDrivingRoute);
  const routeQ = useQuery({
    enabled: !!selected && selected.lat != null && !isFinished,
    queryKey: [
      "tracking-route",
      selected?.id,
      selected?.lat != null ? Math.round(selected.lat * 200) : null,
      selected?.lng != null ? Math.round(selected.lng * 200) : null,
    ],
    staleTime: 60000,
    queryFn: async () => {
      const t = navTarget(selected!.order.status, selected!.order);
      if (t.lat == null || t.lng == null || selected!.lat == null) return null;
      return routeFn({
        data: { fromLat: selected!.lat!, fromLng: selected!.lng!, toLat: t.lat, toLng: t.lng },
      });
    },
  });

  // Trajeto percorrido / replay
  const trackQ = useQuery({
    enabled: !!selected,
    queryKey: ["tracking-points", selected?.id],
    refetchInterval: isFinished ? false : 15000,
    queryFn: async () => {
      const { data } = await supabase
        .from("order_tracking_points")
        .select("lat, lng, speed, created_at")
        .eq("order_id", selected!.id)
        .order("created_at", { ascending: true })
        .limit(2000);
      return data ?? [];
    },
  });

  const points = trackQ.data ?? [];
  const traveled = useMemo<[number, number][]>(
    () => points.map((p: any) => [p.lng, p.lat] as [number, number]),
    [points],
  );

  // Linha do tempo da operação
  const eventsQ = useQuery({
    enabled: !!selected,
    queryKey: ["tracking-events", selected?.id],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data } = await supabase
        .from("order_events")
        .select("event_type, to_status, created_at")
        .eq("order_id", selected!.id)
        .order("created_at", { ascending: true })
        .limit(200);
      return data ?? [];
    },
  });

  const traveledKm = useMemo(() => {
    let km = 0;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1] as any;
      const b = points[i] as any;
      km += haversineKm({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng });
    }
    return km;
  }, [points]);

  const progress = useMemo(() => {
    if (!selected) return null;
    const o = selected.order;
    if (["delivered", "finalized"].includes(o.status)) return 100;
    const remaining = routeQ.data?.distance ?? selected.distanceKm;
    const total =
      o.initial_distance_km ??
      (o.origin_lat && o.destination_lat
        ? haversineKm(
            { lat: o.origin_lat, lng: o.origin_lng },
            { lat: o.destination_lat, lng: o.destination_lng },
          )
        : null);
    if (remaining == null || !total) return null;
    return Math.max(0, Math.min(100, Math.round(((total - remaining) / total) * 100)));
  }, [selected, routeQ.data]);


  useEffect(() => {
    if (!replaying || points.length < 2) return;
    const t = setInterval(() => {
      setReplayIdx((i) => {
        if (i >= points.length - 1) {
          setReplaying(false);
          return i;
        }
        return i + 1;
      });
    }, 220);
    return () => clearInterval(t);
  }, [replaying, points.length]);

  const replayStats = useMemo(() => {
    if (points.length < 2) return null;
    let km = 0;
    let moving = 0;
    let stopped = 0;
    let stops = 0;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1] as any;
      const b = points[i] as any;
      km += haversineKm({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng });
      const dt = (new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) / 60000;
      if ((b.speed ?? 0) * 3.6 < 3) {
        stopped += dt;
        if ((a.speed ?? 0) * 3.6 >= 3) stops++;
      } else moving += dt;
    }
    return { km: km.toFixed(1), moving: Math.round(moving), stopped: Math.round(stopped), stops };
  }, [points]);

  const mapUnits: MapUnit[] = useMemo(() => {
    const base = filtered
      .filter((u) => u.lat != null && u.lng != null)
      .map((u) => ({
        id: u.id,
        lat: u.lat!,
        lng: u.lng!,
        kind: u.kind,
        title: u.profile?.full_name ?? "Motorista",
        subtitle: `${u.order.code} • ${STATUS_LABEL[u.order.status] ?? u.order.status}`,
        avatarUrl: u.profile?.avatar_url ?? u.driver?.photo_url ?? null,
        statusLabel: STATUS_LABEL[u.order.status] ?? TRACK_KIND[u.kind].label,
      }));
    const representedDrivers = new Set(filtered.map((unit) => unit.driver?.user_id).filter(Boolean));
    const fleetDrivers: MapUnit[] = (dataQ.data?.drivers ?? [])
      .filter((driver: any) =>
        !representedDrivers.has(driver.user_id) &&
        Number.isFinite(Number(driver.current_lat)) &&
        Number.isFinite(Number(driver.current_lng)),
      )
      .map((driver: any) => {
        const profile = dataQ.data?.profiles.find((item: any) => item.id === driver.user_id);
        const kind = trackKind({ status: driver.status, speedKmh: driver.current_speed, lastSeenAt: driver.last_seen_at });
        return {
          id: `driver-${driver.user_id}`,
          lat: Number(driver.current_lat),
          lng: Number(driver.current_lng),
          kind,
          title: profile?.full_name ?? driver.full_name ?? "Motorista",
          subtitle: driver.status === "available" ? "Disponível" : "Sem frete ativo",
          avatarUrl: profile?.avatar_url ?? driver.photo_url ?? null,
          statusLabel: driver.status === "available" ? "Disponível" : TRACK_KIND[kind].label,
        };
      });

    const allDrivers = [...base, ...fleetDrivers];
    if (isFinished && replaying && points[replayIdx]) {
      const p = points[replayIdx] as any;
      return [
        ...allDrivers,
        { id: "replay", lat: p.lat, lng: p.lng, kind: "in_transit" as TrackKind, title: "Replay" },
      ];
    }
    return allDrivers;
  }, [filtered, isFinished, replaying, replayIdx, points, dataQ.data]);

  const pins: MapPin[] = useMemo(() => {
    if (!selected) return [];
    const o = selected.order;
    const list: MapPin[] = [];
    if (o.origin_lat && o.origin_lng)
      list.push({ lat: o.origin_lat, lng: o.origin_lng, color: "#10b981", label: `Coleta: ${o.origin_address}` });
    if (o.destination_lat && o.destination_lng)
      list.push({
        lat: o.destination_lat,
        lng: o.destination_lng,
        color: "#ef4444",
        label: `Entrega: ${o.destination_address}`,
      });
    return list;
  }, [selected]);

  const stats = useMemo(() => {
    const online = new Set(
      activeUnits.filter((u) => u.kind !== "offline" && u.driver).map((u) => u.driver.user_id),
    ).size;
    const offline = new Set(
      activeUnits.filter((u) => u.kind === "offline" && u.driver).map((u) => u.driver.user_id),
    ).size;
    const today = new Date().toISOString().slice(0, 10);
    const entregas = units.filter(
      (u) => ["delivered", "finalized"].includes(u.order.status) && u.order.updated_at?.slice(0, 10) === today,
    ).length;
    const coletas = activeUnits.filter((u) => u.kind === "to_pickup" || u.kind === "loading").length;
    const ocorrencias = activeUnits.filter((u) => u.alerts.some((a) => a.severity === "high")).length;
    const etas = activeUnits.map((u) => u.etaMinutes).filter((x): x is number => x != null);
    const tempoMedio = etas.length ? Math.round(etas.reduce((a, b) => a + b, 0) / etas.length) : null;
    return { online, offline, ativas: activeUnits.length, coletas, entregas, ocorrencias, tempoMedio };
  }, [activeUnits, units]);

  const alertsList = useMemo(
    () => activeUnits.flatMap((u) => u.alerts.map((a) => ({ ...a, unit: u }))).slice(0, 20),
    [activeUnits],
  );

  const ufOptions = useMemo(
    () =>
      Array.from(
        new Set(units.flatMap((u) => [u.order.origin_state, u.order.destination_state]).filter(Boolean)),
      ).sort() as string[],
    [units],
  );
  const typeOptions = useMemo(
    () => Array.from(new Set(units.map((u) => u.vehicle?.vehicle_type).filter(Boolean))).sort() as string[],
    [units],
  );

  function select(id: string) {
    setSelectedId(id);
    setReplayIdx(0);
    setReplaying(false);
    setFocusToken((t) => t + 1);
  }

  return (
    <AppShell title="Rastreamento" subtitle="Monitoramento de motoristas, veículos e operações em tempo real">
      <div className="flex flex-col gap-4">

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          <Stat label="Motoristas online" value={stats.online} icon={<Radio className="h-3.5 w-3.5" />} tone="ok" />
          <Stat label="Offline" value={stats.offline} icon={<WifiOff className="h-3.5 w-3.5" />} />
          <Stat label="Em andamento" value={stats.ativas} icon={<Truck className="h-3.5 w-3.5" />} />
          <Stat label="Coletas" value={stats.coletas} icon={<Package className="h-3.5 w-3.5" />} />
          <Stat label="Entregas hoje" value={stats.entregas} icon={<CheckCircle2 className="h-3.5 w-3.5" />} />
          <Stat label="Ocorrências" value={stats.ocorrencias} icon={<AlertTriangle className="h-3.5 w-3.5" />} tone={stats.ocorrencias ? "bad" : undefined} />
          <Stat label="Tempo médio" value={fmtEta(stats.tempoMedio)} icon={<Clock className="h-3.5 w-3.5" />} />
          <Stat label="KM hoje" value={`${kmTodayQ.data ?? 0} km`} icon={<Gauge className="h-3.5 w-3.5" />} />
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar motorista, cliente, frete, cidade, placa…"
              className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={uf} onChange={setUf} placeholder="UF" options={ufOptions} />
            <Select value={vType} onChange={setVType} placeholder="Tipo de veículo" options={typeOptions} />
            <input
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-2 text-xs"
            />
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {TRACK_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                statusFilter === f.key
                  ? "border-brand bg-brand text-brand-foreground"
                  : "border-border bg-surface hover:bg-accent"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {alertsList.length > 0 && (
          <div className="flex gap-2 overflow-x-auto">
            {alertsList.map((a, i) => (
              <button
                key={i}
                onClick={() => select(a.unit.id)}
                className={`whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-semibold ${
                  a.severity === "high"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-amber-200 bg-amber-50 text-amber-700"
                }`}
              >
                <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
                {a.unit.profile?.full_name ?? a.unit.order.code}: {a.label}
              </button>
            ))}
          </div>
        )}

        <div className="relative flex h-[70vh] min-h-[520px] overflow-hidden rounded-2xl border border-border bg-surface">
          <TrackingMap
            className="flex-1"
            units={mapUnits}
            pins={pins}
            planned={(routeQ.data?.geometry as any) ?? null}
            traveled={isFinished && replaying ? traveled.slice(0, replayIdx + 1) : traveled}
            selectedId={selectedId}
            onSelect={select}
            focusToken={focusToken}
            fitToken={fitToken}
          />

          <button
            onClick={() => setPanelOpen((o) => !o)}
            className="absolute right-3 top-3 z-20 grid h-9 w-9 place-items-center rounded-xl border border-border bg-background/95 shadow-lg lg:right-[calc(22rem+0.75rem)]"
            title={panelOpen ? "Recolher painel" : "Abrir painel"}
          >
            {panelOpen ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>

          {panelOpen && (
            <aside className="z-10 hidden w-[22rem] shrink-0 flex-col border-l border-border bg-surface lg:flex">
              {selected ? (
                <DetailPanel
                  unit={selected}
                  onClose={() => setSelectedId(null)}
                  route={routeQ.data}
                  events={eventsQ.data ?? []}
                  progress={progress}
                  traveledKm={traveledKm}
                  isFinished={isFinished}
                  replaying={replaying}
                  onToggleReplay={() => setReplaying((r) => !r)}
                  replayStats={replayStats}
                  replayPoint={points[replayIdx] as any}
                />
              ) : (
                <div className="flex-1 overflow-y-auto">
                  <div className="sticky top-0 z-10 border-b border-border bg-surface px-4 py-3 text-xs font-black uppercase tracking-widest text-muted-foreground">
                    Operações ({filtered.length})
                  </div>
                  {filtered.length === 0 && (
                    <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma operação encontrada.</p>
                  )}
                  {filtered.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => select(u.id)}
                      className="flex w-full gap-3 border-b border-border/60 p-3 text-left hover:bg-accent"
                    >
                      <Avatar url={u.profile?.avatar_url} name={u.profile?.full_name} kind={u.kind} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold">{u.profile?.full_name ?? "Sem motorista"}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {u.order.client_name ?? "Cliente"} • {u.order.code}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold">
                          <span style={{ color: TRACK_KIND[u.kind].color }}>{TRACK_KIND[u.kind].dot} {TRACK_KIND[u.kind].label}</span>
                          <span className="text-muted-foreground">{u.order.current_city ?? u.order.destination_city ?? "—"}</span>
                          <span className="text-muted-foreground">ETA {fmtEta(u.etaMinutes)}</span>
                          <span className="text-muted-foreground">{fmtDistance(u.distanceKm)}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </aside>
          )}

          {/* Bottom sheet (mobile) */}
          {selected && (
            <div className="absolute inset-x-0 bottom-0 z-30 max-h-[68%] overflow-y-auto rounded-t-2xl border-t border-border bg-surface shadow-2xl lg:hidden">
              <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-border" />
              <DetailPanel
                unit={selected}
                onClose={() => setSelectedId(null)}
                route={routeQ.data}
                events={eventsQ.data ?? []}
                progress={progress}
                traveledKm={traveledKm}
                isFinished={isFinished}
                replaying={replaying}
                onToggleReplay={() => setReplaying((r) => !r)}
                replayStats={replayStats}
                replayPoint={points[replayIdx] as any}
              />
            </div>
          )}
        </div>


        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFitToken((t) => t + 1)} className="rounded-xl border border-border bg-surface px-3 py-2 text-xs font-bold hover:bg-accent">
            Mostrar todas as rotas
          </button>
          <button onClick={() => setStatusFilter("in_transit")} className="rounded-xl border border-border bg-surface px-3 py-2 text-xs font-bold hover:bg-accent">
            Apenas ativos
          </button>
          <button onClick={() => setStatusFilter("stopped")} className="rounded-xl border border-border bg-surface px-3 py-2 text-xs font-bold hover:bg-accent">
            Apenas parados
          </button>
          <button
            onClick={() => { setQ(""); setStatusFilter("all"); setUf(""); setVType(""); setDay(""); }}
            className="rounded-xl border border-border bg-surface px-3 py-2 text-xs font-bold hover:bg-accent"
          >
            Limpar filtros
          </button>
        </div>
      </div>
    </AppShell>
  );
}

const TIMELINE: { key: string; label: string; statuses: string[] }[] = [
  { key: "offer_sent", label: "Oferta enviada", statuses: ["awaiting_driver"] },
  { key: "accepted", label: "Motorista aceitou", statuses: ["driver_assigned"] },
  { key: "moving", label: "Em deslocamento", statuses: ["en_route_pickup", "in_transit_to_pickup", "near_pickup", "arriving_pickup"] },
  { key: "at_pickup", label: "Chegou na coleta", statuses: ["at_pickup"] },
  { key: "loading", label: "Carregamento iniciado", statuses: ["loading"] },
  { key: "loaded", label: "Carregado", statuses: ["loaded", "picked_up"] },
  { key: "out", label: "Saiu para entrega", statuses: ["out_for_delivery", "in_transit"] },
  { key: "near", label: "Próximo ao destino", statuses: ["near_destination", "arriving_destination", "at_destination", "unloading"] },
  { key: "done", label: "Entregue", statuses: ["delivered", "finalized"] },
];

function DetailPanel({
  unit, onClose, route, events, progress, traveledKm, isFinished, replaying, onToggleReplay, replayStats, replayPoint,
}: {
  unit: Unit;
  onClose: () => void;
  route?: { duration: number | null; distance: number | null } | null;
  events: { event_type: string; to_status: string | null; created_at: string }[];
  progress: number | null;
  traveledKm: number;
  isFinished: boolean;
  replaying: boolean;
  onToggleReplay: () => void;
  replayStats: { km: string; moving: number; stopped: number; stops: number } | null;
  replayPoint?: { created_at: string; speed: number | null } | null;
}) {
  const o = unit.order;
  const currentStep = Math.max(
    0,
    TIMELINE.findIndex((s) => s.statuses.includes(o.status)),
  );
  const stampFor = (statuses: string[]) =>
    events.find((e) => e.to_status && statuses.includes(e.to_status))?.created_at ?? null;
  const fmtDate = (v?: string | null) => (v ? new Date(v).toLocaleString("pt-BR") : "—");

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface px-4 py-3">
        <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Detalhes da operação</span>
        <button onClick={onClose} className="rounded-lg p-1 hover:bg-accent"><X className="h-4 w-4" /></button>
      </div>

      <div className="flex items-center gap-3 p-4">
        <Avatar url={unit.profile?.avatar_url ?? unit.driver?.photo_url} name={unit.profile?.full_name} kind={unit.kind} size={52} />
        <div className="min-w-0">
          <div className="truncate text-base font-black">{unit.profile?.full_name ?? "Sem motorista"}</div>
          <div className="text-xs text-muted-foreground">{unit.profile?.phone ?? unit.driver?.phone ?? "—"}</div>
          <div className="mt-1 text-xs font-bold" style={{ color: TRACK_KIND[unit.kind].color }}>
            {TRACK_KIND[unit.kind].dot} {STATUS_LABEL[o.status] ?? o.status}
          </div>
        </div>
      </div>

      <div className="px-4">
        <div className="mb-1 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          <span>Progresso da rota</span>
          <span>{progress != null ? `${progress}%` : "—"}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-700"
            style={{ width: `${progress ?? 0}%` }}
          />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 px-4">
        <Field label="Veículo" value={unit.vehicle ? `${unit.vehicle.brand ?? ""} ${unit.vehicle.model ?? ""}`.trim() || "—" : "—"} />
        <Field label="Placa" value={unit.vehicle?.plate ?? "—"} />
        <Field label="Cliente" value={o.client_name ?? "—"} />
        <Field label="Frete" value={o.code} />
        <Field label="Velocidade" value={unit.speed != null ? `${Math.round(unit.speed)} km/h` : "—"} />
        <Field label="ETA" value={fmtEta(route?.duration ?? unit.etaMinutes)} />
        <Field label="Tempo restante" value={fmtEta(route?.duration ?? unit.etaMinutes)} />
        <Field label="KM percorridos" value={`${traveledKm.toFixed(1)} km`} />
        <Field label="KM restantes" value={fmtDistance(route?.distance ?? unit.distanceKm)} />
        <Field label="Cidade atual" value={o.current_city ?? "—"} />
        <Field label="Data da coleta" value={fmtDate(o.pickup_date ?? o.started_trip_at ?? stampFor(["at_pickup"]))} />
        <Field label="Entrega prevista" value={fmtDate(o.delivery_window_end ?? o.delivery_date)} />
        <Field label="Última atualização" value={fmtAgo(unit.lastSeen)} />
      </div>

      <div className="space-y-2 p-4">
        <Route2 icon="🟢" label="Origem" value={`${o.origin_city ?? ""} — ${o.origin_address}`} />
        <Route2 icon="🔵" label="Localização atual" value={o.current_city ?? (unit.lat != null ? `${unit.lat.toFixed(4)}, ${unit.lng?.toFixed(4)}` : "—")} />
        <Route2 icon="🔴" label="Destino" value={`${o.destination_city ?? ""} — ${o.destination_address}`} />
      </div>

      <div className="px-4 pb-4">
        <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Linha do tempo</div>
        <ol className="space-y-0">
          {TIMELINE.map((step, i) => {
            const done = i < currentStep || (i === currentStep && currentStep >= 0);
            const active = i === currentStep;
            const at = stampFor(step.statuses);
            return (
              <li key={step.key} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={`grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px] font-black ${
                      active ? "bg-brand text-brand-foreground" : done ? "bg-emerald-500 text-white" : "bg-surface-2 text-muted-foreground"
                    }`}
                  >
                    {done ? "✓" : ""}
                  </span>
                  {i < TIMELINE.length - 1 && (
                    <span className={`w-0.5 flex-1 ${i < currentStep ? "bg-emerald-500" : "bg-border"}`} style={{ minHeight: 16 }} />
                  )}
                </div>
                <div className="pb-2">
                  <div className={`text-xs ${active ? "font-black text-brand" : done ? "font-semibold" : "text-muted-foreground"}`}>
                    {step.label}
                  </div>
                  {at && <div className="text-[10px] text-muted-foreground">{new Date(at).toLocaleString("pt-BR")}</div>}
                </div>
              </li>
            );
          })}
        </ol>
      </div>


      {unit.alerts.length > 0 && (
        <div className="space-y-1 px-4 pb-4">
          {unit.alerts.map((a, i) => (
            <div key={i} className={`rounded-lg px-3 py-2 text-xs font-semibold ${a.severity === "high" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
              <AlertTriangle className="mr-1 inline h-3.5 w-3.5" /> {a.label}
            </div>
          ))}
        </div>
      )}

      {isFinished && (
        <div className="mx-4 mb-4 rounded-xl border border-border p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Replay da operação</span>
            <button onClick={onToggleReplay} className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-brand-foreground">
              {replaying ? <PauseCircle className="h-3.5 w-3.5" /> : <PlayCircle className="h-3.5 w-3.5" />}
              {replaying ? "Pausar" : "Reproduzir"}
            </button>
          </div>
          {replayStats && (
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
              <Field label="Percurso" value={`${replayStats.km} km`} />
              <Field label="Paradas" value={String(replayStats.stops)} />
              <Field label="Em movimento" value={`${replayStats.moving} min`} />
              <Field label="Tempo parado" value={`${replayStats.stopped} min`} />
            </div>
          )}
          {replaying && replayPoint && (
            <div className="mt-2 text-[11px] text-muted-foreground">
              {new Date(replayPoint.created_at).toLocaleString("pt-BR")} •{" "}
              {replayPoint.speed != null ? `${Math.round(replayPoint.speed * 3.6)} km/h` : "—"}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 px-4 pb-6">
        <Link
          to="/ops/pedidos/$id"
          params={{ id: o.id }}
          className="flex-1 rounded-xl bg-brand px-4 py-3 text-center text-xs font-black uppercase tracking-widest text-brand-foreground"
        >
          Abrir detalhes
        </Link>
        {(unit.profile?.phone || unit.driver?.phone) && (
          <a
            href={`tel:${unit.profile?.phone ?? unit.driver?.phone}`}
            className="grid w-12 place-items-center rounded-xl border border-border hover:bg-accent"
          >
            <Phone className="h-4 w-4" />
          </a>
        )}
      </div>
    </div>
  );
}

function Route2({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex gap-2 text-xs">
      <span>{icon}</span>
      <div className="min-w-0">
        <div className="font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="truncate">{value}</div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-2 px-2.5 py-1.5">
      <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="truncate text-xs font-semibold">{value}</div>
    </div>
  );
}

function Avatar({ url, name, kind, size = 40 }: { url?: string | null; name?: string | null; kind: TrackKind; size?: number }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {url ? (
        <img src={url} alt={name ?? "Motorista"} className="h-full w-full rounded-full object-cover" loading="lazy" />
      ) : (
        <div className="grid h-full w-full place-items-center rounded-full bg-brand/10 text-sm font-black text-brand">
          {(name ?? "?").slice(0, 1).toUpperCase()}
        </div>
      )}
      <span
        className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-surface"
        style={{ background: TRACK_KIND[kind].color }}
      />
    </div>
  );
}

function Select({ value, onChange, placeholder, options }: { value: string; onChange: (v: string) => void; placeholder: string; options: string[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}

function Stat({ label, value, icon, tone }: { label: string; value: string | number; icon: React.ReactNode; tone?: "ok" | "bad" }) {
  return (
    <div className={`rounded-2xl border p-3 shadow-sm ${tone === "bad" ? "border-red-200 bg-red-50" : tone === "ok" ? "border-emerald-200 bg-emerald-50" : "border-border bg-surface"}`}>
      <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.1em] text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-1 truncate text-xl font-black tracking-tight">{value}</div>
    </div>
  );
}
