import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { subscriptionSchema, pushEndpointSchema, pushPreferencesSchema } from "@/lib/push-model";

export const getVapidPublicKey = createServerFn({ method: "GET" }).handler(async () => ({ publicKey: process.env["VAPID_PUBLIC_KEY"] ?? null }));

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof subscriptionSchema>) => subscriptionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("push_subscriptions").upsert({ user_id: context.userId, endpoint: data.endpoint, p256dh: data.p256dh, auth: data.auth, user_agent: data.userAgent ?? null, last_used_at: new Date().toISOString() }, { onConflict: "endpoint" });
    if (error) throw new Error("Não foi possível registrar este dispositivo. Desative e ative novamente.");
    return { ok: true };
  });
export const removePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { endpoint: string }) => z.object({ endpoint: pushEndpointSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("push_subscriptions").delete().eq("endpoint", data.endpoint).eq("user_id", context.userId);
    if (error) throw new Error("Falha ao remover dispositivo.");
    return { ok: true };
  });
export const getDevicePushSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { endpoint: string }) => z.object({ endpoint: pushEndpointSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from("push_subscriptions").select("id,preferences").eq("endpoint", data.endpoint).eq("user_id", context.userId).maybeSingle();
    if (error) throw new Error("Falha ao consultar dispositivo.");
    return { registered: !!row, preferences: pushPreferencesSchema.parse(row?.preferences ?? {}) };
  });
export const saveDevicePushSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { endpoint: string; preferences: z.infer<typeof pushPreferencesSchema> }) => z.object({ endpoint: pushEndpointSchema, preferences: pushPreferencesSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from("push_subscriptions").update({ preferences: data.preferences }).eq("endpoint", data.endpoint).eq("user_id", context.userId).select("id").maybeSingle();
    if (error || !row) throw new Error("Dispositivo não registrado.");
    return { ok: true };
  });
/** Creates a persisted, authorized test event; no free recipient or content input. */
export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { endpoint: string }) => z.object({ endpoint: pushEndpointSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: device, error: deviceError } = await context.supabase.from("push_subscriptions").select("id").eq("endpoint", data.endpoint).eq("user_id", context.userId).maybeSingle();
    if (deviceError || !device) throw new Error("Ative as notificações neste dispositivo primeiro.");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: notice, error } = await db.from("notifications").insert({ user_id: context.userId, type: "push_test", title: "Teste de notificações", body: "Teste solicitado neste dispositivo.", data: { device_id: device.id } }).select("id").single();
    if (error) throw new Error("Falha ao criar teste.");
    const { deliverNotification } = await import("@/lib/push-delivery.server");
    return deliverNotification(notice.id);
  });
/** Admin setup installs an event-driven transport; secret is never returned. */
export const configurePushTransport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: allowed } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!allowed) throw new Error("Apenas administradores podem configurar o envio.");
    const bearer = process.env["PUSH_WEBHOOK_SECRET"];
    if (!bearer) throw new Error("Chave de transporte não configurada.");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { error } = await db.from("push_transport_config").upsert({ key: "web_push", endpoint: "https://infinitlogone.lovable.app/api/public/push-delivery", bearer, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) throw new Error("Falha ao configurar envio automático.");
    return { ok: true };
  });
