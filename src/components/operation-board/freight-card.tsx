import { Link } from "@tanstack/react-router";
import { AlertTriangle, Clock3, MapPin, MessageSquare, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { STATUS_LABEL } from "@/lib/order-status";
import { INCIDENT_LABEL, progress, type BoardOrder } from "@/lib/operation-board";
import { cn } from "@/lib/utils";
import { deadline, DEADLINE_LABELS, type MonitoringSettings } from "@/lib/operation-board-monitor";

interface FreightCardProps { order: BoardOrder; onSelect?: (id:string)=>void; now?:number; settings?:MonitoringSettings; }

export function FreightCard({ order, onSelect, now=Date.now(), settings }: FreightCardProps) {
  const timing=deadline(order,now,settings);
  const pct = progress(order);
  const late = timing.state === "late";
  const incident = order.incident;
  const total = order.initial_distance_km ?? order.distance_km;
  const remaining = order.distance_to_destination_km;
  const traveled = total != null && remaining != null ? Math.max(0, total - remaining) : null;

  return (
    <article className={cn("rounded-md border bg-card p-4", incident || order.status === "incident" ? "border-destructive" : late ? "border-warning" : "border-border")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm font-bold text-brand">#{order.code}</p>
          <h2 className="mt-1 text-lg font-bold">{order.client_name || "Cliente não informado"}</h2>
          {order.work?.name && (
            <p className="mt-1 text-xs font-semibold text-brand">
              Obra: {order.work.name}
            </p>
          )}
        </div>
        <span className={cn("rounded-md px-2.5 py-1 text-xs font-bold", incident ? "bg-destructive text-destructive-foreground" : late ? "bg-warning text-warning-foreground" : "bg-primary text-primary-foreground")}>
          {incident ? "Ocorrência" : late ? "Atrasado" : STATUS_LABEL[order.status] ?? order.status}
        </span>
      </div>
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div className="flex items-center gap-2">{order.driver?.photo_url ? <img src={order.driver.photo_url} alt={order.driver.full_name ?? "Motorista"} className="h-10 w-10 rounded-md object-cover"/>:<Truck className="h-4 w-4 text-brand" />}<span><b>{order.driver?.full_name || "Sem motorista"}</b><br /><span className="text-muted-foreground">{[order.vehicle?.brand, order.vehicle?.model, order.vehicle?.plate,order.vehicle?.vehicle_type].filter(Boolean).join(" · ") || "Veículo não definido"}</span></span></div>
        <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-brand" /><span>{order.origin_city || "Origem"}/{order.origin_state || "—"} → {order.destination_city || "Destino"}/{order.destination_state || "—"}</span></div>
      </div>
      {(total != null || remaining != null || pct != null) && <div className="mt-4">
        <div className="mb-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span>{total != null ? `${total.toFixed(0)} km total` : "Distância total indisponível"}</span><span>{traveled != null ? `${traveled.toFixed(0)} km percorridos` : ""}</span><span>{remaining != null ? `${remaining.toFixed(0)} km restantes` : ""}</span></div>
        {pct != null && <progress className="h-2 w-full accent-brand" max={100} value={pct} aria-label={`${pct}% concluído`} />}
      </div>}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <span className="flex items-center gap-1.5"><Clock3 className="h-4 w-4 text-muted-foreground" /> {timing.eta ? `Chegada ${new Date(timing.eta).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"})}`:"Sem previsão confiável"}</span>
        <span className={cn("font-semibold",timing.state==="late" ? "text-destructive":timing.state==="near" || timing.state==="risk" || timing.state==="unreliable" ? "text-warning":"text-muted-foreground")}>{DEADLINE_LABELS[timing.state]}{timing.minutes!=null && timing.state!=="done" && ` · ${timing.minutes} min ${timing.state==="late" || timing.state==="unreliable" ? "de prazo vencido":"até o prazo"}`}</span>
        {pct != null && <span className="font-bold text-brand">{pct}% concluído</span>}
      </div>
      <div className="mt-3 space-y-1 text-sm text-muted-foreground"><p>Coleta: {order.pickup_window_start || order.scheduled_at ? new Date(order.pickup_window_start ?? order.scheduled_at ?? "").toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"}):"Não programada"}</p><p>Entrega prevista: {order.delivery_window_start ? new Date(order.delivery_window_start).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"}):"Não programada"}</p><p>Prazo final: {timing.due ? new Date(timing.due).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"}):"Não definido"}</p>{order.actual_delivery_at && <p>Conclusão: {new Date(order.actual_delivery_at).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"})}</p>}</div>
      {incident && <div className="mt-4 flex items-start gap-2 border-l-4 border-destructive bg-destructive/10 p-3 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" /><div><b>{INCIDENT_LABEL[incident.type] ?? incident.type}</b>{incident.description && <p className="mt-0.5 text-muted-foreground">{incident.description}</p>}</div></div>}
      <div className="mt-4 flex gap-2 border-t border-border pt-3">
        {onSelect && <Button variant="outline" size="sm" onClick={()=>onSelect(order.id)}><MapPin/>Rota</Button>}
        <Button asChild variant="outline" size="sm"><Link to="/ops/pedidos/$id" params={{ id: order.id }}>Ver frete</Link></Button>
        <Button asChild variant="ghost" size="sm"><Link to="/ops/chat" search={{ orderId: order.id }}><MessageSquare /> Chat</Link></Button>
      </div>
    </article>
  );
}