import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, X } from "lucide-react";

function brl(n: number) {
  return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function NegotiationPanel({ orderId, onChanged }: { orderId: string; onChanged: () => void }) {
  const offersQ = useQuery({
    queryKey: ["order-offers", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("freight_offers")
        .select("*,driver:profiles!freight_offers_driver_id_fkey(full_name),negotiations(*)")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function acceptCounter(offerId: string, negotiationId: string, amount: number) {
    try {
      const { error: nErr } = await supabase
        .from("negotiations")
        .update({ status: "accepted" })
        .eq("id", negotiationId);
      if (nErr) throw nErr;
      const { error: oErr } = await supabase
        .from("freight_offers")
        .update({ status: "accepted", offered_price: amount, accepted_at: new Date().toISOString() })
        .eq("id", offerId);
      if (oErr) throw oErr;
      toast.success("Contraproposta aceita.");
      onChanged();
      offersQ.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao aceitar");
    }
  }

  async function declineCounter(negotiationId: string) {
    const { error } = await supabase
      .from("negotiations")
      .update({ status: "declined" })
      .eq("id", negotiationId);
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
          const pending = negotiations.filter((n: any) => n.status === "proposed");
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
                            <button
                              onClick={() => acceptCounter(o.id, n.id, Number(n.amount))}
                              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-emerald-600 px-4 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 hover:opacity-90 transition"
                            >
                              <Check className="h-3.5 w-3.5" /> Aceitar
                            </button>
                            <button
                              onClick={() => declineCounter(n.id)}
                              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-background px-4 text-xs font-bold hover:bg-accent transition"
                            >
                              <X className="h-3.5 w-3.5" /> Recusar
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

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
                            <span className="capitalize">{n.status === 'accepted' ? 'Aceita' : 'Recusada'}</span>
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
    </section>
  );
}
