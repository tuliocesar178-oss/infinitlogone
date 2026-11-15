import { defaultPushPreferences, type PushPreferences } from "@/lib/push-model";
import {
  getVapidPublicKey,
  getDevicePushSettings,
  saveDevicePushSettings,
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

const PUSH_SCOPE = "/push/";

async function getPushRegistration(): Promise<ServiceWorkerRegistration | undefined> {
  const registrations = await navigator.serviceWorker.getRegistrations();
  return registrations.find((registration) => new URL(registration.scope).pathname === PUSH_SCOPE) ??
    registrations.find((registration) => {
      const script = registration.active?.scriptURL ?? registration.installing?.scriptURL ?? registration.waiting?.scriptURL;
      return script ? new URL(script).pathname.endsWith("/push-sw.js") : false;
    });
}

async function waitForPushWorker(registration: ServiceWorkerRegistration): Promise<ServiceWorkerRegistration> {
  if (registration.active) return registration;
  const worker = registration.installing ?? registration.waiting;
  if (!worker) throw new Error("O serviço de notificações não iniciou. Tente novamente.");

  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("O dispositivo não concluiu a ativação. Tente novamente.")), 10000);
    const onStateChange = () => {
      if (worker.state === "activated") {
        window.clearTimeout(timeout);
        resolve();
      } else if (worker.state === "redundant") {
        window.clearTimeout(timeout);
        reject(new Error("O serviço de notificações não pôde ser ativado."));
      }
    };
    worker.addEventListener("statechange", onStateChange);
    onStateChange();
  });

  return registration;
}

/** Estado atual: permissão do navegador e se há inscrição ativa. */
export async function pushStatus() {
  if (!pushSupported()) {
    return { supported: false, permission: "unsupported", subscribed: false, preferences: defaultPushPreferences };
  }
  const registration = await getPushRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  const settings = subscription ? await getDevicePushSettings({ data: { endpoint: subscription.endpoint } }) : null;
  return {
    supported: true,
    permission: Notification.permission,
    subscribed: !!subscription && settings?.registered === true,
    preferences: settings?.preferences ?? defaultPushPreferences,
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

  if (window.top !== window.self) return { ok: false, reason: "Abra o aplicativo em uma aba própria para ativar notificações." };
  if (!navigator.onLine) return { ok: false, reason: "Conecte-se à internet para registrar este dispositivo." };
  const permission =
    Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, reason: "Permissão de notificação negada no dispositivo." };
  }

  let registration = await getPushRegistration();
  if (!registration) {
    registration = await navigator.serviceWorker.register("/push-sw.js", { scope: PUSH_SCOPE });
  }
  registration = await waitForPushWorker(registration);

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
  const registration = await getPushRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  await removePushSubscription({ data: { endpoint: subscription.endpoint } });
  await subscription.unsubscribe();
}

/** Dispara uma notificação de teste para o próprio usuário. */
export async function testPush() {
  const registration = await getPushRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) throw new Error("Ative as notificações neste dispositivo primeiro.");
  return sendTestPush({ data: { endpoint: subscription.endpoint } });
}
export async function updatePushPreferences(preferences: PushPreferences) {
  const registration = await getPushRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) throw new Error("Dispositivo não registrado.");
  return saveDevicePushSettings({ data: { endpoint: subscription.endpoint, preferences } });
}
