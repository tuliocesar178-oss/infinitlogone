import { pushCategory, pushPreferencesSchema, safePushContent } from "@/lib/push-model";

/** Re-evaluate recipient permissions using current rows, never browser lists. */
export async function deliverNotification(notificationId: string) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data: notice, error } = await db.from("notifications").select("*").eq("id", notificationId).maybeSingle();
  if (error) throw new Error("Falha ao consultar aviso.");
  if (!notice || ["accepted", "skipped"].includes(notice.push_status)) return { sent: 0, failed: 0 };
  const { data: roles, error: roleError } = await db.from("user_roles").select("role").eq("user_id", notice.user_id);
  if (roleError) throw new Error("Falha ao verificar permissões.");
  const roleNames = (roles ?? []).map((row) => row.role);
  const staff = roleNames.some((role) => ["admin", "logistics"].includes(role));
  const finance = roleNames.some((role) => ["admin", "financeiro"].includes(role));
  const admin = roleNames.includes("admin");
  const driver = roleNames.includes("driver");
  const incidentManager = roleNames.some(role => ['admin', 'logistics', 'supervisor', 'operacional'].includes(role));
  const data = notice.data && typeof notice.data === "object" && !Array.isArray(notice.data) ? notice.data : {};
  const orderId = typeof data.order_id === "string" ? data.order_id : null;
  const roomId = typeof data.room_id === "string" ? data.room_id : null;
  const category = pushCategory(notice.type);
  let authorized = false;
  let url = driver ? "/driver" : staff ? "/ops/central" : finance ? "/ops/financeiro" : "/client";
  if (notice.type === "push_test") authorized = true;
  else if (category === 'incidents' && typeof data.incident_id === 'string') {
    const incident = await db.from('incidents').select('reported_by').eq('id', data.incident_id).maybeSingle();
    if (incident.error) throw new Error('Falha ao conferir ocorrência.');
    authorized = Boolean(incident.data && (incidentManager || (driver && incident.data.reported_by === notice.user_id)));
    url = driver ? '/driver/ocorrencias' : '/ops/ocorrencias';
  }
  else if (category === "chat" && roomId) {
    const { data: access, error: accessError } = await db.rpc("can_access_unified_chat", { _room: roomId, _user: notice.user_id });
    if (accessError) throw new Error("Falha ao verificar conversa.");
    authorized = access === true;
    url = driver ? "/driver/chat" : "/ops/chat";
  } else if (category === "registrations") {
    authorized = notice.type === "driver_registration" ? admin : ["driver_approved", "driver_rejected", "driver_correction"].includes(notice.type);
    url = admin ? "/ops/motoristas/aprovacoes" : "/app";
  } else if (category === "finance") {
    authorized = finance;
    const paymentId = typeof data.payment_id === "string" ? data.payment_id : null;
    if (driver && paymentId) {
      const { data: payment } = await db.from("driver_payments").select("driver_id").eq("id", paymentId).maybeSingle();
      authorized = payment?.driver_id === notice.user_id;
    }
    url = driver ? "/driver/faturamento" : "/ops/financeiro";
  } else if (orderId) {
    const { data: order, error: orderError } = await db.from("orders").select("driver_id,client_id,deleted_at,status,vehicle_id,required_vehicle_type,required_body_type,required_capacity_kg,required_axles").eq("id", orderId).maybeSingle();
    if (orderError) throw new Error("Falha ao verificar frete.");
    if (order && !order.deleted_at) {
      authorized = staff || order.driver_id === notice.user_id || order.client_id === notice.user_id;
      if (notice.type === "new_offer") {
        const { data: profile } = await db.from("drivers").select("approval_status,financial_status,availability,current_vehicle_id").eq("user_id", notice.user_id).maybeSingle();
        const { data: offer } = await db.from("freight_offers").select("status,expires_at").eq("order_id", orderId).eq("driver_id", notice.user_id).maybeSingle();
        authorized = driver && profile?.approval_status === "active" && profile.financial_status === "ativo" &&
          ["disponivel", "offline"].includes(profile.availability) && !order.driver_id &&
          ["created", "preparing", "awaiting_driver", "negotiating"].includes(order.status) &&
          !!offer && ["pending", "negotiating"].includes(offer.status) && (!offer.expires_at || Date.parse(offer.expires_at) > Date.now());
        if (authorized && (order.vehicle_id || order.required_vehicle_type || order.required_body_type || order.required_capacity_kg != null || order.required_axles != null)) {
          const { data: vehicle } = await db.from("vehicles").select("id,active,owner_driver_id,vehicle_type,category,body_type,max_weight_kg,capacity_kg,axles").eq("id", profile?.current_vehicle_id ?? "00000000-0000-0000-0000-000000000000").maybeSingle();
          const normalize = (value: string | null) => (value ?? "").trim().toLocaleLowerCase("pt-BR");
          authorized = !!vehicle && vehicle.active && vehicle.owner_driver_id === notice.user_id &&
            (!order.vehicle_id || order.vehicle_id === vehicle.id) &&
            (!order.required_vehicle_type || normalize(`${vehicle.vehicle_type ?? ""} ${vehicle.category ?? ""}`).includes(normalize(order.required_vehicle_type))) &&
            (!order.required_body_type || normalize(vehicle.body_type).includes(normalize(order.required_body_type))) &&
            (order.required_capacity_kg == null || Number(vehicle.max_weight_kg ?? vehicle.capacity_kg ?? 0) >= Number(order.required_capacity_kg)) &&
            (order.required_axles == null || vehicle.axles === order.required_axles);
        }
        url = "/driver/ofertas";
      } else url = driver ? "/driver/fretes" : staff ? `/ops/pedidos/${orderId}` : "/client";
    }
  }
  if (!authorized) {
    await db.from("notifications").update({ push_status: "skipped", push_error: "Destinatário sem acesso atual", push_processed_at: new Date().toISOString() }).eq("id", notice.id);
    return { sent: 0, failed: 0 };
  }
  const { data: devices, error: deviceError } = await db.from("push_subscriptions").select("id,preferences").eq("user_id", notice.user_id);
  if (deviceError) throw new Error("Falha ao consultar dispositivos.");
  const deviceIds = (devices ?? []).filter((device) => {
    const preferences = pushPreferencesSchema.safeParse(device.preferences);
    return notice.type === "push_test" || (preferences.success && preferences.data[category]);
  }).filter((device) => notice.type !== "push_test" || device.id === data.device_id).map((device) => device.id);
  const { pushToUsers } = await import("@/lib/push.server");
  const result = await pushToUsers([notice.user_id], safePushContent(notice.type, url, `notice-${notice.id}`), { notificationId: notice.id, deviceIds });
  await db.from("notifications").update({ push_status: result.failed ? "failed" : result.sent ? "accepted" : "skipped", push_error: result.failed ? "Serviço de push recusou o envio" : null, push_processed_at: new Date().toISOString() }).eq("id", notice.id);
  return result;
}