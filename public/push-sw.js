/* eslint-disable no-undef */
/**
 * Handlers de Web Push da InfinitLog.
 *
 * Este arquivo é importado pelo service worker gerado (Workbox) através da
 * opção `importScripts`, portanto roda no mesmo escopo do SW do app — não é
 * um worker separado e não interfere no cache offline.
 */

self.addEventListener("push", (event) => {
  /** @type {{title?: string, body?: string, url?: string, tag?: string, requireInteraction?: boolean}} */
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "InfinitLog Transportes";
  const options = {
    body: payload.body || "",
    icon: "/pwa-192x192.png",
    badge: "/pwa-192x192.png",
    tag: payload.tag || "infinitlog",
    renotify: true,
    requireInteraction: payload.requireInteraction === true,
    vibrate: [220, 90, 220],
    data: { url: payload.url || "/app" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/app";

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // Reaproveita uma janela já aberta do app sempre que possível.
      for (const client of clientList) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus();
          if ("navigate" in client) await client.navigate(target);
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
