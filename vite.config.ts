// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  plugins: [
    VitePWA({
      // O registro é feito exclusivamente pelo wrapper guardado em src/lib/pwa.ts,
      // para que o service worker nunca seja instalado no preview do Lovable.
      injectRegister: null,
      registerType: "autoUpdate",
      devOptions: { enabled: false },
      filename: "sw.js",
      includeAssets: ["favicon.png", "apple-touch-icon.png", "robots.txt"],
      manifest: {
        id: "/",
        name: "InfinitLog Transportes",
        short_name: "InfinitLog",
        description: "Sistema Inteligente de Gestão Logística.",
        lang: "pt-BR",
        start_url: "/app",
        scope: "/",
        display: "standalone",
        display_override: ["standalone", "fullscreen", "minimal-ui"],
        orientation: "portrait-primary",
        background_color: "#0d1b4a",
        theme_color: "#0d1b4a",
        categories: ["business", "productivity", "travel"],
        icons: [
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          {
            src: "/pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        shortcuts: [
          { name: "Ofertas", short_name: "Ofertas", url: "/driver/ofertas" },
          { name: "Rastreamento", short_name: "Rastreio", url: "/rastreio" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: "/",
        // OAuth e endpoints de API nunca podem ser servidos pelo app shell.
        navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//],
        runtimeCaching: [
          {
            // Navegações sempre tentam a rede primeiro (nunca cache-first em HTML).
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "infinitlog-pages",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            urlPattern: ({ url, request }) =>
              url.origin === self.location.origin &&
              ["style", "script", "worker", "image", "font"].includes(request.destination),
            handler: "CacheFirst",
            options: {
              cacheName: "infinitlog-assets",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: ({ url }) => url.hostname.endsWith("supabase.co"),
            handler: "NetworkFirst",
            options: {
              cacheName: "infinitlog-api",
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            urlPattern: ({ url }) => url.hostname.endsWith("mapbox.com"),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "infinitlog-mapbox",
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
      },
    }),
  ],
});
