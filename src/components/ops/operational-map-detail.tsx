import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { FreightCard } from "@/components/operation-board/freight-card";
import { Crosshair, Navigation, X } from "lucide-react";
import type { BoardOrder } from "@/lib/operation-board";
import type { MonitoringSettings } from "@/lib/operation-board-monitor";

export interface OperationalMapDetailProps {
  order: BoardOrder;
  now: number;
  settings: MonitoringSettings;
  following: boolean;
  onFocus: () => void;
  onFollow: () => void;
  onClose: () => void;
  incidents: { id: string; order_id: string; type: string; description: string | null; created_at: string; resolved_at: string | null }[];
}
export function OperationalMapDetail({ order, now, settings, following, onFocus, onFollow, onClose, incidents }: OperationalMapDetailProps) {
  return <aside className="min-w-0 space-y-3" aria-label="Detalhes da rota">
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={onFocus}><Crosshair />Centralizar</Button>
      <Button variant={following ? "default" : "outline"} size="sm" onClick={onFollow} aria-pressed={following}><Navigation />Acompanhar</Button>
      <Button variant="ghost" size="icon" aria-label="Fechar detalhes da rota" onClick={onClose}><X /></Button>
    </div>
    <FreightCard order={order} now={now} settings={settings} />
    <div className="space-y-2 text-sm">
      {order.vehicle?.photo_url && <img src={order.vehicle.photo_url} alt="Veículo do frete" className="h-24 w-40 rounded-md object-cover" />}
      <p><b>Coleta:</b> {order.origin_address}</p><p><b>Entrega:</b> {order.destination_address}</p>
      <p>Rota planejada: {order.distance_km != null ? `${order.distance_km.toLocaleString("pt-BR")} km` : "Indisponível"}</p>
      <p className="text-muted-foreground">Último GPS: {order.last_ping_at ? new Date(order.last_ping_at).toLocaleString("pt-BR") : "Não recebido"}</p>
      <p className="text-muted-foreground">Posição: {order.current_lat != null && order.current_lng != null ? `${order.current_lat.toFixed(6)}, ${order.current_lng.toFixed(6)}` : "Não disponível"}</p>
    </div>
    {incidents.filter(i => i.order_id === order.id && !i.resolved_at).map(i => <div key={i.id} className="border-l-2 border-destructive pl-3 text-sm">
      <b>{i.type}</b><p>{i.description || "Sem descrição"}</p><p className="text-muted-foreground">{new Date(i.created_at).toLocaleString("pt-BR")}</p>
      <Button asChild variant="link" size="sm"><Link to="/ops/ocorrencias" search={{ incident: i.id }}>Abrir ocorrência</Link></Button>
    </div>)}
  </aside>;
}