import { buildPushPayload } from "@block65/webcrypto-web-push";

/** Conteúdo entregue ao dispositivo do usuário. */
export type PushContent = {
  title: string;
  body: string;
  /** Rota interna aberta ao tocar na notificação. */
  url?: string;
  /** Agrupa notificações do mesmo assunto (ex.: `offer-<id>`). */
  tag?: string;
  /** Mantém o alerta na tela até o usuário interagir (usado em ofertas). */
  requireInteraction?: boolean;
};

type Row = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

/** Chaves VAPID lidas apenas em tempo de execução no servidor. */
function vapid() {
  const subject = process.env["VAPID_SUBJECT"];
  const publicKey = process.env["VAPID_PUBLIC_KEY"];
  const privateKey = process.env["VAPID_PRIVATE_KEY"];
  if (!subject || !publicKey || !privateKey) {
    throw new Error("Chaves VAPID não configuradas no servidor.");
  }
  return { subject, publicKey, privateKey };
}

/**
 * Envia uma notificação push para todos os dispositivos dos usuários
 * informados. Inscrições expiradas (404/410) são removidas automaticamente
 * para não acumular lixo na base.
 *
 * @returns quantidade de dispositivos que aceitaram a mensagem
 */
export async function pushToUsers(
  userIds: string[],
  content: PushContent,
): Promise<{ sent: number; failed: number }> {
  const targets = Array.from(new Set(userIds.filter(Boolean)));
  if (targets.length === 0) return { sent: 0, failed: 0 };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", targets);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Row[];
  if (rows.length === 0) return { sent: 0, failed: 0 };

  const keys = vapid();
  const message = {
    data: JSON.stringify(content),
    options: { ttl: 60 * 60 }, // relevante por 1h
  };

  let sent = 0;
  let failed = 0;
  const expired: string[] = [];

  await Promise.all(
    rows.map(async (row) => {
      try {
        const payload = await buildPushPayload(
          message,
          {
            endpoint: row.endpoint,
            expirationTime: null,
            keys: { p256dh: row.p256dh, auth: row.auth },
          },
          keys,
        );
        // O payload traz corpo binário (Uint8Array); o runtime aceita, os tipos do DOM não.
        const res = await fetch(row.endpoint, payload as unknown as RequestInit);
        if (res.ok) {
          sent += 1;
          return;
        }
        failed += 1;
        if (res.status === 404 || res.status === 410) expired.push(row.id);
        else console.error(`[Push] ${res.status} em ${row.endpoint}: ${await res.text()}`);
      } catch (err) {
        failed += 1;
        console.error("[Push] falha ao enviar", err);
      }
    }),
  );

  if (expired.length > 0) {
    await supabaseAdmin.from("push_subscriptions").delete().in("id", expired);
  }

  return { sent, failed };
}
