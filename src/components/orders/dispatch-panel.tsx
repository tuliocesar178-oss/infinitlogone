import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { dispatchOrderToEligibleDrivers } from "@/lib/dispatch.functions";

export function DispatchPanel({ order, onSent }: { order: any; onSent: () => void }) {
  const dispatch = useServerFn(dispatchOrderToEligibleDrivers);
  const [price, setPrice] = useState<number>(order.driver_amount ?? 0);
  const [minutes, setMinutes] = useState(15);
  const [sending, setSending] = useState(false);

  async function send() {
    setSending(true);
    try {
      const result = await dispatch({
        data: { order_id: order.id, price, minutes },
      });

      if (result.count === 0) {
        toast.warning("Nenhum motorista cadastrado para receber a oferta.");
        return;
      }

      toast.success(`Rota despachada para ${result.count} motorista(s).`);
      onSent();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao despachar rota");
    } finally {
      setSending(false);
    }
  }

  if (order.status !== "preparing" && order.status !== "created" && order.status !== "awaiting_driver") {
    return null;
  }

  return (
    <section className="card-soft p-6">
      <header className="mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Despacho automático
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A oferta será enviada simultaneamente a todos os motoristas cadastrados.
        </p>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <label className="text-xs text-muted-foreground">
          Valor ao motorista (R$)
          <input
            type="number"
            min="0"
            value={price}
            onChange={(event) => setPrice(Number(event.target.value))}
            className="mt-1 h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm text-foreground outline-none"
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Prazo para aceite (min)
          <input
            type="number"
            min="1"
            max="1440"
            value={minutes}
            onChange={(event) => setMinutes(Number(event.target.value))}
            className="mt-1 h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm text-foreground outline-none"
          />
        </label>
      </div>

      <Button onClick={send} disabled={sending} className="w-full">
        <Send className="h-4 w-4" />
        {sending ? "Despachando…" : "Despachar rota"}
      </Button>
    </section>
  );
}
