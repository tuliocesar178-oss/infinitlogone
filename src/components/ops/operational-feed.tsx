import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Activity } from "lucide-react";
import { STATUS_LABEL } from "@/lib/order-status";

const EVENT_LABEL: Record<string, string> = {
  created: "Frete criado",
  status_change: "Status atualizado",
  program_sent: "Programação enviada ao motorista",
  offer_accepted: "Motorista aceitou o frete",
  offer_declined: "Motorista recusou o frete",
  auto_approach: "Motorista chegando ao destino",
  arrival_override: "Chegada confirmada manualmente",
  driver_start: "Motorista iniciou deslocamento",
  driver_at_pickup: "Motorista chegou na coleta",
  driver_loaded: "Carga carregada",
  driver_out_for_delivery: "Saiu para entrega",
  driver_delivered: "Entrega concluída",
  incident: "Ocorrência registrada",
};

function label(e: { event_type: string; to_status: string | null }) {
  if (e.to_status && STATUS_LABEL[e.to_status]) return STATUS_LABEL[e.to_status];
  return EVENT_LABEL[e.event_type] ?? e.event_type;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function OperationalFeed() {
  const qc = useQueryClient();

  const feedQ = useQuery({
    queryKey: ["ops-feed"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_events")
        .select("id, order_id, event_type, to_status, created_at, orders(code, client_name)")
        .order("created_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("ops-feed-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_events" }, () =>
        qc.invalidateQueries({ queryKey: ["ops-feed"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const events = feedQ.data ?? [];

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
          <Activity className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold">Feed operacional</h2>
          <p className="text-[11px] text-muted-foreground">Linha do tempo em tempo real</p>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto p-3">
        {events.length === 0 ? (
          <div className="grid h-full place-items-center text-xs text-muted-foreground">
            Sem eventos recentes.
          </div>
        ) : (
          <ol className="relative ml-3 space-y-3 border-l border-border/60 pl-4">
            {events.map((e: any) => (
              <li key={e.id} className="relative">
                <span className="absolute -left-[22px] top-1 h-2.5 w-2.5 rounded-full bg-brand ring-4 ring-brand/20" />
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {fmtTime(e.created_at)}
                  </span>
                  {e.orders?.code && (
                    <span className="font-mono text-[10px] font-semibold text-brand">
                      {e.orders.code}
                    </span>
                  )}
                </div>
                <div className="text-sm font-medium">{label(e)}</div>
                {e.orders?.client_name && (
                  <div className="text-[11px] text-muted-foreground">{e.orders.client_name}</div>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
