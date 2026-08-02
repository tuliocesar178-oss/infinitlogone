import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, BellOff, Loader2, Send } from "lucide-react";
import { disablePush, enablePush, pushStatus, testPush } from "@/lib/push";
import { cn } from "@/lib/utils";

type Status = Awaited<ReturnType<typeof pushStatus>>;

/**
 * Card de configuração das notificações push do dispositivo atual.
 * Funciona para qualquer perfil (motorista, equipe, cliente).
 */
export function NotificationSettings({ className }: { className?: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setStatus(await pushStatus());
    } catch {
      setStatus({ supported: false, permission: "unsupported", subscribed: false });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function toggle() {
    setBusy(true);
    try {
      if (status?.subscribed) {
        await disablePush();
        toast.success("Notificações desativadas neste dispositivo.");
      } else {
        const result = await enablePush();
        if (!result.ok) {
          toast.error(result.reason);
          return;
        }
        toast.success("Notificações ativadas neste dispositivo.");
      }
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao alterar notificações.");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    try {
      const result = await testPush();
      if (result.sent > 0) toast.success("Notificação de teste enviada.");
      else toast.warning("Nenhum dispositivo ativo recebeu a notificação.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha no envio de teste.");
    } finally {
      setBusy(false);
    }
  }

  const blocked = status?.permission === "denied";
  const unsupported = status?.supported === false;

  return (
    <section className={cn("card-soft p-6", className)}>
      <header className="mb-1 flex items-center gap-2">
        {status?.subscribed ? (
          <Bell className="h-4 w-4 text-brand" />
        ) : (
          <BellOff className="h-4 w-4 text-muted-foreground" />
        )}
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Notificações
        </h2>
      </header>

      <p className="mb-4 text-sm text-muted-foreground">
        Receba avisos de novas ofertas de frete e atualizações da operação mesmo com o
        aplicativo fechado.
      </p>

      {unsupported && (
        <p className="mb-4 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
          Este navegador não suporta notificações. No iPhone/iPad, instale o app pela opção
          “Adicionar à Tela de Início” e abra por lá.
        </p>
      )}

      {blocked && (
        <p className="mb-4 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
          As notificações estão bloqueadas nas configurações do navegador. Libere a permissão
          para este site e tente novamente.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={toggle}
          disabled={busy || unsupported || blocked}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
          {status?.subscribed ? "Desativar notificações" : "Ativar notificações"}
        </button>

        {status?.subscribed && (
          <button
            type="button"
            onClick={test}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full border border-input bg-background px-5 py-2.5 text-sm font-medium transition hover:bg-accent disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            Enviar teste
          </button>
        )}
      </div>
    </section>
  );
}
