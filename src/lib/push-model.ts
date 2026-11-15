import { z } from "zod";

export const pushPreferencesSchema = z.object({
  offers: z.boolean().default(true), routes: z.boolean().default(true),
  deliveries: z.boolean().default(true), chat: z.boolean().default(true), incidents: z.boolean().default(true),
  registrations: z.boolean().default(true), finance: z.boolean().default(true),
});
export type PushPreferences = z.infer<typeof pushPreferencesSchema>;
export const defaultPushPreferences = pushPreferencesSchema.parse({});

export function trustedPushEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port &&
      ["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com", "notify.windows.com"]
        .some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch { return false; }
}
export const pushEndpointSchema = z.string().max(4096).url().refine(trustedPushEndpoint, "Serviço de push não reconhecido.");
export const subscriptionSchema = z.object({
  endpoint: pushEndpointSchema,
  p256dh: z.string().min(80).max(120).regex(/^[A-Za-z0-9_-]+$/),
  auth: z.string().min(20).max(32).regex(/^[A-Za-z0-9_-]+$/),
  userAgent: z.string().max(300).optional(),
});
export function pushCategory(type: string): keyof PushPreferences {
  if (type.includes("chat") || type.includes("message")) return "chat";
  if (type.includes("incident")) return "incidents";
  if (type.includes("evidence") || type.includes("delivery") || type.includes("proof")) return "deliveries";
  if (type.includes("payment") || type.includes("financial")) return "finance";
  if (type.includes("registration") || type.includes("driver_approved") || type.includes("driver_rejected") || type.includes("driver_correction")) return "registrations";
  if (type.includes("offer") || type === "new_offer" || type.includes("freight_accepted")) return "offers";
  return "routes";
}
export function safePushContent(
  type: string,
  url: string,
  tag: string,
  details: { title?: string; body?: string; roomId?: string } = {},
) {
  const titles: Record<keyof PushPreferences, string> = {
    offers: "INFINITLOG | Novo frete disponível",
    routes: "INFINITLOG | Atualização do frete",
    deliveries: "INFINITLOG | Entrega e comprovante",
    chat: "INFINITLOG | Nova mensagem",
    incidents: "INFINITLOG | Ocorrência operacional",
    registrations: "INFINITLOG | Atualização de cadastro",
    finance: "INFINITLOG | Atualização financeira",
  };
  return {
    title: details.title ?? titles[pushCategory(type)],
    body: details.body ?? "Abra a InfinitLog para consultar com segurança.",
    url,
    tag,
    roomId: details.roomId,
    requireInteraction: pushCategory(type) === "incidents",
  };
}