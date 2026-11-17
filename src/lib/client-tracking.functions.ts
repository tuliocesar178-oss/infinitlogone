import { COMMERCIAL_ORDER_EVENTS } from "@/lib/order-projections";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { getClientIdentityIds } from './client-identity.functions';
import { CLIENT_HISTORY_FILTER } from './client-history';

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
    const clientIds = await getClientIdentityIds();
    // This first query is subject to RLS, proving every returned order belongs
    // to the signed-in client before privileged, field-limited lookups occur.
    const { data: orders, error: ordersError } = await context.supabase
      .from("orders")
      .select(ORDER_COLUMNS as "*")
      .in("client_id", clientIds)
      .or(CLIENT_HISTORY_FILTER)
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

    const [profilesResult, driversResult, vehiclesResult, vehiclePhotosResult, evidenceResult] = await Promise.all([
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
      vehicleIds.length
        ? supabaseAdmin
            .from("vehicle_documents")
            .select("vehicle_id, file_path, label, mime_type")
            .in("vehicle_id", vehicleIds)
            .like("mime_type", "image/%")
        : Promise.resolve({ data: [], error: null }),
      context.supabase
        .from("order_attachments")
        .select("order_id, mime_type, kind")
        .in("order_id", orders.map((order) => order.id)),
    ]);

    if (profilesResult.error || driversResult.error || vehiclesResult.error || vehiclePhotosResult.error || evidenceResult.error) {
      throw new Error("Não foi possível carregar os dados operacionais do rastreamento.");
    }

    const profiles = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]));
    const drivers = new Map((driversResult.data ?? []).map((driver) => [driver.user_id, driver]));
    const vehicles = new Map((vehiclesResult.data ?? []).map((vehicle) => [vehicle.id, vehicle]));
    const evidenceByOrder = new Map<string, { photos: number; documents: number }>();
    for (const item of evidenceResult.data ?? []) {
      const summary = evidenceByOrder.get(item.order_id) ?? { photos: 0, documents: 0 };
      const isPhoto = item.mime_type?.startsWith("image/") && !["canhoto", "assinatura", "foto_nf"].includes(item.kind);
      if (isPhoto) summary.photos += 1;
      else summary.documents += 1;
      evidenceByOrder.set(item.order_id, summary);
    }
    const photoRows = await Promise.all((vehiclePhotosResult.data ?? []).map(async (photo) => {
      const { data } = await supabaseAdmin.storage.from("vehicle-files").createSignedUrl(photo.file_path, 60 * 60);
      return data?.signedUrl ? { vehicle_id: photo.vehicle_id, url: data.signedUrl, label: photo.label } : null;
    }));
    const photosByVehicle = new Map<string, Array<{ url: string; label: string | null }>>();
    photoRows.filter((photo): photo is NonNullable<typeof photo> => Boolean(photo)).forEach((photo) => {
      photosByVehicle.set(photo.vehicle_id, [...(photosByVehicle.get(photo.vehicle_id) ?? []), { url: photo.url, label: photo.label }]);
    });

    return orders.map((order) => {
      const profile = order.driver_id ? profiles.get(order.driver_id) : undefined;
      const driver = order.driver_id ? drivers.get(order.driver_id) : undefined;
      return {
        ...order,
        evidence_summary: evidenceByOrder.get(order.id) ?? { photos: 0, documents: 0 },
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
        vehicle: (() => {
          if (!order.vehicle_id) return null;
          const vehicle = vehicles.get(order.vehicle_id);
          if (!vehicle) return null;
          return {
            ...vehicle,
            photos: [
              ...(vehicle.photo_url ? [{ url: vehicle.photo_url, label: "Foto principal" }] : []),
              ...(photosByVehicle.get(order.vehicle_id) ?? []),
            ],
          };
        })(),
      };
    });
  });

const evidenceInput = z.object({ orderId: z.string().uuid().optional() });

export const getClientOrderEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof evidenceInput>) => evidenceInput.parse(input))
  .handler(async ({ data, context }) => {
    const clientIds = await getClientIdentityIds();
    let ordersQuery = context.supabase
      .from("orders")
      .select("id, code, status, created_at")
      .in("client_id", clientIds)
      .or(CLIENT_HISTORY_FILTER)
      .order("created_at", { ascending: false });

    if (data.orderId) ordersQuery = ordersQuery.eq("id", data.orderId);

    const { data: orders, error: ordersError } = await ordersQuery;
    if (ordersError) throw ordersError;
    if (!orders?.length) return { orders: [], events: [], evidence: [] };

    const orderIds = orders.map((order) => order.id);
    const [eventsResult, attachmentsResult] = await Promise.all([
      context.supabase
        .from(COMMERCIAL_ORDER_EVENTS)
        .select("id, order_id, event_type, from_status, to_status, payload, actor_id, created_at")
        .in("order_id", orderIds)
        .order("created_at", { ascending: true }),
      context.supabase
        .from("order_attachments")
        .select("id, order_id, event_id, event_status, kind, label, file_path, mime_type, size_bytes, uploaded_by, latitude, longitude, metadata, created_at")
        .in("order_id", orderIds)
        .order("created_at", { ascending: true }),
    ]);

    if (eventsResult.error) throw eventsResult.error;
    if (attachmentsResult.error) throw attachmentsResult.error;

    const attachments = attachmentsResult.data ?? [];
    const actorIds = Array.from(new Set(attachments.map((item) => item.uploaded_by).filter((id): id is string => Boolean(id))));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [profilesResult, signedResult] = await Promise.all([
      actorIds.length
        ? supabaseAdmin.from("profiles").select("id, full_name").in("id", actorIds)
        : Promise.resolve({ data: [], error: null }),
      attachments.length
        ? supabaseAdmin.storage.from("order-files").createSignedUrls(attachments.map((item) => item.file_path), 60 * 60)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (profilesResult.error || signedResult.error) {
      throw new Error("Não foi possível preparar os comprovantes para visualização.");
    }

    const profileNames = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile.full_name]));
    const signedByPath = new Map((signedResult.data ?? []).map((item) => [item.path, item.signedUrl]));

    return {
      orders,
      events: eventsResult.data ?? [],
      evidence: attachments.map((item) => ({
        id: item.id,
        order_id: item.order_id,
        event_id: item.event_id,
        event_status: item.event_status,
        kind: item.kind,
        label: item.label,
        mime_type: item.mime_type,
        size_bytes: item.size_bytes,
        created_at: item.created_at,
        latitude: item.latitude,
        longitude: item.longitude,
        uploader_name: item.uploaded_by ? profileNames.get(item.uploaded_by) ?? "Motorista" : "Equipe InfinitLog",
        url: signedByPath.get(item.file_path) ?? null,
      })),
    };
  });