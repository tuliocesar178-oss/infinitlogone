import {
  getVapidPublicKey,
  removePushSubscription,
  savePushSubscription,
  sendTestPush,
} from "@/lib/push.functions";

/** Converte a chave VAPID (base64url) para o formato exigido pelo PushManager. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

/** Converte as chaves da inscrição para base64url (formato de armazenamento). */
function bufferToBase64Url(buffer: ArrayBuffer | null): string {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return window
    .btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** O dispositivo suporta Web Push? (iOS exige o app instalado na tela inicial) */
export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** Estado atual: permissão do navegador e se há inscrição ativa. */
export async function pushStatus(): Promise<{
  supported: boolean;
  permission: NotificationPermission | "unsupported";
  subscribed: boolean;
}> {
  if (!pushSupported()) {
    return { supported: false, permission: "unsupported", subscribed: false };
  }
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  return {
    supported: true,
    permission: Notification.permission,
    subscribed: !!subscription,
  };
}

/**
 * Ativa as notificações push para o usuário logado neste dispositivo.
 * Pede permissão, cria a inscrição no navegador e a registra no servidor.
 */
export async function enablePush(): Promise<
  { ok: true } | { ok: false; reason: string }
> {
  if (!pushSupported()) {
    return {
      ok: false,
      reason:
        "Este dispositivo não suporta notificações. No iPhone, instale o app na tela de início primeiro.",
    };
  }

  const permission =
    Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, reason: "Permissão de notificação negada no dispositivo." };
  }

  const registration = await navigator.serviceWorker.ready;
  const { publicKey } = await getVapidPublicKey();
  if (!publicKey) return { ok: false, reason: "Servidor sem chave de notificação configurada." };

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });
  }

  await savePushSubscription({
    data: {
      endpoint: subscription.endpoint,
      p256dh: bufferToBase64Url(subscription.getKey("p256dh")),
      auth: bufferToBase64Url(subscription.getKey("auth")),
      userAgent: navigator.userAgent,
    },
  });

  return { ok: true };
}

/** Desativa as notificações neste dispositivo. */
export async function disablePush(): Promise<void> {
  if (!pushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  await removePushSubscription({ data: { endpoint: subscription.endpoint } });
  await subscription.unsubscribe();
}

/** Dispara uma notificação de teste para o próprio usuário. */
export async function testPush() {
  return sendTestPush({ data: undefined });
}
