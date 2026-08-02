import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  distanceToTargetKm,
  geofenceTransition,
  navTarget,
  MONITOR,
} from "@/lib/geofence";
import { STATUS_LABEL } from "@/lib/order-status";

export type LiveTelemetry = {
  lat: number;
  lng: number;
  speedKmh: number | null;
  heading: number | null;
  accuracy: number | null;
  distanceToTargetKm: number | null;
  updatedAt: string;
  gpsLost: boolean;
};

type TrackedOrder = {
  id: string;
  status: string;
  origin_lat: number | null;
  origin_lng: number | null;
  origin_address: string;
  destination_lat: number | null;
  destination_lng: number | null;
  destination_address: string;
};

const ACTIVE_STATUSES = [
  "driver_assigned",
  "en_route_pickup",
  "in_transit_to_pickup",
  "near_pickup",
  "arriving_pickup",
  "at_pickup",
  "loading",
  "loaded",
  "picked_up",
  "out_for_delivery",
  "in_transit",
  "near_destination",
  "arriving_destination",
  "at_destination",
  "unloading",
];

/**
 * Rastreamento automático em segundo plano + automação por geofencing.
 * Inicia sozinho quando existe um frete ativo e encerra ao entregar.
 */
export function useBackgroundTracking(
  order: TrackedOrder | null | undefined,
  userId: string | undefined,
): LiveTelemetry | null {
  const [live, setLive] = useState<LiveTelemetry | null>(null);
  const statusRef = useRef<string | undefined>(order?.status);
  const transitioningRef = useRef(false);
  const idleSinceRef = useRef<number | null>(null);
  const idleAlertedRef = useRef(false);
  const speedAlertedRef = useRef(false);
  const lastFixRef = useRef<number>(Date.now());

  statusRef.current = order?.status;

  const orderId = order?.id;
  const active = !!orderId && !!userId && ACTIVE_STATUSES.includes(order?.status ?? "");

  useEffect(() => {
    if (!active || !order || !userId) return;
    idleSinceRef.current = null;
    idleAlertedRef.current = false;
    speedAlertedRef.current = false;

    async function logEvent(type: string, payload: Record<string, unknown>) {
      await supabase.from("order_events").insert({
        order_id: order!.id,
        event_type: type,
        actor_id: userId!,
        payload: payload as never,
      } as never);
    }

    async function applyGeofence(status: string, distanceKm: number | null) {
      const to = geofenceTransition(status, distanceKm);
      if (!to || to === status || transitioningRef.current) return;
      transitioningRef.current = true;
      try {
        const { error } = await supabase
          .from("orders")
          .update({ status: to as never, updated_at: new Date().toISOString() })
          .eq("id", order!.id);
        if (error) throw error;
        statusRef.current = to;
        await logEvent("geofence_transition", {
          from: status,
          to,
          distance_km: distanceKm,
        });
        toast.info(`Status atualizado automaticamente: ${STATUS_LABEL[to] ?? to}`);
      } catch (e) {
        console.error("[Geofence] falha ao atualizar status", e);
      } finally {
        transitioningRef.current = false;
      }
    }

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        lastFixRef.current = Date.now();
        const { latitude: lat, longitude: lng, speed, heading, accuracy, altitude } = pos.coords;
        const speedKmh = speed != null ? Math.max(0, speed * 3.6) : null;
        const status = statusRef.current ?? order.status;
        const target = navTarget(status, order);
        const dist = distanceToTargetKm({ lat, lng }, target);

        setLive({
          lat,
          lng,
          speedKmh,
          heading: heading ?? null,
          accuracy: accuracy ?? null,
          distanceToTargetKm: dist,
          updatedAt: new Date().toISOString(),
          gpsLost: false,
        });

        try {
          await supabase
            .from("drivers")
            .update({
              current_lat: lat,
              current_lng: lng,
              current_speed: speedKmh,
              current_heading: heading,
              current_accuracy: accuracy,
              current_altitude: altitude,
              last_seen_at: new Date().toISOString(),
            } as never)
            .eq("user_id", userId);

          await supabase.from("order_tracking_points").insert({
            order_id: order.id,
            driver_id: userId,
            lat,
            lng,
            speed: speedKmh,
            heading,
            accuracy,
            altitude,
          });

          if (dist != null) {
            await supabase
              .from("orders")
              .update({ distance_to_destination_km: dist } as never)
              .eq("id", order.id);
          }
        } catch (err) {
          console.error("[Tracking] erro ao enviar posição:", err);
        }

        // Automação por geofencing
        await applyGeofence(status, dist);

        // Monitoramento inteligente — parada prolongada
        if (speedKmh != null && speedKmh < MONITOR.idleSpeedKmh) {
          idleSinceRef.current = idleSinceRef.current ?? Date.now();
          const minutes = (Date.now() - idleSinceRef.current) / 60000;
          if (minutes >= MONITOR.idleAlertMinutes && !idleAlertedRef.current) {
            idleAlertedRef.current = true;
            await logEvent("idle_alert", { minutes: Math.round(minutes), lat, lng });
          }
        } else {
          idleSinceRef.current = null;
          idleAlertedRef.current = false;
        }

        // Monitoramento inteligente — excesso de velocidade
        if (speedKmh != null && speedKmh > MONITOR.speedLimitKmh) {
          if (!speedAlertedRef.current) {
            speedAlertedRef.current = true;
            await logEvent("speeding_alert", { speed_kmh: Math.round(speedKmh), lat, lng });
          }
        } else {
          speedAlertedRef.current = false;
        }
      },
      (err) => console.error("[Tracking] Geolocation error:", err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 },
    );

    // Monitoramento de sinal de GPS perdido
    const gpsCheck = window.setInterval(async () => {
      const secs = (Date.now() - lastFixRef.current) / 1000;
      if (secs > MONITOR.gpsLostSeconds) {
        setLive((p) => (p ? { ...p, gpsLost: true } : p));
        await logEvent("gps_lost", { seconds_without_fix: Math.round(secs) });
        lastFixRef.current = Date.now();
      }
    }, 60000);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      window.clearInterval(gpsCheck);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, orderId, userId]);

  return active ? live : null;
}
