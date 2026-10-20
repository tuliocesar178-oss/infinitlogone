import { Package, Truck, Users, CheckCircle2, Clock3, AlertTriangle, CalendarDays, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { boardKpis, type MonitoringSettings } from "@/lib/operation-board-monitor";
import type { BoardOrder } from "@/lib/operation-board";
export const KPI_ITEMS = [
  {key:"total",label:"Entregas do período",icon:Package,definition:"Fretes únicos programados ou concluídos no período."},
  {key:"vehicles",label:"Veículos em rota",icon:Truck,definition:"Veículos distintos atribuídos a fretes ativos no período."},
  {key:"drivers",label:"Motoristas em operação",icon:Users,definition:"Motoristas distintos em fretes ativos no período."},
  {key:"done",label:"Entregas realizadas",icon:CheckCircle2,definition:"Fretes entregues ou finalizados com conclusão real no período."},
  {key:"pending",label:"Entregas pendentes",icon:Clock3,definition:"Fretes do período não concluídos, sem cancelados."},
  {key:"late",label:"Entregas em atraso",icon:AlertTriangle,definition:"Prazo contratado vencido com atualização GPS confiável."},
  {key:"today",label:"Previstas hoje",icon:CalendarDays,definition:"Data prevista de entrega cadastrada no dia de hoje."},
  {key:"next24",label:"Próximas 24 horas",icon:CalendarClock,definition:"Data prevista cadastrada entre agora e as próximas 24 horas."},
] as const;
export type KpiKey=typeof KPI_ITEMS[number]["key"];
export function BoardKpis({orders,allOrders,now,settings,selected,onSelect}:{orders:BoardOrder[];allOrders:BoardOrder[];now:number;settings:MonitoringSettings;selected:string;onSelect:(key:KpiKey)=>void}) {
  const values=boardKpis(orders,now,settings), global=boardKpis(allOrders,now,settings);
  return <section aria-label="Indicadores de entregas" className="grid grid-cols-2 gap-2 md:grid-cols-4 2xl:grid-cols-8">{KPI_ITEMS.map(k=><Button key={k.key} variant="outline" title={k.definition} aria-pressed={selected===k.key} onClick={()=>onSelect(k.key)} className={cn("h-auto min-h-28 flex-col items-start justify-between whitespace-normal rounded-md p-4 text-left",selected===k.key && "border-brand bg-accent",k.key==="late" && "text-destructive")}><span className="flex items-center gap-2 text-sm font-semibold"><k.icon className="h-5 w-5 shrink-0"/>{k.label}</span><span className="mt-3 text-4xl font-bold tabular-nums">{k.key==="today" || k.key==="next24" ? global[k.key]:values[k.key]}</span></Button>)}</section>;
}