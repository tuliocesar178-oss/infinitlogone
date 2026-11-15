import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { FreightCard } from "@/components/operation-board/freight-card";
import { supabase } from "@/integrations/supabase/client";
import { Crosshair, Navigation, Trash2, X } from "lucide-react";
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
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const removeRoute = async () => {
    const confirmed = window.confirm(
      `Remover a rota #${order.code} do rastreamento ativo? O histórico do frete será preservado.`,
    );
    if (!confirmed) return;

    setDeleting(true);
    setDeleteError("");
    try {
      const { data, error } = await supabase
        .from("orders")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", order.id)
        .is("deleted_at", null)
        .select("id")
        .maybeSingle();

      if (error) {
        console.error("Falha ao remover rota do rastreamento:", error);
        setDeleteError(
          error.code === "42501"
            ? "Seu perfil não tem permissão para remover esta rota."
            : `Não foi possível remover a rota: ${error.message}`,
        );
        return;
      }

      if (!data) {
        setDeleteError("A rota não foi alterada. Ela já pode ter sido removida ou seu perfil não tem permissão para removê-la.");
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ["operation-board"] });
      onClose();
    } catch {
      setDeleteError("Não foi possível remover a rota. Verifique sua conexão e tente novamente.");
    } finally {
      setDeleting(false);
    }
  };

  return <aside className="min-w-0 space-y-3" aria-label="Detalhes da rota">
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={onFocus}><Crosshair />Centralizar</Button>
      <Button variant={following ? "default" : "outline"} size="sm" onClick={onFollow} aria-pressed={following}><Navigation />Acompanhar</Button>
      <Button variant="destructive" size="icon" aria-label="Remover rota do rastreamento" title="Remover rota do rastreamento" onClick={() => void removeRoute()} disabled={deleting}>
        <Trash2 />
      </Button>
      <Button variant="ghost" size="icon" aria-label="Fechar detalhes da rota" onClick={onClose}><X /></Button>
    </div>
    {deleteError && <p role="alert" className="text-sm text-destructive">{deleteError}</p>}
    <FreightCard order={order} now={now} settings={settings} />
    <div className="space-y-2 text-sm">
      <p><b>Coleta:</b> {order.origin_address}</p><p><b>Entrega:</b> {order.destination_address}</p>
      <p><b>Velocidade:</b> {order.tracking_speed_kmh != null ? `${Math.round(order.tracking_speed_kmh)} km/h` : "Indisponível"}</p>
      <p><b>Direção:</b> {order.tracking_heading != null ? `${Math.round(order.tracking_heading)}°` : "Indisponível"}</p>
      <p><b>Precisão do GPS:</b> {order.tracking_accuracy != null ? `±${Math.round(order.tracking_accuracy)} m` : "Indisponível"}</p>
      <p className="text-muted-foreground">Último GPS: {order.last_ping_at ? new Date(order.last_ping_at).toLocaleString("pt-BR") : "Não recebido"}</p>
      <p className="text-muted-foreground">Posição: {order.current_lat != null && order.current_lng != null ? `${order.current_lat.toFixed(6)}, ${order.current_lng.toFixed(6)}` : "Não disponível"}</p>
    </div>
    {incidents.filter(i => i.order_id === order.id && !i.resolved_at).map(i => <div key={i.id} className="border-l-2 border-destructive pl-3 text-sm">
      <b>{i.type}</b><p>{i.description || "Sem descrição"}</p><p className="text-muted-foreground">{new Date(i.created_at).toLocaleString("pt-BR")}</p>
      <Button asChild variant="link" size="sm"><Link to="/ops/ocorrencias" search={{ incident: i.id }}>Abrir ocorrência</Link></Button>
    </div>)}
  </aside>;
}