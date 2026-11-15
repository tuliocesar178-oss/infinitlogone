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
  /** @type {{title?: string, body?: string, url?: string, tag?: string, roomId?: string, requireInteraction?: boolean}} */
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "INFINITLOG VAPT VUPT";
  const options = {
    body: payload.body || "",
    icon: "/pwa-512x512.png",
    badge: "/pwa-192x192.png",
    tag: payload.tag || "infinitlog",
    renotify: payload.requireInteraction === true,
    requireInteraction: payload.requireInteraction === true,
    vibrate: [220, 90, 220],
    data: { url: payload.url || "/app", roomId: payload.roomId || null },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const requested = (event.notification.data && event.notification.data.url) || "/app";
  const parsed = new URL(requested, self.location.origin);
  const target = parsed.origin === self.location.origin ? parsed.href : new URL("/app", self.location.origin).href;

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // Reaproveita uma janela já aberta do app sempre que possível.
      for (const client of clientList) {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin !== self.location.origin) continue;

        const isOpenConversation =
          payload.roomId &&
          clientUrl.pathname.endsWith("/chat") &&
          clientUrl.searchParams.get("roomId") === payload.roomId &&
          client.visibilityState === "visible" &&
          client.focused;
        if (isOpenConversation) return;

        await client.focus();
        if ("navigate" in client) await client.navigate(target);
        return;
      }
      await self.clients.openWindow(target);
    })(),
  );
});
