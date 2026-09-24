import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ORDER_COLUMNS = [
  "id", "code", "tracking_code", "status", "driver_id", "vehicle_id",
  "origin_city", "destination_city", "origin_lat", "origin_lng",
  "destination_lat", "destination_lng", "current_lat", "current_lng",
  "distance_to_destination_km", "eta_minutes", "delivery_window_end",
  "last_ping_at", "created_at", "updated_at",
].join(",");

export const getClientTrackingOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // This first query is subject to RLS, proving every returned order belongs
    // to the signed-in client before privileged, field-limited lookups occur.
    const { data: orders, error: ordersError } = await context.supabase
      .from("orders")
      .select(ORDER_COLUMNS as "*")
      .eq("client_id", context.userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (ordersError) throw ordersError;
    if (!orders?.length) return [];

    const driverIds = Array.from(
      new Set(orders.map((order) => order.driver_id).filter((id): id is string => Boolean(id))),
    );
    const vehicleIds = Array.from(
      new Set(orders.map((order) => order.vehicle_id).filter((id): id is string => Boolean(id))),
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [profilesResult, driversResult, vehiclesResult] = await Promise.all([
      driverIds.length
        ? supabaseAdmin.from("profiles").select("id, full_name, avatar_url").in("id", driverIds)
        : Promise.resolve({ data: [], error: null }),
      driverIds.length
        ? supabaseAdmin
            .from("drivers")
            .select("user_id, status, availability, license_category, photo_url")
            .in("user_id", driverIds)
        : Promise.resolve({ data: [], error: null }),
      vehicleIds.length
        ? supabaseAdmin
            .from("vehicles")
            .select("id, plate, brand, model, year, color, vehicle_type, body_type, capacity_kg, axles, photo_url, status")
            .in("id", vehicleIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (profilesResult.error || driversResult.error || vehiclesResult.error) {
      throw new Error("Não foi possível carregar os dados operacionais do rastreamento.");
    }

    const profiles = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]));
    const drivers = new Map((driversResult.data ?? []).map((driver) => [driver.user_id, driver]));
    const vehicles = new Map((vehiclesResult.data ?? []).map((vehicle) => [vehicle.id, vehicle]));

    return orders.map((order) => {
      const profile = order.driver_id ? profiles.get(order.driver_id) : undefined;
      const driver = order.driver_id ? drivers.get(order.driver_id) : undefined;
      return {
        ...order,
        driver: order.driver_id
          ? {
              id: order.driver_id,
              name: profile?.full_name ?? null,
              photo_url: profile?.avatar_url ?? driver?.photo_url ?? null,
              status: driver?.status ?? null,
              availability: driver?.availability ?? null,
              license_category: driver?.license_category ?? null,
            }
          : null,
        vehicle: order.vehicle_id ? vehicles.get(order.vehicle_id) ?? null : null,
      };
    });
  });