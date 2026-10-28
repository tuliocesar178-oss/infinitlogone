import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from 'zod';

const GATEWAY = "https://connector-gateway.lovable.dev/mapbox";

function requireEnv(): { lovable: string; mapbox: string } {
  const lovable = process.env.LOVABLE_API_KEY;
  const mapbox = process.env.MAPBOX_API_KEY;
  if (!lovable || !mapbox) throw new Error("Mapbox connector não configurado.");
  return { lovable, mapbox };
}

async function mapboxGet(path: string): Promise<any> {
  const { lovable, mapbox } = requireEnv();
  const res = await fetch(`${GATEWAY}${path}`, {
    headers: {
      Authorization: `Bearer ${lovable}`,
      "X-Connection-Api-Key": mapbox,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Mapbox ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

/**
 * Refresh a live trip's ETA and current city using Mapbox.
 * Called by the driver page periodically and by ops on demand.
 */
export const refreshTrackingEta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orderId: string; lat: number; lng: number }) => d)
  .handler(async ({ data, context }) => {
    const { orderId, lat, lng } = data;
    const { data: order, error } = await context.supabase
      .from("orders")
      .select("id, driver_id, destination_lat, destination_lng, status")
      .eq("id", orderId)
      .maybeSingle();
    if (error) throw error;
    if (!order) throw new Error("Pedido não encontrado");

    let eta_minutes: number | null = null;
    let distance_km: number | null = null;

    if (order.destination_lat != null && order.destination_lng != null) {
      // Directions v5 driving-traffic profile
      const coords = `${lng},${lat};${order.destination_lng},${order.destination_lat}`;
      try {
        const dir = await mapboxGet(
          `/directions/v5/mapbox/driving-traffic/${coords}?overview=false&geometries=geojson`,
        );
        const r = dir?.routes?.[0];
        if (r) {
          eta_minutes = Math.max(1, Math.round(r.duration / 60));
          distance_km = Math.round((r.distance / 1000) * 10) / 10;
        }
      } catch (e) {
        console.warn("[tracking] directions failed", e);
      }
    }

    // Reverse geocode -> city
    let current_city: string | null = null;
    try {
      const rev = await mapboxGet(
        `/geocoding/v5/mapbox.places/${lng},${lat}.json?types=place&limit=1&language=pt`,
      );
      current_city = rev?.features?.[0]?.text ?? null;
    } catch (e) {
      console.warn("[tracking] reverse geocode failed", e);
    }

    await context.supabase
      .from("orders")
      .update({
        current_city,
        ...(eta_minutes != null ? { eta_minutes } : {}),
        ...(distance_km != null ? { distance_to_destination_km: distance_km } : {}),
      })
      .eq("id", orderId);
    return { eta_minutes, distance_km, current_city };
  });

/**
 * Fetch a driving route (for showing the polyline on the driver map).
 */
export const fetchDrivingRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { fromLat: number; fromLng: number; toLat: number; toLng: number }) => z.object({ fromLat:z.number().min(-90).max(90),fromLng:z.number().min(-180).max(180),toLat:z.number().min(-90).max(90),toLng:z.number().min(-180).max(180) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { calculateConfirmedRoute } = await import('./addresses/route.server');
    return calculateConfirmedRoute(data, process.env['MAPBOX_API_KEY'], process.env['LOVABLE_API_KEY']);
  });

/**
 * Geocode an address (for populating destination lat/lng when creating orders).
 */
export const geocodeAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { query: string }) => d)
  .handler(async ({ data }) => {
    const q = encodeURIComponent(data.query.slice(0, 200));
    const res = await mapboxGet(
      `/geocoding/v5/mapbox.places/${q}.json?country=BR&limit=1&language=pt`,
    );
    const f = res?.features?.[0];
    if (!f) return { lat: null, lng: null, place: null };
    return { lat: f.center[1], lng: f.center[0], place: f.place_name };
  });
