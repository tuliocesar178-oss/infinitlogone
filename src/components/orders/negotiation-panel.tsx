import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CounterofferDraft {
  offerId: string;
  currentAmount: number;
  driverName: string;
}

function brl(n: number) {
  return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function NegotiationPanel({ orderId, onChanged }: { orderId: string; onChanged: () => void }) {
  const [counteroffer, setCounteroffer] = useState<CounterofferDraft | null>(null);
  const offersQ = useQuery({
    queryKey: ["order-offers", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("freight_offers")
        .select("*,negotiations(*)")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const offers = data ?? [];
      const ids = [...new Set(offers.map((o) => o.driver_id).filter(Boolean))] as string[];
      let names = new Map<string, string>();
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id,full_name")
          .in("id", ids);
        names = new Map((profs ?? []).map((p) => [p.id, p.full_name ?? ""]));
      }
      return offers.map((o) => ({ ...o, driver: { full_name: names.get(o.driver_id) || "Motorista" } }));
    },
    refetchInterval: 5000,
  });

  async function acceptCounter(offerId: string, negotiationId: string, amount: number) {
    try {
      const { error } = await supabase.rpc("respond_freight_counteroffer", {
        _negotiation_id: negotiationId,
        _decision: "accepted",
      });
      if (error) throw error;
      toast.success("Contraproposta aceita.");
      onChanged();
      offersQ.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao aceitar");
    }
  }

  async function declineCounter(negotiationId: string) {
    const { error } = await supabase.rpc("respond_freight_counteroffer", {
      _negotiation_id: negotiationId,
      _decision: "declined",
    });
    if (error) return toast.error(error.message);
    toast.info("Contraproposta recusada.");
    offersQ.refetch();
  }

  const offers = offersQ.data ?? [];
  if (offers.length === 0) return null;

  return (
    <section className="card-soft p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        Ofertas & negociações
      </h2>
      <ul className="space-y-4">
        {offers.map((o: any) => {
          const negotiations = o.negotiations ?? [];
          const pending = negotiations.filter(
            (n: any) => n.status === "proposed" && n.proposed_by === o.driver_id,
          );
          const waitingDriver = negotiations.filter(
            (n: any) => n.status === "proposed" && n.proposed_by !== o.driver_id,
          );
          const history = negotiations.filter((n: any) => n.status !== "proposed");
          return (
            <li key={o.id} className="rounded-xl border border-border p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">{o.driver?.full_name ?? "Motorista"}</div>
                  <div className="text-xs text-muted-foreground">
                    {brl(o.offered_price)} · {o.status}
                  </div>
                </div>
              </div>
              {negotiations.length > 0 && (
                <div className="mt-3 space-y-3 border-t border-border pt-3">
                  {/* Propostas pendentes */}
                  {pending.length > 0 && (
                    <ul className="space-y-2">
                      {pending.map((n: any) => (
                        <li
                          key={n.id}
                          className="flex items-center justify-between gap-3 rounded-xl bg-amber-500/10 p-3 ring-1 ring-amber-500/20 animate-pulse"
                        >
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-widest text-amber-600">
                              Contraproposta recebida
                            </div>
                            <div className="text-base font-black tracking-tight text-amber-700">
                              {brl(n.amount)}
                            </div>
                            {n.note && (
                              <div className="mt-1 text-xs text-amber-600/80 italic">
                                "{n.note}"
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCounteroffer({
                                offerId: o.id,
                                currentAmount: Number(n.amount),
                                driverName: o.driver?.full_name ?? "Motorista",
                              })}
                            >
                              <MessageCircle /> Contrapropor
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => acceptCounter(o.id, n.id, Number(n.amount))}
                            >
                              <Check /> Aceitar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => declineCounter(n.id)}
                            >
                              <X /> Recusar
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  {waitingDriver.map((n: any) => (
                    <div key={n.id} className="rounded-md border border-primary/30 bg-primary/5 p-3">
                      <div className="text-xs font-semibold text-primary">Contraproposta enviada</div>
                      <div className="mt-1 text-base font-bold">{brl(n.amount)}</div>
                      {n.note && <p className="mt-1 text-xs text-muted-foreground">{n.note}</p>}
                      <p className="mt-2 text-xs text-muted-foreground">Aguardando resposta do motorista.</p>
                    </div>
                  ))}

                  {/* Histórico de negociação */}
                  {history.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                        Histórico
                      </div>
                      <ul className="space-y-1">
                        {history.map((n: any) => (
                          <li
                            key={n.id}
                            className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground"
                          >
                            <span className="flex items-center gap-1.5">
                              {n.status === "accepted" ? (
                                <Check className="h-3 w-3 text-emerald-500" />
                              ) : (
                                <X className="h-3 w-3 text-red-500" />
                              )}
                              {brl(n.amount)}
                            </span>
                            <span>{statusLabel(n.status)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {counteroffer && (
        <CounterofferDialog
          draft={counteroffer}
          onClose={() => setCounteroffer(null)}
          onSent={() => {
            setCounteroffer(null);
            offersQ.refetch();
            onChanged();
          }}
        />
      )}
    </section>
  );
}

function statusLabel(status: string) {
  if (status === "accepted") return "Aceita";
  if (status === "countered") return "Substituída por nova proposta";
  return "Recusada";
}

function CounterofferDialog({
  draft,
  onClose,
  onSent,
}: {
  draft: CounterofferDraft;
  onClose: () => void;
  onSent: () => void;
}) {
  const [amount, setAmount] = useState(String(draft.currentAmount.toFixed(2)).replace(".", ","));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    const value = Number(amount.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("submit_freight_counteroffer", {
      _offer_id: draft.offerId,
      _amount: value,
      _note: note.trim() || undefined,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Contraproposta enviada ao motorista.");
    onSent();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-md border border-border bg-card p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
        <h3 className="text-lg font-semibold">Enviar contraproposta</h3>
        <p className="mt-1 text-sm text-muted-foreground">Novo valor para {draft.driverName}</p>
        <label className="mt-5 block text-sm font-medium">
          Valor ao motorista (R$)
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            autoFocus
            className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-base outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <label className="mt-4 block text-sm font-medium">
          Observação
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            placeholder="Explique as condições deste novo valor"
            className="mt-2 w-full rounded-md border border-input bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={saving} onClick={submit}>
            {saving ? "Enviando…" : "Enviar contraproposta"}
          </Button>
        </div>
      </div>
    </div>
  );
}
