import { Link } from "@tanstack/react-router";
import { AlertTriangle, Clock3, MapPin, MessageSquare, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { STATUS_LABEL } from "@/lib/order-status";
import { INCIDENT_LABEL, etaDate, expectedDelivery, isLate, progress, type BoardOrder } from "@/lib/operation-board";
import { cn } from "@/lib/utils";

interface FreightCardProps { order: BoardOrder; }

function fmt(value: Date | null) {
  return value?.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) ?? "—";
}

export function FreightCard({ order }: FreightCardProps) {
  const pct = progress(order);
  const late = isLate(order);
  const incident = order.incident;
  const total = order.initial_distance_km ?? order.distance_km;
  const remaining = order.distance_to_destination_km;
  const traveled = total != null && remaining != null ? Math.max(0, total - remaining) : null;

  return (
    <article className={cn("border bg-card p-4 shadow-card", incident || order.status === "incident" ? "border-destructive" : late ? "border-warning" : "border-border")}>
      <div className="flex items-start justify-between gap-3">
        <div><p className="font-mono text-sm font-bold text-brand">#{order.code}</p><h2 className="mt-1 text-lg font-bold">{order.client_name || "Cliente não informado"}</h2></div>
        <span className={cn("rounded-md px-2.5 py-1 text-xs font-bold", incident ? "bg-destructive text-destructive-foreground" : late ? "bg-warning text-warning-foreground" : "bg-primary text-primary-foreground")}>
          {incident ? "Ocorrência" : late ? "Atrasado" : STATUS_LABEL[order.status] ?? order.status}
        </span>
      </div>
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div className="flex items-center gap-2"><Truck className="h-4 w-4 text-brand" /><span><b>{order.driver?.full_name || "Sem motorista"}</b><br /><span className="text-muted-foreground">{[order.vehicle?.brand, order.vehicle?.model, order.vehicle?.plate].filter(Boolean).join(" · ") || "Veículo não definido"}</span></span></div>
        <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-brand" /><span>{order.origin_city || "Origem"}/{order.origin_state || "—"} → {order.destination_city || "Destino"}/{order.destination_state || "—"}</span></div>
      </div>
      {(total != null || remaining != null || pct != null) && <div className="mt-4">
        <div className="mb-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span>{total != null ? `${total.toFixed(0)} km total` : "Distância total indisponível"}</span><span>{traveled != null ? `${traveled.toFixed(0)} km percorridos` : ""}</span><span>{remaining != null ? `${remaining.toFixed(0)} km restantes` : ""}</span></div>
        {pct != null && <progress className="h-2 w-full accent-brand" max={100} value={pct} aria-label={`${pct}% concluído`} />}
      </div>}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <span className="flex items-center gap-1.5"><Clock3 className="h-4 w-4 text-muted-foreground" /> ETA {fmt(etaDate(order))}</span>
        {expectedDelivery(order) && <span className="text-muted-foreground">Previsto {fmt(expectedDelivery(order))}</span>}
        {pct != null && <span className="font-bold text-brand">{pct}% concluído</span>}
      </div>
      {incident && <div className="mt-4 flex items-start gap-2 border-l-4 border-destructive bg-destructive/10 p-3 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" /><div><b>{INCIDENT_LABEL[incident.type] ?? incident.type}</b>{incident.description && <p className="mt-0.5 text-muted-foreground">{incident.description}</p>}</div></div>}
      <div className="mt-4 flex gap-2 border-t border-border pt-3">
        <Button asChild variant="outline" size="sm"><Link to="/ops/pedidos/$id" params={{ id: order.id }}>Ver frete</Link></Button>
        <Button asChild variant="ghost" size="sm"><Link to="/ops/chat" search={{ orderId: order.id }}><MessageSquare /> Chat</Link></Button>
      </div>
    </article>
  );
}