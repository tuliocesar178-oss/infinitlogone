import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  distanceToTargetKm,
  geofenceTransition,
  navTarget,
  MONITOR,
} from "@/lib/geofence";
import { haversineKm } from "@/lib/geo";
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
  const lastValidFixRef = useRef<{ lat: number; lng: number; at: number; accuracy: number } | null>(null);
  const lastPersistedRef = useRef<{ lat: number; lng: number; at: number } | null>(null);
  const filteredSpeedRef = useRef<number | null>(null);
  const gpsLostAlertedRef = useRef(false);

  statusRef.current = order?.status;

  const orderId = order?.id;
  const active = !!orderId && !!userId && ACTIVE_STATUSES.includes(order?.status ?? "");

  useEffect(() => {
    if (!active || !order || !userId) return;
    idleSinceRef.current = null;
    idleAlertedRef.current = false;
    speedAlertedRef.current = false;
    lastValidFixRef.current = null;
    lastPersistedRef.current = null;
    filteredSpeedRef.current = null;
    gpsLostAlertedRef.current = false;

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
        const { latitude: lat, longitude: lng, speed, heading, accuracy, altitude } = pos.coords;
        const now = Number.isFinite(pos.timestamp) ? pos.timestamp : Date.now();
        if (
          !Number.isFinite(lat) ||
          !Number.isFinite(lng) ||
          Math.abs(lat) > 90 ||
          Math.abs(lng) > 180 ||
          !Number.isFinite(accuracy) ||
          accuracy <= 0 ||
          accuracy > 100
        ) {
          return;
        }

        const previousFix = lastValidFixRef.current;
        let measuredSpeed =
          speed != null && Number.isFinite(speed) && speed >= 0 ? speed * 3.6 : null;
        if (measuredSpeed == null && previousFix) {
          const elapsedSeconds = (now - previousFix.at) / 1000;
          const movedKm = haversineKm(previousFix, { lat, lng });
          if (elapsedSeconds > 0 && elapsedSeconds <= 30 && movedKm * 1000 > Math.max(10, accuracy)) {
            measuredSpeed = (movedKm * 3600) / elapsedSeconds;
          }
        }
        const speedKmh =
          measuredSpeed == null
            ? null
            : Math.round(
                (filteredSpeedRef.current == null
                  ? measuredSpeed
                  : filteredSpeedRef.current * 0.65 + measuredSpeed * 0.35) * 10,
              ) / 10;
        if (speedKmh != null) filteredSpeedRef.current = speedKmh;

        const validHeading =
          heading != null && Number.isFinite(heading) && heading >= 0 && heading < 360
            ? heading
            : null;
        lastValidFixRef.current = { lat, lng, at: now, accuracy };
        lastFixRef.current = Date.now();
        gpsLostAlertedRef.current = false;

        const status = statusRef.current ?? order.status;
        const target = navTarget(status, order);
        const dist = distanceToTargetKm({ lat, lng }, target);
        const capturedAt = new Date(now).toISOString();

        setLive({
          lat,
          lng,
          speedKmh,
          heading: validHeading,
          accuracy,
          distanceToTargetKm: dist,
          updatedAt: capturedAt,
          gpsLost: false,
        });

        const lastPersisted = lastPersistedRef.current;
        const movedSincePersist = lastPersisted
          ? haversineKm(lastPersisted, { lat, lng })
          : Number.POSITIVE_INFINITY;
        const stopped = speedKmh != null && speedKmh < MONITOR.idleSpeedKmh && movedSincePersist < 0.02;
        const shouldPersist =
          !lastPersisted ||
          (stopped
            ? Date.now() - lastPersisted.at >= 15_000
            : Date.now() - lastPersisted.at >= 3_000 || movedSincePersist >= 0.035);

        if (shouldPersist) {
          try {
            const { error: driverError } = await supabase
              .from("drivers")
              .update({
                current_lat: lat,
                current_lng: lng,
                current_speed: speedKmh,
                current_heading: validHeading,
                current_accuracy: accuracy,
                current_altitude: altitude,
                last_seen_at: capturedAt,
              } as never)
              .eq("user_id", userId);
            if (driverError) throw driverError;

            const { error: pointError } = await supabase.from("order_tracking_points").insert({
              order_id: order.id,
              driver_id: userId,
              lat,
              lng,
              speed: speedKmh,
              heading: validHeading,
              accuracy,
              altitude,
              created_at: capturedAt,
            });
            if (pointError) throw pointError;

            if (dist != null) {
              const { error } = await supabase
                .from("orders")
                .update({ distance_to_destination_km: dist } as never)
                .eq("id", order.id);
              if (error) throw error;
            }
            lastPersistedRef.current = { lat, lng, at: Date.now() };
          } catch (err) {
            console.error("[Tracking] erro ao enviar posição:", err);
          }
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
      (err) => {
        console.error("[Tracking] Geolocation error:", err);
        setLive((previous) => (previous ? { ...previous, gpsLost: true } : previous));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 1000 },
    );

    // O GPS avisa cada nova leitura; este relógio só atualiza o aviso de sinal perdido.
    const gpsCheck = window.setInterval(async () => {
      const secs = (Date.now() - lastFixRef.current) / 1000;
      if (secs > MONITOR.gpsLostSeconds) {
        setLive((p) => (p ? { ...p, gpsLost: true } : p));
        if (!gpsLostAlertedRef.current) {
          gpsLostAlertedRef.current = true;
          await logEvent("gps_lost", { seconds_without_fix: Math.round(secs) });
        }
      }
    }, 10000);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      window.clearInterval(gpsCheck);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, orderId, userId]);

  return active ? live : null;
}
