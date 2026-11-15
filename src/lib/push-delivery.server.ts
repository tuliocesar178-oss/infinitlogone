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
  let pushTitle: string | undefined;
  let pushBody: string | undefined;
  let chatRoomId: string | undefined;
  if (notice.type === "push_test") authorized = true;
  else if (category === 'incidents' && typeof data.incident_id === 'string') {
    const incident = await db.from('incidents').select('reported_by,type,order_id').eq('id', data.incident_id).maybeSingle();
    if (incident.error) throw new Error('Falha ao conferir ocorrência.');
    authorized = Boolean(incident.data && (incidentManager || (driver && incident.data.reported_by === notice.user_id)));
    url = driver
      ? `/driver/ocorrencias?incidentId=${encodeURIComponent(data.incident_id)}`
      : `/ops/ocorrencias?incidentId=${encodeURIComponent(data.incident_id)}`;
    if (authorized) {
      const orderId = typeof incident.data?.order_id === "string" ? incident.data.order_id : null;
      const { data: order } = orderId
        ? await db.from("orders").select("code").eq("id", orderId).maybeSingle()
        : { data: null };
      pushTitle = notice.type === "driver_incident_update"
        ? "INFINITLOG | Atualização de ocorrência"
        : "INFINITLOG | Nova ocorrência";
      pushBody = order?.code
        ? `Frete ${order.code} — ocorrência registrada. Confira os detalhes.`
        : "Uma ocorrência foi registrada. Confira os detalhes no aplicativo.";
    }
  }
  else if (category === "chat" && roomId) {
    const { data: access, error: accessError } = await db.rpc("can_access_unified_chat", { _room: roomId, _user: notice.user_id });
    if (accessError) throw new Error("Falha ao verificar conversa.");
    authorized = access === true;
    url = `${driver ? "/driver/chat" : "/ops/chat"}?roomId=${encodeURIComponent(roomId)}`;
    chatRoomId = roomId;
    if (authorized) {
      const { data: message } = await db
        .from("messages")
        .select("sender_id,kind,content,created_at")
        .eq("room_id", roomId)
        .neq("sender_id", notice.user_id)
        .lte("created_at", notice.created_at)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (message) {
        const { data: sender } = await db.from("profiles").select("full_name").eq("id", message.sender_id).maybeSingle();
        const senderName = sender?.full_name || "Integrante da equipe";
        const preview = message.kind === "audio"
          ? `${senderName} enviou uma mensagem de voz.`
          : message.kind === "image" || message.kind === "photo"
            ? `${senderName} enviou uma foto.`
            : `${senderName}: ${(message.content || notice.body || "Nova mensagem").slice(0, 180)}`;
        pushTitle = "INFINITLOG | Nova mensagem";
        pushBody = preview;
      }
    }
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
      authorized = staff || order.driver_id === notice.user_id ||
        (category !== "incidents" && order.client_id === notice.user_id);
      if (notice.type === "new_offer") {
        // Recheck approval at delivery time; queued events may predate a block.
        const registration=await db.from('drivers').select('approval_status,deleted_at').eq('user_id',notice.user_id).maybeSingle();
        if(registration.error)throw new Error('Falha ao conferir aprovação.');
        let offerQuery = db.from("freight_offers").select("id,status,expires_at,offered_price").eq("order_id", orderId).eq("driver_id", notice.user_id);
        if (typeof data.offer_id === "string") offerQuery = offerQuery.eq("id", data.offer_id);
        const { data: offer } = await offerQuery.maybeSingle();
        authorized = driver && registration.data?.approval_status==='active' && !registration.data.deleted_at && !order.driver_id &&
          ["created", "preparing", "awaiting_driver", "negotiating"].includes(order.status) &&
          !!offer && ["pending", "negotiating"].includes(offer.status) && (!offer.expires_at || Date.parse(offer.expires_at) > Date.now());
        url = typeof offer?.id === "string" ? `/driver/ofertas/${offer.id}` : "/driver/ofertas";
        if (authorized) {
          const { data: details } = await db.from("orders")
            .select("code,origin_city,origin_state,destination_city,destination_state")
            .eq("id", orderId).maybeSingle();
          const origin = [details?.origin_city, details?.origin_state].filter(Boolean).join("/");
          const destination = [details?.destination_city, details?.destination_state].filter(Boolean).join("/");
          pushTitle = `INFINITLOG | Novo frete${details?.code ? ` ${details.code}` : ""}`;
          pushBody = `Nova oportunidade! ${origin || "Coleta"} → ${destination || "Entrega"}. Valor ao motorista: R$ ${Number(offer?.offered_price ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`;
        }
      } else {
        url = driver ? "/driver/fretes" : staff ? `/ops/pedidos/${orderId}` : "/client";
        if (authorized && notice.type === "evidence_uploaded") {
          pushTitle = "INFINITLOG | Comprovante disponível";
          pushBody = "Há um novo comprovante disponível para este frete.";
        } else if (authorized && notice.type === "route_cancelled") {
          pushTitle = "INFINITLOG | Frete cancelado";
          pushBody = "O frete foi cancelado. Abra o aplicativo para consultar os detalhes.";
        } else if (authorized && notice.type === "route_incident") {
          pushTitle = "INFINITLOG | Ocorrência no frete";
          pushBody = "Há uma ocorrência relacionada a este frete. Consulte os detalhes autorizados.";
        } else if (authorized) {
          pushTitle = "INFINITLOG | Atualização do frete";
          pushBody = "O status ou os detalhes do frete foram atualizados.";
        }
      }
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
  const result = await pushToUsers(
    [notice.user_id],
    safePushContent(notice.type, url, `notice-${notice.id}`, {
      title: pushTitle,
      body: pushBody,
      roomId: chatRoomId,
    }),
    { notificationId: notice.id, deviceIds },
  );
  await db.from("notifications").update({ push_status: result.failed ? "failed" : result.sent ? "accepted" : "skipped", push_error: result.failed ? "Serviço de push recusou o envio" : null, push_processed_at: new Date().toISOString() }).eq("id", notice.id);
  return result;
}