import { useEffect, useState } from "react";
import { toast } from "sonner";
import { WifiOff } from "lucide-react";
import { registerServiceWorker } from "@/lib/pwa";

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
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    void registerServiceWorker(() => window.location.reload());

    // Device subscription is managed only through an explicit user action.
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
      {offline && <OfflineBanner />}
      {children}
    </>
  );
}
