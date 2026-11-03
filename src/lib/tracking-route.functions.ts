import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { authorizedTrackingOrder, hasActiveDriverRoute, savedTrackingRoute, trackingPoint, trackingStage } from "./tracking-route-model";

export const getSelectedTrackingRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ orderId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    // RLS plus an explicit ownership check: a caller cannot obtain another client's route.
    const result = await context.supabase.from("orders")
      .select("id,client_id,driver_id,status,origin_lat,origin_lng,destination_lat,destination_lng,route_geometry,distance_km,current_lat,current_lng,last_ping_at")
      .eq("id", data.orderId).is("deleted_at", null).maybeSingle();
    if (result.error) throw result.error;
    const order = result.data;
    if (!order) throw new Error("Frete não autorizado para rastreamento.");
    if (order.client_id !== context.userId) {
      const access = await context.supabase.rpc("can_manage_operation_board", { _user: context.userId });
      if (access.error || !authorizedTrackingOrder(order.client_id, context.userId, access.data === true))
        throw new Error("Frete não autorizado para rastreamento.");
    }
    if (!hasActiveDriverRoute(order)) return { planned: null, approach: null, distance: null, stage: trackingStage(order), unavailable: "Sem rota ativa atribuída a um motorista." };
    const origin = trackingPoint(order.origin_lat, order.origin_lng);
    const destination = trackingPoint(order.destination_lat, order.destination_lng);
    let planned = savedTrackingRoute(order);
    let distance = order.distance_km;
    let approach: GeoJSON.LineString | null = null;
    const stage = trackingStage(order);
    let unavailable: string | null = null;
    const { calculateConfirmedRoute } = await import("./addresses/route.server");
    const calculate = async (from: [number, number], to: [number, number]) => calculateConfirmedRoute(
      { fromLng: from[0], fromLat: from[1], toLng: to[0], toLat: to[1] },
      process.env["MAPBOX_API_KEY"], process.env["LOVABLE_API_KEY"],
    );
    try {
      if (!planned && origin && destination) {
        const route = await calculate(origin, destination);
        planned = route.geometry; distance = route.distance;
      }
      const position = trackingPoint(order.current_lat, order.current_lng);
      const ping = order.last_ping_at ? Date.parse(order.last_ping_at) : NaN;
      // No approach is inferred from old GPS. The planned route remains available.
      if (stage === "pickup" && origin && position && Number.isFinite(ping) && Date.now() - ping <= 180_000 && ping <= Date.now() + 30_000
        && Math.hypot(position[0] - origin[0], position[1] - origin[1]) > 0.0001) {
        approach = (await calculate(position, origin)).geometry;
      }
    } catch (error) {
      unavailable = error instanceof Error ? error.message : "Trajeto indisponível.";
    }
    if (!planned && !unavailable) unavailable = "Trajeto indisponível: pontos de coleta ou entrega ausentes.";
    return { planned, approach, distance, stage, unavailable };
  });