import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Chave pública VAPID — necessária no navegador para criar a inscrição. */
export const getVapidPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  return { publicKey: process.env["VAPID_PUBLIC_KEY"] ?? null };
});

/** Registra (ou atualiza) o dispositivo atual do usuário autenticado. */
export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { endpoint: string; p256dh: string; auth: string; userAgent?: string }) => {
    if (!input?.endpoint?.startsWith("https://")) throw new Error("Endpoint inválido.");
    if (!input.p256dh || !input.auth) throw new Error("Chaves de criptografia ausentes.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("push_subscriptions").upsert(
      {
        user_id: context.userId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        user_agent: data.userAgent?.slice(0, 300) ?? null,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Remove o dispositivo (usuário desativou as notificações). */
export const removePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { endpoint: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", data.endpoint)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Notificação de teste para o próprio dispositivo do usuário. */
export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { pushToUsers } = await import("@/lib/push.server");
    return pushToUsers([context.userId], {
      title: "Notificações ativadas",
      body: "Você receberá alertas de ofertas e da operação por aqui.",
      url: "/app",
      tag: "test",
    });
  });

/**
 * Avisa os motoristas selecionados sobre uma nova oferta de frete.
 * Somente equipe/administração pode disparar.
 */
export const notifyDriversNewOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      driverIds: string[];
      orderCode: string;
      origin: string;
      destination: string;
      price: number;
    }) => {
      if (!Array.isArray(input?.driverIds) || input.driverIds.length === 0) {
        throw new Error("Nenhum motorista informado.");
      }
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { data: isStaff } = await context.supabase.rpc("is_staff", {
      _user_id: context.userId,
    });
    if (!isStaff) throw new Error("Forbidden");

    const { pushToUsers } = await import("@/lib/push.server");
    const valor = data.price?.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
    return pushToUsers(data.driverIds, {
      title: `🚚 Nova oferta de frete • ${valor}`,
      body: `${data.origin} → ${data.destination} (Pedido ${data.orderCode}). Toque para ver e aceitar.`,
      url: "/driver/ofertas",
      tag: `offer-${data.orderCode}`,
      requireInteraction: true,
    });
  });

/** Avisa o cliente e/ou a equipe sobre mudança de status de um frete. */
export const notifyOrderUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userIds: string[]; title: string; body: string; url?: string }) => input)
  .handler(async ({ data }) => {
    const { pushToUsers } = await import("@/lib/push.server");
    return pushToUsers(data.userIds, {
      title: data.title,
      body: data.body,
      url: data.url ?? "/app",
    });
  });
