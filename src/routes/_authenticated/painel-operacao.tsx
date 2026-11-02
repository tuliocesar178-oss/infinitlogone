import { createFileRoute, redirect } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AlertTriangle, BarChart3, CalendarDays, MapPinned, RotateCcw } from "lucide-react";
import { z } from "zod";
import { getUserRolesCached } from "@/lib/roles";
import { BoardHeader } from "@/components/operation-board/board-header";
import { FreightCard } from "@/components/operation-board/freight-card";
import { BoardKpis } from "@/components/operation-board/board-kpis";
import { BoardAlerts } from "@/components/operation-board/board-alerts";
import { BoardPerformance } from "@/components/operation-board/board-performance";
import { BoardSettings } from "@/components/operation-board/board-settings";
import { OrderDrawer } from "@/components/ops/order-drawer";
import { Button } from "@/components/ui/button";
import { ACTIVE_STATUSES, DELIVERED_STATUSES, priority } from "@/lib/operation-board";
import { BOARD_ROLES, ROTATION_SECONDS, deadline, periodBounds, deliveryPlannedAt, scopedOrders, timestamp, within } from "@/lib/operation-board-monitor";
import { syncBoardAlerts } from "@/lib/operation-board.functions";
import { STATUS_LABEL } from "@/lib/order-status";
import { OperationalMapWorkspace } from "@/components/ops/operational-map-workspace";
import { operationalTrackingQuery, useOperationalTracking } from "@/hooks/use-operational-tracking";
const VIEWS=[{key:"routes",label:"Rotas e entregas",icon:MapPinned},{key:"alerts",label:"Ocorrências",icon:AlertTriangle},{key:"schedule",label:"Programação",icon:CalendarDays},{key:"performance",label:"Desempenho",icon:BarChart3}] as const;
const searchSchema=z.object({panel:z.enum(["routes","alerts","schedule","performance"]).catch("routes"),period:z.enum(["today","tomorrow","week","custom"]).catch("today"),from:z.string().catch(""),to:z.string().catch(""),kpi:z.string().catch("total"),q:z.string().catch(""),client:z.string().catch(""),work:z.string().catch(""),driver:z.string().catch(""),status:z.string().catch(""),category:z.string().catch(""),day:z.string().catch(""),delay:z.string().catch("")});
const boardQuery=operationalTrackingQuery;
export const Route=createFileRoute("/_authenticated/painel-operacao")({
 validateSearch:(search)=>searchSchema.parse(search),
 beforeLoad:async({context})=>{const user=(context as {user?:{id:string}}).user;if(!user)throw redirect({to:"/auth"});const roles=await getUserRolesCached(user.id);if(!roles.some(r=>BOARD_ROLES.includes(r)))throw redirect({to:"/"});},
 loader:({context})=>context.queryClient.ensureQueryData(boardQuery),
 head:()=>({meta:[
      { name: "description", content: 'Painéis Operacionais — INFINITLOG VAPT VUPT. Informações e acompanhamento na plataforma INFINITLOG VAPT VUPT.' },{title:"Painéis Operacionais — INFINITLOG VAPT VUPT"},{name:"description",content:"Central operacional de rotas, entregas, prazos e ocorrências em tempo real."},{property:"og:title",content:"Painéis Operacionais — INFINITLOG VAPT VUPT"},{property:"og:description",content:"Rotas reais, programação de entregas e indicadores da operação."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"},{name:"robots",content:"noindex"}]}),
 component:OperationBoard,
 pendingComponent:()=> <div className="grid min-h-screen place-items-center bg-background text-foreground">Carregando painéis operacionais…</div>,
 errorComponent:()=> <div role="alert" className="p-8 text-destructive">Não foi possível carregar os painéis. <Button variant="outline" onClick={()=>window.location.reload()}>Tentar novamente</Button></div>,
 notFoundComponent:()=> <p className="p-8">Painel indisponível.</p>,
});
function OperationBoard(){
 const query=useSuspenseQuery(boardQuery),data=query.data,qc=useQueryClient(),s=Route.useSearch(),navigate=Route.useNavigate();
 const {user}=Route.useRouteContext();
 const sharedTracking=useOperationalTracking();
 const [now,setNow]=useState(Date.now()),[fullscreen,setFullscreen]=useState(false),[rotation,setRotation]=useState(false),[interval,setIntervalSeconds]=useState(ROTATION_SECONDS),[selected,setSelected]=useState<string|null>(null),[drawer,setDrawer]=useState(false),[fullscreenError,setFullscreenError]=useState("");
 const sync=useServerFn(syncBoardAlerts),syncMutation=useMutation({mutationFn:()=>sync(),onSuccess:()=>qc.invalidateQueries({queryKey:["operation-board"]})});
 const change=(patch:Partial<z.infer<typeof searchSchema>>)=>void navigate({search:prev=>({...prev,...patch}),replace:true});
 useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),1000);const onFull=()=>setFullscreen(Boolean(document.fullscreenElement));document.addEventListener("fullscreenchange",onFull);return()=>{clearInterval(timer);document.removeEventListener("fullscreenchange",onFull);};},[]);

 useEffect(()=>{if(!rotation)return;const t=window.setInterval(()=>{const i=VIEWS.findIndex(v=>v.key===s.panel);change({panel:VIEWS[(i+1)%VIEWS.length].key});},interval*1000);return()=>clearInterval(t);},[rotation,interval,s.panel]);
 useEffect(()=>{const saved=localStorage.getItem(`board-preferences:${user.id}`);if(saved && !window.location.search){try{const stored=JSON.parse(saved);change(searchSchema.parse(stored));}catch{localStorage.removeItem(`board-preferences:${user.id}`);}}},[user.id]);
 useEffect(()=>{localStorage.setItem(`board-preferences:${user.id}`,JSON.stringify(s));},[s,user.id]);
 useEffect(()=>{const t=window.setTimeout(()=>{if(data.detected.some(a=>!data.incidents.some(i=>i.alert_key===a.alert_key || (!i.resolved_at && i.type===a.type && i.order_id===a.order_id))))syncMutation.mutate();},2000);return()=>clearTimeout(t);},[data.updatedAt]);
 const bounds=periodBounds(s.period,now,s.from,s.to);
 const base=data.orders.filter(o=>(!s.client || o.client_name===s.client)&&(!s.work || o.work?.name===s.work)&&(!s.driver || o.driver_id===s.driver)&&(!s.status || o.status===s.status)&&(!s.q || `${o.code} ${o.driver?.full_name ?? ""} ${o.client_name ?? ""} ${o.vehicle?.plate ?? ""} ${o.origin_city ?? ""} ${o.destination_city ?? ""} ${o.origin_state ?? ""} ${o.destination_state ?? ""}`.toLocaleLowerCase("pt-BR").includes(s.q.toLocaleLowerCase("pt-BR"))));
 const periodOrders=scopedOrders(base,bounds),today=periodBounds("today",now);
 const visible=(s.kpi==="today" || s.kpi==="next24" ? base.filter(o=>within(deliveryPlannedAt(o),s.kpi==="today"?today:[now,now+86_400_000])):s.kpi==="unplanned" ? base.filter(o=>deliveryPlannedAt(o)==null&&!DELIVERED_STATUSES.includes(o.status)&&o.status!=="cancelled"):periodOrders).filter(o=>{
 if(s.kpi==="vehicles" && (!ACTIVE_STATUSES.includes(o.status)||!o.vehicle_id))return false;
 if(s.kpi==="drivers" && (!ACTIVE_STATUSES.includes(o.status)||!o.driver_id))return false;
 if(s.kpi==="done" && !DELIVERED_STATUSES.includes(o.status))return false;
 if(s.kpi==="pending" && DELIVERED_STATUSES.includes(o.status))return false;
 if(s.kpi==="late" && deadline(o,now,data.settings).state!=="late")return false;
 if(s.day && ![deliveryPlannedAt(o),timestamp(o.actual_delivery_at)].some(t=>t!=null&&new Date(t).toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo"})===s.day))return false;
 if(s.delay){const a=timestamp(o.actual_delivery_at),due=timestamp(o.delivery_window_end);if(a==null||due==null||a<=due)return false;const m=(a-due)/60000;if(s.delay!== (m<=30?"Até 30 min":m<=120?"31–120 min":"Mais de 2h"))return false;}
 return true;
 }).sort((a,b)=>s.panel==="schedule" ? (deliveryPlannedAt(a)??Infinity)-(deliveryPlannedAt(b)??Infinity):priority(a)-priority(b));
 const shownIncidents=data.incidents.filter(i=>base.some(o=>o.id===i.order_id)&&(!s.category||i.type===s.category));
 const active=visible.filter(o=>ACTIVE_STATUSES.includes(o.status));
 const critical=data.incidents.filter(i=>!i.resolved_at&&i.priority==="critical");
 const missing=base.filter(o=>!DELIVERED_STATUSES.includes(o.status)&&o.status!=="cancelled"&&deliveryPlannedAt(o)==null).length;
 const periodLabel=`${new Date(bounds[0]).toLocaleDateString("pt-BR",{timeZone:"America/Sao_Paulo"})} — ${new Date(bounds[1]-1).toLocaleDateString("pt-BR",{timeZone:"America/Sao_Paulo"})}`;
 const select=(id:string)=>{setSelected(id);setDrawer(false);change({panel:"routes"});};
 async function toggleFullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();setFullscreenError("");}catch{setFullscreenError("O navegador não permitiu tela cheia.");}}
 return <div className="dark min-h-screen bg-background text-foreground"><BoardHeader now={new Date(now)} updatedSeconds={Math.max(0,Math.floor((now-Date.parse(data.updatedAt))/1000))} updatedAt={data.updatedAt} connected={sharedTracking.connected&&!query.isError} fullscreen={fullscreen} rotation={rotation} interval={interval} onFullscreen={()=>void toggleFullscreen()} onRotation={setRotation} onInterval={setIntervalSeconds} onPrevious={()=>{const i=VIEWS.findIndex(v=>v.key===s.panel);change({panel:VIEWS[(i+VIEWS.length-1)%VIEWS.length].key});}}/>
 <main className="space-y-4 p-4 lg:p-6"><nav className="flex flex-wrap gap-2" aria-label="Painéis">{VIEWS.map(v=><Button key={v.key} variant={s.panel===v.key?"default":"outline"} onClick={()=>{setRotation(false);change({panel:v.key});}}><v.icon/>{v.label}</Button>)}<span className="ml-auto flex items-center text-sm text-muted-foreground">{periodLabel}</span>{data.isAdmin&&<BoardSettings settings={data.settings}/>}</nav>
 {(query.isError || !sharedTracking.connected || now-Date.parse(data.updatedAt)>90_000) && <div role="status" className="border-l-4 border-warning bg-warning/10 px-4 py-2 text-warning">Dados temporariamente desatualizados · Última atualização: {new Date(data.updatedAt).toLocaleTimeString("pt-BR",{timeZone:"America/Sao_Paulo"})}</div>}{fullscreenError&&<p role="alert" className="text-warning">{fullscreenError}</p>}{syncMutation.isError&&<p role="alert" className="text-warning">Falha ao registrar alertas automáticos. Nova tentativa na próxima atualização.</p>}
 {critical.length>0&&<div className="flex flex-wrap items-center gap-3 border-l-4 border-destructive bg-destructive/10 px-4 py-2"><AlertTriangle className="text-destructive"/><b>{critical.length} ocorrência(s) crítica(s)</b><Button variant="ghost" size="sm" onClick={()=>change({panel:"alerts"})}>Consultar</Button></div>}
 <BoardKpis orders={periodOrders} allOrders={base} now={now} settings={data.settings} selected={s.kpi} onSelect={k=>{setSelected(null);change({kpi:k,panel:"routes"});}}/>
 <section className="flex flex-wrap gap-2 border-y border-border py-3" aria-label="Filtros"><select aria-label="Período" value={s.period} onChange={e=>change({period:e.target.value as typeof s.period})} className="h-10 rounded-md border border-input bg-background px-3">{[["today","Hoje"],["tomorrow","Amanhã"],["week","Próximos 7 dias"],["custom","Personalizado"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>{s.period==="custom"&&<><input aria-label="Data inicial" type="date" value={s.from} onChange={e=>change({from:e.target.value})} className="h-10 rounded-md border border-input bg-background px-2"/><input aria-label="Data final" type="date" value={s.to} min={s.from} onChange={e=>change({to:e.target.value})} className="h-10 rounded-md border border-input bg-background px-2"/></>}
 <input aria-label="Buscar frete" placeholder="Frete, placa, cidade, estado..." value={s.q} onChange={e=>change({q:e.target.value})} className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3"/>{[{key:"client",label:"Cliente",options:[...new Set(data.orders.map(o=>o.client_name).filter((v):v is string=>Boolean(v)))].map(v=>({value:v,label:v}))},{key:"work",label:"Obra",options:[...new Set(data.orders.map(o=>o.work?.name).filter((v):v is string=>Boolean(v)))].map(v=>({value:v,label:v}))},{key:"driver",label:"Motorista",options:[...new Map(data.orders.filter(o=>o.driver_id).map(o=>[o.driver_id,{value:o.driver_id ?? "",label:o.driver?.full_name ?? "Motorista"}])).values()]},{key:"status",label:"Situação",options:[...new Set(data.orders.map(o=>o.status))].map(v=>({value:v,label:STATUS_LABEL[v] ?? v}))}].map(f=><select key={f.key} aria-label={f.label} value={s[f.key as "client"|"work"|"driver"|"status"]} onChange={e=>change({[f.key]:e.target.value})} className="h-10 max-w-52 rounded-md border border-input bg-background px-2"><option value="">{f.label}: todos</option>{f.options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>)}<Button variant="outline" onClick={()=>{setSelected(null);change(searchSchema.parse({panel:s.panel}));}}><RotateCcw/>Limpar filtros</Button></section>
 {missing>0&&<Button variant="ghost" className="text-warning" onClick={()=>change({kpi:"unplanned",panel:"routes"})}>{missing} frete(s) sem data prevista de entrega</Button>}
 {s.panel==="alerts" ? <BoardAlerts incidents={shownIncidents} orders={base} staff={data.staff} onSelect={select}/> : s.panel==="performance" ? <BoardPerformance orders={base} incidents={shownIncidents} bounds={bounds} period={periodLabel} onFilter={(key,value)=>change({[key]:value,panel:key==="category"?"alerts":"routes",kpi:"total"})}/> : <>
 {s.panel==="routes"&&<OperationalMapWorkspace orders={s.kpi==="total" ? base : visible} selectedId={selected} connection={sharedTracking.connected} clock={now} />}
 <section><h2 className="mb-3 text-xl font-semibold">{s.panel==="schedule"?"Programação de entregas":"Fretes da seleção"} · {visible.length}</h2>{s.panel==="schedule"&&<div className="mb-3 flex flex-wrap gap-2">{[["today","Hoje"],["tomorrow","Amanhã"],["week","Próximos 7 dias"]].map(([v,l])=><Button key={v} variant="outline" onClick={()=>change({period:v as typeof s.period,kpi:"pending"})}>{l}</Button>)}<Button variant="outline" onClick={()=>change({driver:"",status:"awaiting_driver"})}>Sem motorista</Button></div>}<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{visible.map(o=><FreightCard key={o.id} order={o} onSelect={select} now={now} settings={data.settings}/>)}{!visible.length&&<p className="col-span-full py-12 text-center text-xl text-muted-foreground">Nenhum frete nesta seleção.</p>}</div></section></>}
 {drawer&&selected&&<OrderDrawer orderId={selected} onClose={()=>setDrawer(false)}/>}</main></div>;
}
