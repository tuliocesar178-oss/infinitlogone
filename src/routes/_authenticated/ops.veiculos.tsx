import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { FleetMap, type FleetVehicle } from "@/components/fleet-map";
import { FLEET_MAP_COLORS, VEHICLE_STATUS, fleetColor } from "@/lib/vehicles";
import { statusLabel } from "@/lib/order-status";
import { List, Plus, Search, X, Phone, MapPin, Truck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ops/veiculos")({
  head: () => ({
    meta: [
      { title: "Central da Frota — InfinitLog" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FleetControlCenter,
});

const ACTIVE_ORDER_STATUSES = [
  "driver_assigned",
  "en_route_pickup",
  "in_transit_to_pickup",
  "at_pickup",
  "loaded",
  "picked_up",
  "out_for_delivery",
  "in_transit",
  "near_destination",
];

function FleetControlCenter() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [selected, setSelected] = useState<FleetVehicle | null>(null);

  const vehiclesQ = useQuery({
    queryKey: ["fleet-vehicles"],
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select(
          "id, plate, model, brand, status, vehicle_type, current_lat, current_lng, current_city, current_state, current_speed_kmh, last_location_at, photo_url, owner_driver_id",
        );
      if (error) throw error;
      return data ?? [];
    },
  });

  const ordersQ = useQuery({
    queryKey: ["fleet-active-orders"],
    refetchInterval: 20000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, tracking_code, client_name, contact_phone, origin_city, destination_city, status, eta_minutes, distance_to_destination_km, initial_distance_km, cargo_description, cargo_weight_kg, volumes, last_ping_at, current_lat, current_lng, driver_id, vehicle_id",
        )
        .in("status", ACTIVE_ORDER_STATUSES as any)
        .is("deleted_at", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  const driverIds = useMemo(() => {
    const ids = new Set<string>();
    for (const v of vehiclesQ.data ?? []) if (v.owner_driver_id) ids.add(v.owner_driver_id);
    for (const o of ordersQ.data ?? []) if (o.driver_id) ids.add(o.driver_id);
    return Array.from(ids);
  }, [vehiclesQ.data, ordersQ.data]);

  const profilesQ = useQuery({
    queryKey: ["fleet-driver-profiles", driverIds],
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

  // Realtime: refresh on changes
  useEffect(() => {
    const ch = supabase
      .channel("fleet-center")
      .on("postgres_changes", { event: "*", schema: "public", table: "vehicles" }, () =>
        qc.invalidateQueries({ queryKey: ["fleet-vehicles"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () =>
        qc.invalidateQueries({ queryKey: ["fleet-active-orders"] }),
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "driver_locations" }, () => {
        qc.invalidateQueries({ queryKey: ["fleet-vehicles"] });
        qc.invalidateQueries({ queryKey: ["fleet-active-orders"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const fleet: FleetVehicle[] = useMemo(() => {
    const orders = ordersQ.data ?? [];
    const profiles = profilesQ.data ?? new Map();
    const orderByVehicle = new Map<string, (typeof orders)[number]>();
    for (const o of orders) if (o.vehicle_id) orderByVehicle.set(o.vehicle_id, o);

    return (vehiclesQ.data ?? []).map((v) => {
      const order = orderByVehicle.get(v.id) ?? null;
      const lat = (order?.current_lat as number) ?? (v.current_lat as number);
      const lng = (order?.current_lng as number) ?? (v.current_lng as number);
      const driverId = order?.driver_id ?? v.owner_driver_id;
      const p = driverId ? profiles.get(driverId) : null;
      return {
        id: v.id,
        plate: v.plate,
        model: [v.brand, v.model].filter(Boolean).join(" ") || null,
        status: v.status,
        lat,
        lng,
        speed: v.current_speed_kmh ?? null,
        driverName: p?.name ?? null,
        driverPhone: p?.phone ?? null,
        photoUrl: v.photo_url ?? null,
        order: order
          ? {
              id: order.id,
              tracking_code: order.tracking_code,
              client_name: order.client_name,
              origin_city: order.origin_city,
              destination_city: order.destination_city,
              status: order.status,
              eta_minutes: order.eta_minutes,
              distance_km: order.distance_to_destination_km as number | null,
              initial_distance_km: order.initial_distance_km as number | null,
              cargo: order.cargo_description,
              weight: order.cargo_weight_kg as number | null,
              volumes: order.volumes,
              last_ping_at: order.last_ping_at,
            }
          : null,
      } as FleetVehicle;
    });
  }, [vehiclesQ.data, ordersQ.data, profilesQ.data]);

  const cities = useMemo(() => {
    const s = new Set<string>();
    for (const v of vehiclesQ.data ?? []) if (v.current_city) s.add(v.current_city);
    return Array.from(s).sort();
  }, [vehiclesQ.data]);
  const states = useMemo(() => {
    const s = new Set<string>();
    for (const v of vehiclesQ.data ?? []) if (v.current_state) s.add(v.current_state);
    return Array.from(s).sort();
  }, [vehiclesQ.data]);
  const types = useMemo(() => {
    const s = new Set<string>();
    for (const v of vehiclesQ.data ?? []) if (v.vehicle_type) s.add(v.vehicle_type);
    return Array.from(s).sort();
  }, [vehiclesQ.data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return fleet.filter((v) => {
      if (statusFilter !== "all" && v.status !== statusFilter) return false;
      if (typeFilter !== "all") {
        const raw = (vehiclesQ.data ?? []).find((x) => x.id === v.id);
        if (raw?.vehicle_type !== typeFilter) return false;
      }
      if (cityFilter !== "all") {
        const raw = (vehiclesQ.data ?? []).find((x) => x.id === v.id);
        if (raw?.current_city !== cityFilter) return false;
      }
      if (stateFilter !== "all") {
        const raw = (vehiclesQ.data ?? []).find((x) => x.id === v.id);
        if (raw?.current_state !== stateFilter) return false;
      }
      if (q) {
        const hay = `${v.plate} ${v.model ?? ""} ${v.driverName ?? ""} ${v.order?.client_name ?? ""} ${v.order?.tracking_code ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [fleet, search, statusFilter, typeFilter, cityFilter, stateFilter, vehiclesQ.data]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { total: fleet.length };
    for (const v of fleet) c[v.status] = (c[v.status] ?? 0) + 1;
    return c;
  }, [fleet]);

  return (
    <AppShell
      title="Central da Frota"
      subtitle="Controle inteligente em tempo real"
      actions={
        <div className="flex items-center gap-2">
          <Link
            to="/ops/veiculos/lista"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium hover:bg-surface-2"
          >
            <List className="h-4 w-4" /> Lista
          </Link>
          <Link
            to="/ops/veiculos/novo"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Novo veículo
          </Link>
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* Left rail: filters + availability card + list */}
        <div className="flex flex-col gap-3 lg:h-[calc(100vh-180px)]">
          <div className="rounded-2xl border border-border bg-surface p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Placa, motorista, cliente…"
                className="w-full rounded-lg border border-border bg-surface-2 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-xs"
              >
                <option value="all">Status</option>
                {VEHICLE_STATUS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-xs"
              >
                <option value="all">Tipo</option>
                {types.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <select
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-xs"
              >
                <option value="all">Cidade</option>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-xs"
              >
                <option value="all">UF</option>
                {states.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Disponibilidade da Frota</h3>
              <span className="text-xs text-muted-foreground">Total {counts.total ?? 0}</span>
            </div>
            <div className="grid gap-1.5">
              {VEHICLE_STATUS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setStatusFilter(statusFilter === s.value ? "all" : s.value)}
                  className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-xs transition ${
                    statusFilter === s.value ? "bg-surface-2 ring-1 ring-primary/40" : "hover:bg-surface-2"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full ring-2 ring-white"
                      style={{ background: FLEET_MAP_COLORS[s.value].color }}
                    />
                    {s.label}
                  </span>
                  <span className="font-semibold tabular-nums">{counts[s.value] ?? 0}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-border bg-surface p-2">
            <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
              {filtered.length} veículo(s)
            </div>
            {filtered.map((v) => (
              <button
                key={v.id}
                onClick={() => setSelected(v)}
                className="w-full rounded-xl px-2 py-2 text-left hover:bg-surface-2"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ background: fleetColor(v.status) }}
                  />
                  <span className="font-semibold text-sm">{v.plate}</span>
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    {v.driverName ?? "—"}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {v.order
                    ? `${v.order.origin_city ?? "—"} → ${v.order.destination_city ?? "—"}`
                    : v.model ?? "Sem viagem ativa"}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Map */}
        <div className="relative rounded-2xl border border-border bg-surface p-0 lg:h-[calc(100vh-180px)]">
          <FleetMap
            vehicles={filtered}
            onSelect={setSelected}
            className="h-[520px] w-full overflow-hidden rounded-2xl lg:h-full"
          />
          {selected && (
            <div className="pointer-events-auto absolute right-3 top-3 w-[320px] max-w-[calc(100%-24px)] rounded-2xl border border-border bg-surface shadow-xl">
              <div className="flex items-start gap-3 p-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                  {selected.photoUrl ? (
                    <img src={selected.photoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center text-muted-foreground">
                      <Truck className="h-6 w-6" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: fleetColor(selected.status) }}
                    />
                    <div className="truncate text-sm font-semibold">{selected.plate}</div>
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {selected.model ?? "—"}
                  </div>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="rounded-md p-1 text-muted-foreground hover:bg-surface-2"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-2 border-t border-border p-3 text-xs">
                <Row label="Motorista" value={selected.driverName ?? "—"} />
                {selected.driverPhone && (
                  <Row
                    label="Telefone"
                    value={
                      <a
                        href={`tel:${selected.driverPhone}`}
                        className="inline-flex items-center gap-1 text-primary"
                      >
                        <Phone className="h-3 w-3" /> {selected.driverPhone}
                      </a>
                    }
                  />
                )}
                <Row label="Velocidade" value={selected.speed ? `${Math.round(selected.speed)} km/h` : "—"} />
                {selected.order ? (
                  <>
                    <div className="mt-1 rounded-lg bg-surface-2 p-2">
                      <div className="text-[11px] font-medium text-muted-foreground">Entrega ativa</div>
                      <div className="mt-1 font-semibold">{selected.order.tracking_code}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {statusLabel(selected.order.status)}
                      </div>
                    </div>
                    <Row label="Cliente" value={selected.order.client_name ?? "—"} />
                    <Row
                      label="Rota"
                      value={`${selected.order.origin_city ?? "—"} → ${selected.order.destination_city ?? "—"}`}
                    />
                    <Row
                      label="KM restantes"
                      value={
                        selected.order.distance_km != null
                          ? `${selected.order.distance_km.toFixed(1)} km`
                          : "—"
                      }
                    />
                    <Row
                      label="ETA"
                      value={
                        selected.order.eta_minutes != null
                          ? `${selected.order.eta_minutes} min`
                          : "—"
                      }
                    />
                    <Row
                      label="% concluído"
                      value={progressPct(selected.order)}
                    />
                    <Row label="Carga" value={selected.order.cargo ?? "—"} />
                    <Row
                      label="Peso / Vol."
                      value={`${selected.order.weight ? `${selected.order.weight} kg` : "—"} · ${selected.order.volumes ?? "—"}`}
                    />
                    <Row
                      label="Última atualização"
                      value={formatWhen(selected.order.last_ping_at)}
                    />
                    <div className="mt-1 flex gap-2">
                      <button
                        onClick={() =>
                          navigate({
                            to: "/ops/pedidos/$id",
                            params: { id: selected.order!.id },
                          })
                        }
                        className="flex-1 rounded-lg bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
                      >
                        Abrir pedido
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg bg-surface-2 p-2 text-[11px] text-muted-foreground">
                    Sem viagem ativa.
                  </div>
                )}
                <button
                  onClick={() => navigate({ to: "/ops/veiculos/$id", params: { id: selected.id } })}
                  className="mt-1 rounded-lg border border-border px-2 py-1.5 text-xs font-medium hover:bg-surface-2"
                >
                  Detalhes do veículo
                </button>
              </div>
            </div>
          )}
          <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-1.5 rounded-xl bg-surface/90 p-2 text-[10px] shadow backdrop-blur">
            {VEHICLE_STATUS.map((s) => (
              <span key={s.value} className="flex items-center gap-1 px-1">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: FLEET_MAP_COLORS[s.value].color }}
                />
                {s.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[60%] text-right font-medium">{value}</span>
    </div>
  );
}

function progressPct(o: NonNullable<FleetVehicle["order"]>) {
  const total = o.initial_distance_km ?? null;
  const left = o.distance_km ?? null;
  if (total && left != null && total > 0) {
    const pct = Math.max(0, Math.min(100, Math.round(((total - left) / total) * 100)));
    return `${pct}%`;
  }
  return "—";
}

function formatWhen(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins} min`;
  const h = Math.round(mins / 60);
  if (h < 24) return `há ${h} h`;
  return d.toLocaleString("pt-BR");
}
