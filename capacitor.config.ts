import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl = process.env.CAPACITOR_SERVER_URL?.trim();

if (!serverUrl) {
  throw new Error(
    "Defina CAPACITOR_SERVER_URL com o endereço HTTPS publicado da InfinitLog antes de sincronizar o app Android.",
  );
}

const appUrl = new URL(serverUrl);

if (
  appUrl.protocol !== "https:" ||
  appUrl.username ||
  appUrl.password ||
  ["localhost", "127.0.0.1", "::1"].includes(appUrl.hostname)
) {
  throw new Error(
    "CAPACITOR_SERVER_URL precisa ser um endereço HTTPS publicado, sem credenciais e sem servidor local.",
  );
}

const config: CapacitorConfig = {
  appId: "com.infinitlog.transportes",
  appName: "InfinitLog Vapt Vupt",
  webDir: "capacitor-web",
  server: {
    url: appUrl.toString(),
    androidScheme: "https",
    cleartext: false,
    allowNavigation: [appUrl.hostname],
  },
};

export default config;