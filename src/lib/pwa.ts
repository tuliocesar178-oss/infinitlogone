/**
 * Registro seguro do Service Worker.
 *
 * O SW NUNCA pode ser registrado no preview do Lovable, dentro de iframes ou
 * em desenvolvimento — nesses contextos ele serviria HTML/chunks obsoletos.
 * Em qualquer contexto recusado, registros antigos de `/sw.js` são removidos.
 */

const PREVIEW_HOST_PREFIXES = ["id-preview--", "preview--"];
const PREVIEW_HOST_SUFFIXES = [
  "lovableproject.com",
  "lovableproject-dev.com",
  "beta.lovable.dev",
];

function isBlockedContext(): boolean {
  if (typeof window === "undefined") return true;
  if (!import.meta.env.PROD) return true;
  if (window.self !== window.top) return true;

  const host = window.location.hostname;
  if (PREVIEW_HOST_PREFIXES.some((p) => host.startsWith(p))) return true;
  if (PREVIEW_HOST_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`))) return true;
  if (new URLSearchParams(window.location.search).has("sw")) {
    return new URLSearchParams(window.location.search).get("sw") === "off";
  }
  return false;
}

async function unregisterAppWorker(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.allSettled(
      registrations
        .filter((r) => (r.active?.scriptURL ?? r.installing?.scriptURL ?? "").includes("/sw.js"))
        .map((r) => r.unregister()),
    );
  } catch (error) {
    console.warn("[PWA] falha ao remover service worker antigo", error);
  }
}

/**
 * Registra o service worker e mantém o app sempre atualizado.
 * @param onUpdated chamado quando uma nova versão assume o controle.
 */
export async function registerServiceWorker(onUpdated?: () => void): Promise<void> {
  if (isBlockedContext()) {
    await unregisterAppWorker();
    return;
  }
  if (!("serviceWorker" in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });

    // Verificação periódica de nova versão (atualização automática, sem reinstalar).
    window.setInterval(() => void registration.update(), 60 * 60 * 1000);

    // Só recarrega quando um SW ANTIGO é substituído. Na primeira instalação
    // (clientsClaim) o controllerchange dispararia um reload desnecessário,
    // que aparecia como falha ao abrir o app instalado.
    const hadController = Boolean(navigator.serviceWorker.controller);
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing || !hadController) return;
      refreshing = true;
      onUpdated?.();
    });
  } catch (error) {
    console.warn("[PWA] registro do service worker falhou", error);
  }
}

/** Indica se o app está rodando instalado (sem barra de endereço). */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/* ---------------- Instalação (Android / Chrome) ---------------- */

/** Evento não padronizado do Chrome que permite abrir o diálogo nativo. */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

// Captura o mais cedo possível: o Chrome dispara o evento uma única vez por carga.
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferredPrompt = null;
    notify();
  });
}

export function subscribeInstall(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function canPromptInstall(): boolean {
  return deferredPrompt !== null;
}

export function wasInstalled(): boolean {
  return installed;
}

export function isAndroid(): boolean {
  return typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
}

/** Abre o diálogo nativo. Retorna o resultado ou "unavailable". */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const event = deferredPrompt;
  if (!event) return "unavailable";
  deferredPrompt = null; // o evento só pode ser usado uma vez
  notify();
  await event.prompt();
  const { outcome } = await event.userChoice;
  if (outcome === "accepted") installed = true;
  notify();
  return outcome;
}
