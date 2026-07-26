import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { TripMap } from "@/components/trip-map";
import { haversineKm } from "@/lib/geo";
import { refreshTrackingEta, fetchDrivingRoute } from "@/lib/tracking.functions";
import { toast } from "sonner";
import { MapPin, Play, PackageCheck, CheckCircle2, Radio, Lock } from "lucide-react";
import { STATUS_LABEL } from "@/lib/order-status";

type Order = {
  id: string;
  code: string;
  status: string;
  driver_id: string | null;
  origin_address: string;
  origin_lat: number | null;
  origin_lng: number | null;
  destination_address: string;
  destination_lat: number | null;
  destination_lng: number | null;
  distance_to_destination_km: number | null;
  eta_minutes: number | null;
  current_city: string | null;
  arrival_override_at: string | null;
};

const IN_TRIP: string[] = [
  "driver_assigned",
  "en_route_pickup",
  "at_pickup",
  "picked_up",
  "loaded",
  "out_for_delivery",
  "in_transit",
  "near_destination",
];

export function ActiveTripCard({ driverId }: { driverId: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(null);
  const [route, setRoute] = useState<{
    type: "LineString";
    coordinates: [number, number][];
  } | null>(null);
  const [arrivalRadius, setArrivalRadius] = useState<number>(100);
  const [saving, setSaving] = useState(false);
  const watchId = useRef<number | null>(null);
  const lastEnrichAt = useRef<number>(0);
  const lastRouteAt = useRef<number>(0);
  const refresh = useServerFn(refreshTrackingEta);
  const getRoute = useServerFn(fetchDrivingRoute);

  // Load active order + settings
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("orders")
        .select(
          "id, code, status, driver_id, origin_address, origin_lat, origin_lng, destination_address, destination_lat, destination_lng, distance_to_destination_km, eta_minutes, current_city, arrival_override_at",
        )
        .eq("driver_id", driverId)
        .in("status", IN_TRIP as any)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setOrder((data as Order) ?? null);
      const { data: settings } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "arrival_radius_m")
        .maybeSingle();
      if (settings?.value != null) setArrivalRadius(Number(settings.value));
    })();
  }, [driverId]);

  // Realtime updates for this order
  useEffect(() => {
    if (!order) return;
    const ch = supabase
      .channel(`order-${order.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${order.id}` },
        (payload) => setOrder((prev) => (prev ? { ...prev, ...(payload.new as any) } : prev)),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [order?.id]);

  const trackingActive = useMemo(
    () =>
      order != null &&
      ["en_route_pickup", "picked_up", "loaded", "out_for_delivery", "in_transit", "near_destination"].includes(
        order.status,
      ),
    [order?.status],
  );

  // Geolocation watcher
  useEffect(() => {
    if (!order || !trackingActive) {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
      return;
    }
    if (!("geolocation" in navigator)) return;
    watchId.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setDriverPos(p);
        let distKm: number | null = null;
        if (order.destination_lat != null && order.destination_lng != null) {
          distKm = Number(
            haversineKm(p, { lat: order.destination_lat, lng: order.destination_lng }).toFixed(2),
          );
        }
        try {
          await supabase.from("driver_locations").insert({
            order_id: order.id,
            driver_id: driverId,
            lat: p.lat,
            lng: p.lng,
            speed_kmh: pos.coords.speed != null ? pos.coords.speed * 3.6 : null,
            heading: pos.coords.heading ?? null,
            accuracy_m: pos.coords.accuracy ?? null,
            distance_to_destination_km: distKm,
          });
        } catch (e) {
          // silent
        }
        // Enrich ETA + city every 60s
        const now = Date.now();
        if (now - lastEnrichAt.current > 60_000) {
          lastEnrichAt.current = now;
          try {
            await refresh({ data: { orderId: order.id, lat: p.lat, lng: p.lng } });
          } catch (e) {
            // silent
          }
        }
        // Refresh route polyline every 3 min
        if (now - lastRouteAt.current > 180_000 && order.destination_lat != null && order.destination_lng != null) {
          lastRouteAt.current = now;
          try {
            const r = await getRoute({
              data: {
                fromLat: p.lat,
                fromLng: p.lng,
                toLat: order.destination_lat,
                toLng: order.destination_lng,
              },
            });
            if (r?.geometry) setRoute(r.geometry as any);
          } catch (e) {
            // silent
          }
        }
      },
      (err) => console.warn("geo error", err),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20_000 },
    );
    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
    };
  }, [order?.id, trackingActive]);

  const distanceToDest = useMemo(() => {
    if (!order || !driverPos || order.destination_lat == null || order.destination_lng == null)
      return null;
    return haversineKm(driverPos, {
      lat: order.destination_lat,
      lng: order.destination_lng,
    });
  }, [driverPos?.lat, driverPos?.lng, order?.destination_lat, order?.destination_lng]);

  const canDeliver =
    !!order &&
    (order.arrival_override_at != null ||
      (distanceToDest != null && distanceToDest * 1000 <= arrivalRadius));

  async function updateOrderStatus(next: string, patch: Record<string, unknown> = {}) {
    if (!order) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: next as any, ...(patch as any) })
        .eq("id", order.id);
      if (error) throw error;
      await supabase.from("order_events").insert({
        order_id: order.id,
        event_type: "driver_action",
        to_status: next as any,
        actor_id: driverId,
      });
      setOrder((p) => (p ? { ...p, status: next, ...(patch as any) } : p));
      toast.success("Status atualizado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  if (!order) return null;

  return (
    <div className="card-soft overflow-hidden">
      <div className="flex items-center justify-between border-b border-border bg-surface-2 px-6 py-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            Viagem ativa
          </div>
          <div className="font-mono text-sm font-semibold">{order.code}</div>
        </div>
        <span
          className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium"
          style={{ background: statusMeta(order.status).tint, color: statusMeta(order.status).color }}
        >
          {statusMeta(order.status).label}
        </span>
      </div>

      <div className="h-72 w-full">
        <TripMap
          className="h-full w-full"
          driver={driverPos}
          origin={
            order.origin_lat != null && order.origin_lng != null
              ? { lat: order.origin_lat, lng: order.origin_lng }
              : null
          }
          destination={
            order.destination_lat != null && order.destination_lng != null
              ? { lat: order.destination_lat, lng: order.destination_lng }
              : null
          }
          routeGeoJSON={route}
        />
      </div>

      <div className="grid grid-cols-3 gap-3 border-b border-border p-4">
        <Stat label="Distância" value={distanceToDest != null ? `${distanceToDest.toFixed(1)} km` : "—"} />
        <Stat label="ETA" value={order.eta_minutes != null ? `${order.eta_minutes} min` : "—"} />
        <Stat label="Cidade" value={order.current_city ?? "—"} />
      </div>

      <div className="space-y-2 p-4">
        <div className="flex items-start gap-2 text-sm">
          <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Destino</div>
            <div>{order.destination_address}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-2 border-t border-border bg-surface-2 p-4 sm:grid-cols-2">
        {order.status === "driver_assigned" && (
          <ActionButton
            icon={<Play className="h-4 w-4" />}
            label="Iniciar deslocamento"
            onClick={() =>
              updateOrderStatus("en_route_pickup", { started_trip_at: new Date().toISOString() })
            }
            disabled={saving}
          />
        )}
        {order.status === "en_route_pickup" && (
          <ActionButton
            icon={<MapPin className="h-4 w-4" />}
            label="Cheguei na coleta"
            onClick={() => updateOrderStatus("at_pickup")}
            disabled={saving}
          />
        )}
        {order.status === "at_pickup" && (
          <ActionButton
            icon={<PackageCheck className="h-4 w-4" />}
            label="Coleta concluída"
            onClick={() => updateOrderStatus("picked_up")}
            disabled={saving}
          />
        )}
        {(order.status === "picked_up" || order.status === "loaded") && (
          <ActionButton
            icon={<Radio className="h-4 w-4" />}
            label="Iniciar entrega"
            onClick={() => updateOrderStatus("in_transit")}
            disabled={saving}
          />
        )}
        {(order.status === "in_transit" ||
          order.status === "out_for_delivery" ||
          order.status === "near_destination") && (
          <ActionButton
            icon={canDeliver ? <CheckCircle2 className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            label={
              canDeliver
                ? "Registrar entrega"
                : `Aproxime-se do destino (${
                    distanceToDest != null ? `${Math.round(distanceToDest * 1000)}m` : "—"
                  })`
            }
            onClick={() =>
              updateOrderStatus("delivered", { arrived_at: new Date().toISOString() })
            }
            disabled={saving || !canDeliver}
            primary={canDeliver}
          />
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 p-3 text-center">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  disabled,
  primary = true,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`col-span-full inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
        primary
          ? "bg-primary text-primary-foreground hover:opacity-90"
          : "bg-surface text-foreground border border-border"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
