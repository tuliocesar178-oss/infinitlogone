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
      <ul className="space-y-3">
        {offers.map((o: any) => {
          const pending = (o.negotiations ?? []).filter((n: any) => n.status === "proposed");
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
              {pending.length > 0 && (
                <ul className="mt-3 space-y-2 border-t border-border pt-3">
                  {pending.map((n: any) => (
                    <li
                      key={n.id}
                      className="flex items-center justify-between gap-3 rounded-lg bg-amber-500/10 p-2"
                    >
                      <div>
                        <div className="text-xs text-muted-foreground">Contraproposta</div>
                        <div className="font-semibold">{brl(n.amount)}</div>
                        {n.note && <div className="text-xs text-muted-foreground">{n.note}</div>}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => acceptCounter(o.id, n.id, Number(n.amount))}
                          className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                        >
                          <Check className="h-3 w-3" /> Aceitar
                        </button>
                        <button
                          onClick={() => declineCounter(n.id)}
                          className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs hover:bg-accent"
                        >
                          <X className="h-3 w-3" /> Recusar
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
