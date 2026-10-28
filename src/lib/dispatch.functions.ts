import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { addressSchema, addressError } from './addresses/model';
import {canReceiveOffer} from './registration-model';

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

    for (const endpoint of ['origin','destination'] as const) {
      const address=addressSchema.safeParse(order[`${endpoint}_location_details`]);
      const error=address.success?addressError(address.data):'Confirme o endereço e o ponto no mapa.';
      if(error)throw new Error(`${endpoint==='origin'?'Coleta':'Entrega'}: ${error}`);
    }
    if(order.origin_lat==null||order.origin_lng==null||order.destination_lat==null||order.destination_lng==null)throw new Error('Confirme os pontos de coleta e entrega.');
    const { calculateConfirmedRoute }=await import('./addresses/route.server');
    const route=await calculateConfirmedRoute({fromLat:order.origin_lat,fromLng:order.origin_lng,toLat:order.destination_lat,toLng:order.destination_lng},process.env['MAPBOX_API_KEY'],process.env['LOVABLE_API_KEY']);
    const routeSaved=await context.supabase.from('orders').update({route_geometry:JSON.stringify(route.geometry),distance_km:route.distance,estimated_minutes:route.duration}).eq('id',order.id).eq('origin_lat',order.origin_lat).eq('origin_lng',order.origin_lng).eq('destination_lat',order.destination_lat).eq('destination_lng',order.destination_lng).select('id').maybeSingle();
    if(routeSaved.error)throw routeSaved.error;
    if(!routeSaved.data)throw new Error('Os pontos foram alterados. Confira a rota antes de despachar.');

    const { data: existingOffers, error: existingError } = await db
      .from("freight_offers")
      .select("driver_id, status")
      .eq("order_id", order.id);
    if (existingError) throw new Error(existingError.message);
    if (existingOffers?.some((offer) => offer.status === "accepted")) {
      throw new Error("Esta rota já foi aceita por um motorista.");
    }

    // Only approved registrations; do not add unrelated financial/vehicle restrictions.
    const { data: drivers, error: driversError } = await db
      .from("drivers")
      .select("user_id,approval_status,deleted_at").eq('approval_status','active').is('deleted_at',null);
    if (driversError) throw new Error(driversError.message);

    const eligible = (drivers ?? []).filter((driver) => !!driver.user_id&&canReceiveOffer(driver.approval_status,driver.deleted_at));

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