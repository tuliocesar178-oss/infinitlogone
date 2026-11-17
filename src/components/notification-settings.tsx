import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, BellOff, Loader2, Send } from "lucide-react";
import { disablePush, enablePush, pushStatus, testPush, updatePushPreferences } from "@/lib/push";
import { defaultPushPreferences, type PushPreferences } from "@/lib/push-model";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
      setStatus({ supported: false, permission: "unsupported", subscribed: false, preferences: defaultPushPreferences });
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
      if (result.sent > 0) toast.success("Serviço de push aceitou o teste. Confira seu celular.");
      else if (result.pending > 0) toast.info("O teste está sendo enviado. Aguarde a notificação no dispositivo.");
      else toast.warning("O teste não foi aceito pelo serviço de push.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha no envio de teste.");
    } finally {
      setBusy(false);
    }
  }

  const blocked = status?.permission === "denied";
  const unsupported = status?.supported === false;
  const preferences: { key: keyof PushPreferences; label: string }[] = [
    { key: "offers", label: "Novos fretes e ofertas" }, { key: "routes", label: "Atualizações de fretes" },
    { key: "deliveries", label: "Entregas e comprovantes" },
    { key: "chat", label: "Mensagens do chat" }, { key: "incidents", label: "Ocorrências" },
    { key: "registrations", label: "Cadastros e aprovação" }, { key: "finance", label: "Avisos financeiros autorizados" },
  ];
  async function changePreference(key: keyof PushPreferences, checked: boolean) {
    if (!status) return;
    setBusy(true);
    try {
      const next = { ...status.preferences, [key]: checked };
      await updatePushPreferences(next);
      setStatus({ ...status, preferences: next });
    } catch { toast.error("Não foi possível salvar a preferência."); }
    finally { setBusy(false); }
  }

  return (
    <section className={cn("card-soft p-6", className)}>
      <header className="mb-1 flex items-center gap-2">
        {status?.subscribed ? (
          <Bell className="h-4 w-4 text-brand" />
        ) : (
          <BellOff className="h-4 w-4 text-muted-foreground" />
        )}
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Notificações no celular
        </h2>
      </header>

      <p className="mb-4 text-sm text-muted-foreground">
        {status ? status.subscribed ? "Ativadas neste dispositivo." : blocked ? "Permissão bloqueada." : "Não ativadas neste dispositivo." : "Consultando dispositivo…"}
      </p>
      <p className="mb-4 text-xs text-muted-foreground">Sem internet ou com economia de bateria, os avisos podem atrasar. As notificações internas continuam disponíveis.</p>

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
        <Button
          type="button"
          onClick={toggle}
          disabled={busy || !status || unsupported || blocked}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
          {status?.subscribed ? "Desativar notificações" : "Ativar notificações"}
        </Button>

        {status?.subscribed && (
          <Button
            type="button"
            onClick={test}
            disabled={busy}
            variant="outline"
          >
            <Send className="h-4 w-4" />
            Enviar teste
          </Button>
        )}
      </div>
      {status?.subscribed && <div className="mt-5 divide-y divide-border">
        {preferences.map(({ key, label }) => <label key={key} className="flex items-center justify-between gap-4 py-3 text-sm">
          {label}<Switch aria-label={label} checked={status.preferences[key]} disabled={busy} onCheckedChange={(checked) => void changePreference(key, checked)} />
        </label>)}
      </div>}
    </section>
  );
}
