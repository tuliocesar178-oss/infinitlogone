import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  order_id: z.string().uuid(),
  price: z.number().nonnegative().max(10_000_000),
  minutes: z.number().int().min(1).max(1440),
});

const normalize = (value: string | null | undefined) =>
  (value ?? "").trim().toLocaleLowerCase("pt-BR");

export const dispatchOrderToEligibleDrivers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof schema>) => schema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isStaff } = await context.supabase.rpc("is_staff", {
      _user_id: context.userId,
    });
    if (!isStaff) throw new Error("Apenas a equipe de operação pode despachar rotas.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin;

    const { data: order, error: orderError } = await db
      .from("orders")
      .select("*")
      .eq("id", data.order_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (orderError) throw new Error(orderError.message);
    if (!order) throw new Error("Rota não encontrada.");

    if (!["planning", "created", "preparing", "awaiting_driver"].includes(order.status)) {
      throw new Error("Esta rota não pode ser despachada no status atual.");
    }
    if (order.driver_id) throw new Error("Esta rota já possui motorista.");

    const { data: existingOffers, error: existingError } = await db
      .from("freight_offers")
      .select("driver_id, status")
      .eq("order_id", order.id);
    if (existingError) throw new Error(existingError.message);
    if (existingOffers?.some((offer) => offer.status === "accepted")) {
      throw new Error("Esta rota já foi aceita por um motorista.");
    }

    const { data: drivers, error: driversError } = await db
      .from("drivers")
      .select("user_id, current_vehicle_id")
      .eq("approval_status", "active")
      .eq("financial_status", "ativo")
      .in("availability", ["disponivel", "offline"]);
    if (driversError) throw new Error(driversError.message);

    let eligible = drivers ?? [];
    const needsVehicle =
      !!order.vehicle_id ||
      !!order.required_vehicle_type ||
      !!order.required_body_type ||
      order.required_capacity_kg != null ||
      order.required_axles != null;

    if (needsVehicle) {
      const vehicleIds = [...new Set(eligible.map((driver) => driver.current_vehicle_id).filter((id): id is string => !!id))];
      const { data: vehicles, error: vehiclesError } = vehicleIds.length
        ? await db
            .from("vehicles")
            .select("id, owner_driver_id, vehicle_type, category, body_type, capacity_kg, max_weight_kg, axles, active")
            .in("id", vehicleIds)
            .eq("active", true)
        : { data: [], error: null };
      if (vehiclesError) throw new Error(vehiclesError.message);

      const matchingDrivers = new Set(
        (vehicles ?? [])
          .filter((vehicle) => {
            if (order.vehicle_id && vehicle.id !== order.vehicle_id) return false;

            const type = normalize(order.required_vehicle_type);
            if (
              type &&
              !normalize(`${vehicle.vehicle_type ?? ""} ${vehicle.category ?? ""}`).includes(type)
            ) return false;

            const body = normalize(order.required_body_type);
            if (body && !normalize(vehicle.body_type).includes(body)) return false;

            const capacity = Number(vehicle.max_weight_kg ?? vehicle.capacity_kg ?? 0);
            if (order.required_capacity_kg != null && capacity < Number(order.required_capacity_kg)) {
              return false;
            }

            if (order.required_axles != null && Number(vehicle.axles) !== Number(order.required_axles)) {
              return false;
            }
            return true;
          })
          .map((vehicle) => vehicle.owner_driver_id)
          .filter(Boolean),
      );

      eligible = eligible.filter((driver) => matchingDrivers.has(driver.user_id));
    }

    if (!eligible.length) return { count: 0, driverIds: [] as string[] };

    const driverIds = eligible.map((driver) => driver.user_id as string);
    const expiresAt = new Date(Date.now() + data.minutes * 60_000).toISOString();
    const rows = driverIds.map((driver_id) => ({
      order_id: order.id,
      driver_id,
      offered_price: data.price,
      expires_at: expiresAt,
      status: "pending" as const,
    }));

    const { error: offersError } = await db
      .from("freight_offers")
      .upsert(rows, { onConflict: "order_id,driver_id" });
    if (offersError) throw new Error(offersError.message);

    const { error: statusError } = await db
      .from("orders")
      .update({ status: "awaiting_driver", driver_amount: data.price })
      .eq("id", order.id)
      .is("driver_id", null);
    if (statusError) throw new Error(statusError.message);

    const { error: eventError } = await db.from("order_events").insert({
      order_id: order.id,
      event_type: "offers_sent",
      from_status: order.status,
      to_status: "awaiting_driver",
      actor_id: context.userId,
      payload: { drivers: driverIds.length, price: data.price, expires_in_min: data.minutes },
    });
    if (eventError) throw new Error(eventError.message);

    return { count: driverIds.length, driverIds };
  });