import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook to handle background tracking during active trips.
 * Starts automatically when an order is active and status indicates transit.
 */
export function useBackgroundTracking(orderId: string | undefined, userId: string | undefined, status: string | undefined) {
  useEffect(() => {
    if (!orderId || !userId || !status) return;

    // Rules: Start tracking when status is 'en_route_pickup' or later, until 'delivered'
    const trackingStatuses = [
      "en_route_pickup",
      "at_pickup",
      "loaded",
      "in_transit",
      "at_destination",
      "near_destination"
    ];

    if (!trackingStatuses.includes(status)) return;

    console.log("[Tracking] Starting background tracking for order:", orderId);

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng, speed, heading, accuracy, altitude } = pos.coords;

        try {
          // 1. Update current driver position (Realtime)
          await supabase
            .from("drivers")
            .update({
              current_lat: lat,
              current_lng: lng,
              current_speed: speed,
              current_heading: heading,
              current_accuracy: accuracy,
              current_altitude: altitude,
              last_seen_at: new Date().toISOString()
            } as any)
            .eq("user_id", userId);

          // 2. Log historical point (Replay)
          await supabase
            .from("order_tracking_points")
            .insert({
              order_id: orderId,
              driver_id: userId,
              lat,
              lng,
              speed,
              heading,
              accuracy,
              altitude
            });

        } catch (err) {
          console.error("[Tracking] Update error:", err);
        }
      },
      (err) => console.error("[Tracking] Geolocation error:", err),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000
      }
    );

    return () => {
      console.log("[Tracking] Stopping background tracking");
      navigator.geolocation.clearWatch(watchId);
    };
  }, [orderId, userId, status]);
}
