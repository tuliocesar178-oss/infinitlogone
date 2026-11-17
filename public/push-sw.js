/* eslint-disable no-undef */
/**
 * Handlers de Web Push da InfinitLog.
 *
 * Pode ser registrado como worker de mensagens sem cache ou importado pelo
 * worker existente do aplicativo publicado. Não armazena páginas offline.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  /** @type {{title?: string, body?: string, url?: string, tag?: string, roomId?: string, messageId?: string, timestamp?: number, image?: string, requireInteraction?: boolean}} */
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }

  const requested = typeof payload.url === "string" ? payload.url : "/app";
  let target = "/app";
  try {
    const parsed = new URL(requested, self.location.origin);
    if (parsed.origin === self.location.origin) target = `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    target = "/app";
  }

  const roomId = typeof payload.roomId === "string" ? payload.roomId : null;
  const options = {
    body: payload.body || "",
    icon: new URL("/notification-icon-v2.png", self.location.origin).href,
    // Android uses the alpha silhouette, not a full-color square app icon.
    badge: new URL("/notification-badge-v2.png", self.location.origin).href,
    tag: payload.tag || "infinitlog",
    renotify: payload.requireInteraction === true,
    requireInteraction: payload.requireInteraction === true,
    timestamp: Number.isFinite(payload.timestamp) ? payload.timestamp : Date.now(),
    vibrate: [220, 90, 220],
    data: {
      url: target,
      roomId,
      messageId: typeof payload.messageId === "string" ? payload.messageId : null,
    },
  };

  if (typeof payload.image === "string") {
    try {
      const image = new URL(payload.image, self.location.origin);
      if (image.origin === self.location.origin) options.image = image.href;
    } catch {
      // Imagens externas ou inválidas são ignoradas pelo Service Worker.
    }
  }

  event.waitUntil(
    (async () => {
      if (roomId) {
        const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        const conversationIsActive = clients.some((client) => {
          const clientUrl = new URL(client.url);
          return clientUrl.origin === self.location.origin &&
            clientUrl.pathname.endsWith("/chat") &&
            clientUrl.searchParams.get("roomId") === roomId &&
            client.visibilityState === "visible" &&
            client.focused;
        });
        if (conversationIsActive) return;
      }
      await self.registration.showNotification(payload.title || "INFINITLOG VAPT VUPT", options);
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const requested = typeof data.url === "string" ? data.url : "/app";
  let target = new URL("/app", self.location.origin);
  try {
    const parsed = new URL(requested, self.location.origin);
    if (parsed.origin === self.location.origin) target = parsed;
  } catch {
    // Destino inválido: mantém a página inicial segura do aplicativo.
  }

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clientList) {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin !== self.location.origin) continue;

        const isOpenConversation =
          typeof data.roomId === "string" &&
          clientUrl.pathname.endsWith("/chat") &&
          clientUrl.searchParams.get("roomId") === data.roomId;

        await client.focus();
        if (isOpenConversation) return;
        await client.navigate(target.href);
        return;
      }
      await self.clients.openWindow(target.href);
    })(),
  );
});
