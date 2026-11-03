import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { addressSchema, addressError } from './addresses/model';
import { canReceiveOffer } from './registration-model';
import { requireDriverAmount } from './freight-values';
import type { DispatchDriver } from './dispatch-model';

const schema = z.object({
  order_id: z.string().uuid(),
  price: z.number().positive().max(10_000_000),
  minutes: z.number().int().min(1).max(1440),
});

const manualSchema = schema.extend({ driver_id: z.string().uuid() });

type StaffContext = { supabase: any; userId: string };

async function ensureStaff(context: StaffContext) {
  const { data: isStaff } = await context.supabase.rpc("is_staff", {
    _user_id: context.userId,
  });
  if (!isStaff) throw new Error("Apenas a equipe de operação pode despachar rotas.");
}

/**
 * Valida o frete, confirma endereços/pontos, recalcula e persiste a rota
 * confirmada e grava o valor ao motorista. Compartilhado pelas duas
 * modalidades de despacho para que automático e manual sigam as mesmas regras.
 */
async function prepareOrderForDispatch(context: StaffContext, db: any, orderId: string, price: number) {
  const { data: order, error: orderError } = await db
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .is("deleted_at", null)
    .maybeSingle();
  if (orderError) throw new Error(orderError.message);
  if (!order) throw new Error("Rota não encontrada.");
  const driverAmount = requireDriverAmount(price);

  if (!["planning", "created", "preparing", "awaiting_driver"].includes(order.status)) {
    throw new Error("Esta rota não pode ser despachada no status atual.");
  }
  if (order.driver_id) throw new Error("Esta rota já possui motorista.");

  for (const endpoint of ['origin', 'destination'] as const) {
    const address = addressSchema.safeParse(order[`${endpoint}_location_details`]);
    const error = address.success ? addressError(address.data) : 'Confirme o endereço e o ponto no mapa.';
    if (error) throw new Error(`${endpoint === 'origin' ? 'Coleta' : 'Entrega'}: ${error}`);
  }
  const olat = order.origin_lat, olng = order.origin_lng, dlat = order.destination_lat, dlng = order.destination_lng;
  if (olat == null || olng == null || dlat == null || dlng == null) throw new Error('Confirme os pontos de coleta e entrega.');
  const { calculateConfirmedRoute } = await import('./addresses/route.server');
  const route = await calculateConfirmedRoute({ fromLat: olat, fromLng: olng, toLat: dlat, toLng: dlng }, process.env['MAPBOX_API_KEY'], process.env['LOVABLE_API_KEY']);
  // Concurrency guard with tolerance: the API may return float8 coordinates with
  // less precision than stored, so exact equality filters can miss the row.
  // 1e-6° ≈ 0,1 m — far above the float error, far below any real point change.
  const COORD_EPS = 1e-6;
  const routeSaved = await context.supabase.from('orders').update({ route_geometry: JSON.stringify(route.geometry), distance_km: route.distance, estimated_minutes: route.duration }).eq('id', order.id)
    .gte('origin_lat', olat - COORD_EPS).lte('origin_lat', olat + COORD_EPS)
    .gte('origin_lng', olng - COORD_EPS).lte('origin_lng', olng + COORD_EPS)
    .gte('destination_lat', dlat - COORD_EPS).lte('destination_lat', dlat + COORD_EPS)
    .gte('destination_lng', dlng - COORD_EPS).lte('destination_lng', dlng + COORD_EPS)
    .select('id').maybeSingle();
  if (routeSaved.error) throw routeSaved.error;
  if (!routeSaved.data) throw new Error('Os pontos foram alterados. Confira a rota antes de despachar.');

  const { data: existingOffers, error: existingError } = await db
    .from("freight_offers")
    .select("driver_id, status")
    .eq("order_id", order.id);
  if (existingError) throw new Error(existingError.message);
  if (existingOffers?.some((offer: any) => offer.status === "accepted")) {
    throw new Error("Esta rota já foi aceita por um motorista.");
  }

  // Persist the explicitly entered driver amount before offers are generated.
  // The commercial fields are never part of this update.
  const amountSaved = await db.from('orders').update({ driver_amount: driverAmount })
    .eq('id', order.id).is('driver_id', null).in('status', ['planning', 'created', 'preparing', 'awaiting_driver']).select('id').maybeSingle();
  if (amountSaved.error) throw amountSaved.error;
  if (!amountSaved.data) throw new Error('Este frete foi alterado. Atualize antes de despachar.');

  return { order, driverAmount };
}

async function markAwaitingDriver(db: any, order: any) {
  const { error: statusError } = await db
    .from("orders")
    .update({ status: "awaiting_driver" })
    .eq("id", order.id)
    .is("driver_id", null);
  if (statusError) throw new Error(statusError.message);
}

/** Lista motoristas aprovados e elegíveis para a seleção manual de despacho. */
export const listDispatchableDrivers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureStaff(context);
    const { data, error } = await context.supabase
      .from("drivers")
      .select("user_id,full_name,phone,photo_url,availability,approval_status,deleted_at,vehicles:current_vehicle_id(plate,model,vehicle_type,capacity_kg)")
      .eq("approval_status", "active")
      .is("deleted_at", null)
      .order("full_name", { ascending: true });
    if (error) throw new Error(error.message);
    const drivers: DispatchDriver[] = (data ?? [])
      .filter((row: any) => !!row.user_id && canReceiveOffer(row.approval_status, row.deleted_at))
      .map((row: any) => ({
        user_id: row.user_id as string,
        full_name: row.full_name ?? null,
        phone: row.phone ?? null,
        photo_url: row.photo_url ?? null,
        availability: row.availability ?? null,
        vehicle_plate: row.vehicles?.plate ?? null,
        vehicle_model: row.vehicles?.model ?? null,
        vehicle_type: row.vehicles?.vehicle_type ?? null,
        vehicle_capacity_kg: row.vehicles?.capacity_kg ?? null,
      }));
    return drivers;
  });

/** Despacho automático: envia a oferta a todos os motoristas aprovados. */
export const dispatchOrderToEligibleDrivers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof schema>) => schema.parse(input))
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin;

    const { order, driverAmount } = await prepareOrderForDispatch(context, db, data.order_id, data.price);

    // Only approved registrations; do not add unrelated financial/vehicle restrictions.
    const { data: drivers, error: driversError } = await db
      .from("drivers")
      .select("user_id,approval_status,deleted_at").eq('approval_status', 'active').is('deleted_at', null);
    if (driversError) throw new Error(driversError.message);

    const eligible = (drivers ?? []).filter((driver: any) => !!driver.user_id && canReceiveOffer(driver.approval_status, driver.deleted_at));

    if (!eligible.length) return { count: 0, driverIds: [] as string[] };

    const driverIds = eligible.map((driver: any) => driver.user_id as string);
    const expiresAt = new Date(Date.now() + data.minutes * 60_000).toISOString();
    const rows = driverIds.map((driver_id) => ({
      order_id: order.id,
      driver_id,
      offered_price: driverAmount,
      expires_at: expiresAt,
      status: "pending" as const,
    }));

    const { error: offersError } = await db
      .from("freight_offers")
      .upsert(rows, { onConflict: "order_id,driver_id" });
    if (offersError) throw new Error(offersError.message);

    await markAwaitingDriver(db, order);

    const { error: eventError } = await db.from("order_events").insert({
      order_id: order.id,
      event_type: "offers_sent",
      from_status: order.status,
      to_status: "awaiting_driver",
      actor_id: context.userId,
      payload: { modality: "automatic", drivers: driverIds.length, price: data.price, expires_in_min: data.minutes },
    });
    if (eventError) throw new Error(eventError.message);

    return { count: driverIds.length, driverIds };
  });

/**
 * Despacho manual: envia a oferta exclusivamente ao motorista selecionado.
 * Ofertas pendentes de outros motoristas para o mesmo frete são canceladas,
 * garantindo que somente o escolhido possa aceitar.
 */
export const dispatchOrderToDriver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof manualSchema>) => manualSchema.parse(input))
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin;

    const { order, driverAmount } = await prepareOrderForDispatch(context, db, data.order_id, data.price);

    const { data: driver, error: driverError } = await db
      .from("drivers")
      .select("user_id,full_name,approval_status,deleted_at")
      .eq("user_id", data.driver_id)
      .maybeSingle();
    if (driverError) throw new Error(driverError.message);
    if (!driver || !canReceiveOffer(driver.approval_status, driver.deleted_at)) {
      throw new Error("Motorista não encontrado ou não aprovado para receber ofertas.");
    }

    // Somente o motorista selecionado pode aceitar: cancela pendências de outros.
    const { error: cancelError } = await db
      .from("freight_offers")
      .update({ status: "cancelled" })
      .eq("order_id", order.id)
      .eq("status", "pending")
      .neq("driver_id", data.driver_id);
    if (cancelError) throw new Error(cancelError.message);

    const expiresAt = new Date(Date.now() + data.minutes * 60_000).toISOString();
    const { error: offerError } = await db
      .from("freight_offers")
      .upsert(
        { order_id: order.id, driver_id: data.driver_id, offered_price: driverAmount, expires_at: expiresAt, status: "pending" as const },
        { onConflict: "order_id,driver_id" },
      );
    if (offerError) throw new Error(offerError.message);

    await markAwaitingDriver(db, order);

    const { error: eventError } = await db.from("order_events").insert({
      order_id: order.id,
      event_type: "offers_sent",
      from_status: order.status,
      to_status: "awaiting_driver",
      actor_id: context.userId,
      payload: {
        modality: "manual",
        drivers: 1,
        driver_id: data.driver_id,
        driver_name: driver.full_name ?? null,
        price: data.price,
        expires_in_min: data.minutes,
      },
    });
    if (eventError) throw new Error(eventError.message);

    return { count: 1, driverIds: [data.driver_id] };
  });

/**
 * Resumo do último despacho para acompanhamento operacional: modalidade,
 * motoristas notificados, motorista selecionado (manual), status das ofertas
 * e prazo restante.
 */
export const getDispatchStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { order_id: string }) => z.object({ order_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const { data: event } = await context.supabase
      .from("order_events")
      .select("created_at,payload")
      .eq("order_id", data.order_id)
      .eq("event_type", "offers_sent")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: offers, error: offersError } = await context.supabase
      .from("freight_offers")
      .select("driver_id,status,offered_price,expires_at,created_at")
      .eq("order_id", data.order_id);
    if (offersError) throw new Error(offersError.message);

    const driverIds = [...new Set((offers ?? []).map((offer: any) => offer.driver_id as string))];
    const names = new Map<string, string>();
    if (driverIds.length) {
      const { data: drivers } = await context.supabase
        .from("drivers")
        .select("user_id,full_name")
        .in("user_id", driverIds);
      for (const driver of drivers ?? []) {
        if (driver.user_id) names.set(driver.user_id, driver.full_name ?? "Motorista");
      }
    }

    const payload = (event?.payload ?? {}) as Record<string, unknown>;
    return {
      modality: (payload.modality as "automatic" | "manual" | undefined) ?? null,
      sentAt: event?.created_at ?? null,
      selectedDriverId: (payload.driver_id as string | undefined) ?? null,
      selectedDriverName: (payload.driver_name as string | undefined) ?? null,
      notified: typeof payload.drivers === "number" ? payload.drivers : driverIds.length,
      offers: (offers ?? []).map((offer: any) => ({
        driver_id: offer.driver_id as string,
        driver_name: names.get(offer.driver_id) ?? "Motorista",
        status: offer.status as string,
        offered_price: offer.offered_price as number,
        expires_at: offer.expires_at as string | null,
        created_at: offer.created_at as string,
      })),
    };
  });
