import { useEffect, useState, useSyncExternalStore } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  canPromptInstall,
  isAndroid,
  isStandalone,
  promptInstall,
  subscribeInstall,
  wasInstalled,
} from "@/lib/pwa";

/**
 * Botão "Instalar INFINITLOG".
 * - Chrome (Android/desktop) com oferta disponível: abre o diálogo nativo.
 * - Android sem oferta: mostra instruções pelo menu do Chrome.
 * - iPhone e app já instalado: não aparece (fluxo atual preservado).
 */
export function InstallAppButton({ className }: { className?: string }) {
  const canPrompt = useSyncExternalStore(subscribeInstall, canPromptInstall, () => false);
  const installed = useSyncExternalStore(subscribeInstall, wasInstalled, () => false);
  // Ambiente só é conhecido após hidratação (evita divergência com o SSR).
  const [env, setEnv] = useState<{ android: boolean; standalone: boolean } | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    setEnv({ android: isAndroid(), standalone: isStandalone() });
  }, []);

  if (!env || env.standalone || installed) return null;
  if (!canPrompt && !env.android) return null;

  async function onClick() {
    if (!canPrompt) {
      setHelpOpen(true);
      return;
    }
    const outcome = await promptInstall();
    if (outcome === "accepted") toast.success("INFINITLOG instalado na tela inicial.");
    else if (outcome === "dismissed") toast("Instalação cancelada.");
    else setHelpOpen(true);
  }

  return (
    <>
      <Button type="button" variant="outline" className={className} onClick={onClick}>
        <Download className="h-4 w-4" /> Instalar INFINITLOG
      </Button>
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Instalar pelo Chrome</DialogTitle>
            <DialogDescription>
              O Chrome ainda não liberou a instalação automática nesta visita.
            </DialogDescription>
          </DialogHeader>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-foreground">
            <li>Toque no menu ⋮ no canto superior direito do Chrome.</li>
            <li>Escolha <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.</li>
            <li>Confirme em <strong>Instalar</strong>.</li>
          </ol>
        </DialogContent>
      </Dialog>
    </>
  );
}
