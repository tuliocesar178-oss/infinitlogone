import { useEffect, useState } from "react";
import { toast } from "sonner";
import { WifiOff } from "lucide-react";
import { registerServiceWorker } from "@/lib/pwa";
import { enablePush, pushSupported } from "@/lib/push";
import { supabase } from "@/integrations/supabase/client";
import logoAsset from "@/assets/infinitlog-logo.png.asset.json";

const PERMISSIONS_KEY = "infinitlog-permissions-asked";

/**
 * Reativa/renova a inscrição de push sempre que o app abre com permissão
 * concedida e usuário logado — inscrições podem ser rotacionadas pelo browser.
 */
async function syncPushSubscription() {
  if (!pushSupported() || Notification.permission !== "granted") return;
  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    await enablePush();
  } catch (error) {
    console.warn("[Push] não foi possível sincronizar a inscrição", error);
  }
}


/**
 * Solicita as permissões do app uma única vez por dispositivo.
 * Após a primeira solicitação a flag é gravada e nunca mais pedimos.
 */
async function requestPermissionsOnce() {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(PERMISSIONS_KEY)) return;
    localStorage.setItem(PERMISSIONS_KEY, "1");
  } catch {
    return;
  }

  // Notificações (push / alertas de operação)
  try {
    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }
  } catch (error) {
    console.warn("[PWA] permissão de notificação indisponível", error);
  }

  // Localização — dispara o prompt nativo uma vez; o rastreamento contínuo
  // é iniciado automaticamente pelo hook de tracking quando há frete ativo.
  try {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        () => {},
        () => {},
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
      );
    }
  } catch (error) {
    console.warn("[PWA] permissão de localização indisponível", error);
  }
}

/** Splash com a logo exibida por ~2s ao abrir o app. */
function SplashScreen() {
  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-6"
      style={{ background: "#0d1b4a" }}
      aria-hidden
    >
      <img
        src={logoAsset.url}
        alt=""
        width={112}
        height={112}
        className="h-28 w-28 animate-pulse object-contain"
      />
      <p className="text-sm font-medium tracking-wide text-white/80">
        InfinitLog Transportes
      </p>
    </div>
  );
}

/** Faixa fixa exibida quando o dispositivo perde a conexão. */
function OfflineBanner() {
  return (
    <div className="fixed inset-x-0 top-0 z-[9998] flex items-center justify-center gap-2 bg-destructive px-4 py-2 text-xs font-medium text-destructive-foreground shadow-md">
      <WifiOff className="h-4 w-4" />
      Você está sem conexão. Exibindo os últimos dados sincronizados.
    </div>
  );
}

/**
 * Infraestrutura PWA: service worker, splash, estado offline e sincronização.
 */
export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [showSplash, setShowSplash] = useState(true);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowSplash(false), 600);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    void registerServiceWorker(() => window.location.reload());
    void requestPermissionsOnce().then(syncPushSubscription);
  }, []);

  useEffect(() => {
    setOffline(!navigator.onLine);

    function goOffline() {
      setOffline(true);
    }
    function goOnline() {
      setOffline(false);
      toast.success("Conexão restabelecida. Sincronizando…");
      // Refaz todas as consultas pendentes assim que a internet volta.
      window.dispatchEvent(new Event("infinitlog:resync"));
    }

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  return (
    <>
      {showSplash && <SplashScreen />}
      {offline && <OfflineBanner />}
      {children}
    </>
  );
}
