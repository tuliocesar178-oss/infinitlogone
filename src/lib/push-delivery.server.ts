import { pushCategory, pushPreferencesSchema, safePushContent } from "@/lib/push-model";
import { summarizePushDeliveries } from '@/lib/push-result';

/** Re-evaluate recipient permissions using current rows, never browser lists. */
export async function deliverNotification(notificationId: string) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data: notice, error } = await db.from("notifications").select("*").eq("id", notificationId).maybeSingle();
  if (error) throw new Error("Falha ao consultar aviso.");
  if (!notice) return { sent: 0, failed: 0, pending: 0 };
  if (["accepted", "skipped"].includes(notice.push_status)) {
    const previous = await db.from('push_deliveries').select('status').eq('notification_id', notice.id);
    if (previous.error) throw new Error('Falha ao consultar resultado do envio.');
    return summarizePushDeliveries(previous.data ?? []);
  }
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
      const incidentOrderId = typeof incident.data?.order_id === "string" ? incident.data.order_id : null;
      const { data: order } = incidentOrderId
        ? await db.from("orders").select("code").eq("id", incidentOrderId).maybeSingle()
        : { data: null };
      const { data: reporter } = notice.type === "driver_incident_created" && incident.data?.reported_by
        ? await db.from("profiles").select("full_name").eq("id", incident.data.reported_by).maybeSingle()
        : { data: null };
      const incidentLabel = String(incident.data?.type ?? "ocorrência").replace(/[_-]+/g, " ");
      if (notice.type === "driver_incident_update") {
        pushTitle = "INFINITLOG | Atualização de ocorrência";
        pushBody = order?.code
          ? `A ocorrência do frete ${order.code} foi atualizada pela equipe operacional.`
          : "A ocorrência foi atualizada pela equipe operacional.";
      } else if (notice.type === "driver_incident_created") {
        pushTitle = "INFINITLOG | Ocorrência registrada";
        pushBody = `${reporter?.full_name || "Motorista"} informou um problema${order?.code ? ` durante o frete ${order.code}` : ""}.`;
      } else {
        pushTitle = notice.type === "critical_incident"
          ? "INFINITLOG | Ocorrência crítica"
          : "INFINITLOG | Nova ocorrência";
        pushBody = order?.code
          ? `Frete ${order.code} — ${incidentLabel}. Verifique os detalhes.`
          : `Uma ocorrência foi registrada: ${incidentLabel}. Confira os detalhes.`;
      }
    }
  }
  else if (category === "chat" && roomId) {
    const { data: access, error: accessError } = await db.rpc("can_access_unified_chat", { _room: roomId, _user: notice.user_id });
    if (accessError) throw new Error("Falha ao verificar conversa.");
    authorized = access === true;
    const chatPath = driver ? "/driver/chat" : staff ? "/ops/chat" : "/client";
    url = `${chatPath}?roomId=${encodeURIComponent(roomId)}`;
    chatRoomId = roomId;
    if (authorized) {
      const { data: message } = await db
        .from("messages")
        .select("id,sender_id,kind,content,created_at")
        .eq("room_id", roomId)
        .lte("created_at", notice.created_at)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!message || message.sender_id === notice.user_id) {
        authorized = false;
      } else {
        const [{ data: sender }, { data: room }] = await Promise.all([
          db.from("profiles").select("full_name").eq("id", message.sender_id).maybeSingle(),
          db.from("chat_rooms").select("order_id,driver_id,staff_a,staff_b").eq("id", roomId).maybeSingle(),
        ]);
        const senderName = sender?.full_name || "Integrante da equipe";
        const text = (message.content || notice.body || "Nova mensagem").slice(0, 180);
        const groupName = typeof data.group_name === "string"
          ? data.group_name
          : typeof data.conversation_name === "string" ? data.conversation_name : null;
        const isGroup = Boolean(groupName || data.is_group === true || (
          room && !room.order_id && !room.driver_id && !room.staff_a && !room.staff_b
        ));
        const preview = message.kind === "audio"
          ? `${senderName} enviou uma mensagem de voz.`
          : message.kind === "photo"
            ? `${senderName} enviou uma foto.`
            : `${senderName}: ${text}`;
        pushTitle = isGroup
          ? `INFINITLOG | ${groupName || "Grupo Operacional"}`
          : message.kind === "audio"
            ? "INFINITLOG | Novo áudio"
            : message.kind === "photo"
              ? "INFINITLOG | Nova imagem"
              : "INFINITLOG | Nova mensagem";
        pushBody = isGroup && (message.kind === "audio" || message.kind === "photo")
          ? `${senderName}: ${preview.slice(senderName.length + 1)}`
          : preview;
        url = `${chatPath}?roomId=${encodeURIComponent(roomId)}&messageId=${encodeURIComponent(message.id)}`;
        await import("@/lib/push-model").then(({ safePushContent }) => {
          const timestamp = Date.parse(message.created_at);
          if (Number.isFinite(timestamp)) {
            pushTitle = pushTitle;
          }
        });
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
    const { data: order, error: orderError } = await db.from("orders").select("driver_id,client_id,deleted_at,status,vehicle_id,required_vehicle_type,required_body_type,required_capacity_kg,required_axles,code,pickup_window_start,delivery_window_end").eq("id", orderId).maybeSingle();
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
            .select("code,origin_city,origin_state,destination_city,destination_state,pickup_window_start,required_vehicle_type,required_body_type,required_capacity_kg,required_axles,cargo_weight_kg,volumes")
            .eq("id", orderId).maybeSingle();
          const origin = [details?.origin_city, details?.origin_state].filter(Boolean).join("/");
          const destination = [details?.destination_city, details?.destination_state].filter(Boolean).join("/");
          const pickup = details?.pickup_window_start
            ? new Date(details.pickup_window_start).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
            : null;
          const vehicle = [details?.required_vehicle_type, details?.required_body_type].filter(Boolean).join(" / ");
          const requirements = [
            pickup ? `Coleta: ${pickup}` : null,
            vehicle ? `Veículo: ${vehicle}` : null,
            details?.cargo_weight_kg ? `Peso: ${details.cargo_weight_kg} kg` : null,
            details?.volumes ? `Volumes: ${details.volumes}` : null,
          ].filter(Boolean).join(" · ");
          pushTitle = `INFINITLOG | Novo frete${details?.code ? ` ${details.code}` : " disponível"}`;
          pushBody = `Nova oportunidade! ${origin || "Coleta"} → ${destination || "Entrega"}. ${requirements ? `${requirements}. ` : ""}Valor ao motorista: R$ ${Number(offer?.offered_price ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`;
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
        } else if (authorized && notice.type === "freight_accepted") {
          pushTitle = "INFINITLOG | Frete aceito";
          pushBody = `Um motorista aceitou o frete ${order.code || ""}.`.trim();
        } else if (authorized && notice.type === "route_update") {
          const statusMessages: Record<string, { title: string; body: string }> = {
            en_route_pickup: { title: "Coleta iniciada", body: "O motorista iniciou o deslocamento para a coleta." },
            in_transit_to_pickup: { title: "Coleta iniciada", body: "O motorista está a caminho do local de coleta." },
            picked_up: { title: "Carga coletada", body: "A carga foi coletada e o frete segue em andamento." },
            loaded: { title: "Carga coletada", body: "A carga foi coletada e o frete segue em andamento." },
            out_for_delivery: { title: "Saiu para entrega", body: "O frete saiu para a etapa de entrega." },
            near_destination: { title: "Motorista próximo ao destino", body: "O motorista está próximo ao local de entrega." },
            arriving_destination: { title: "Motorista próximo ao destino", body: "O motorista está chegando ao local de entrega." },
            delivered: { title: "Entrega concluída", body: "A entrega do frete foi concluída." },
            finalized: { title: "Entrega concluída", body: "A entrega do frete foi concluída." },
          };
          const statusMessage = statusMessages[order.status];
          pushTitle = `INFINITLOG | ${statusMessage?.title || "Atualização do frete"}`;
          pushBody = statusMessage
            ? `${statusMessage.body}${order.code ? ` Frete ${order.code}.` : ""}`
            : "O status ou os detalhes do frete foram atualizados.";
        } else if (authorized) {
          pushTitle = "INFINITLOG | Atualização do frete";
          pushBody = "O status ou os detalhes do frete foram atualizados.";
        }
      }
    }
  }
  if (!authorized) {
    await db.from("notifications").update({ push_status: "skipped", push_error: "Destinatário sem acesso atual", push_processed_at: new Date().toISOString() }).eq("id", notice.id);
    return { sent: 0, failed: 0, pending: 0 };
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
      messageId: typeof data.message_id === "string" ? data.message_id : undefined,
      timestamp: Date.parse(notice.created_at),
    }),
    { notificationId: notice.id, deviceIds },
  );
  // A zero-send attempt can mean the webhook already claimed this event.
  // Read durable claims rather than replacing its accepted status with skipped.
  const persisted = await db.from('push_deliveries').select('status').eq('notification_id', notice.id);
  if (persisted.error) throw new Error('Falha ao consultar resultado do envio.');
  const summary = summarizePushDeliveries(persisted.data ?? []);
  const outcome = persisted.data?.length ? summary : { ...result, pending: 0, status: result.failed ? 'failed' : result.sent ? 'accepted' : 'skipped' };
  if (!outcome.pending) {
    await db.from('notifications').update({ push_status: outcome.status, push_error: outcome.failed ? 'Serviço de push recusou o envio' : null, push_processed_at: new Date().toISOString() }).eq('id', notice.id).neq('push_status', 'accepted');
  }
  return outcome;
}