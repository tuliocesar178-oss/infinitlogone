import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BOARD_ROLES, monitoringSchema, DEFAULT_MONITORING, detectAlerts, type TelemetryPoint } from "@/lib/operation-board-monitor";
import type { BoardOrder } from "@/lib/operation-board";
import type { Database } from "@/integrations/supabase/types";

export const getOperationBoard = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const db = context.supabase;
  const { data: allowed, error: accessError } = await db.rpc("can_manage_operation_board", { _user: context.userId });
  if (accessError || !allowed) throw new Error("Acesso não autorizado aos painéis.");
  // Paginate reads; the Data API's default row cap must not truncate KPIs.
  async function readOrders() {
    const result = [];
    for (let offset=0;;offset+=1000) {
      const { data, error } = await db.from("orders").select("*, vehicle:vehicles(id,plate,model,brand,current_lat,current_lng,status,vehicle_type),work:works(name)").is("deleted_at",null).order("id").range(offset,offset+999);
      if(error) throw error; result.push(...(data ?? [])); if((data?.length ?? 0)<1000) break;
    }
    return result;
  }
  const [rawOrders, settingsRes, rolesRes] = await Promise.all([readOrders(), db.from("app_settings").select("value").eq("key","operation_board_monitoring").maybeSingle(), db.from("user_roles").select("user_id,role").in("role",["admin","logistics","supervisor","operacional"])]);
  if(settingsRes.error || rolesRes.error) throw settingsRes.error ?? rolesRes.error;
  const parsed = monitoringSchema.safeParse(settingsRes.data?.value ?? {});
  const settings = parsed.success ? parsed.data : DEFAULT_MONITORING;
  const ids = rawOrders.map(o=>o.id);
  const profileIds = [...new Set([...rawOrders.flatMap(o=>[o.driver_id,o.created_by]).filter((v): v is string=>Boolean(v)),...(rolesRes.data ?? []).map(r=>r.user_id)])];
  const profiles=[]; const deliveries=[]; const events=[]; const incidents: Database["public"]["Tables"]["incidents"]["Row"][]=[];
  for(let i=0;i<profileIds.length;i+=100) {
    const r=await db.from("profiles").select("id,full_name,phone,avatar_url").in("id",profileIds.slice(i,i+100)); if(r.error) throw r.error; profiles.push(...(r.data ?? []));
  }
  for(let i=0;i<ids.length;i+=100) {
    const chunk=ids.slice(i,i+100);
    const delivery=await db.from("deliveries").select("order_id,delivered_at").in("order_id",chunk); if(delivery.error) throw delivery.error; deliveries.push(...(delivery.data ?? []));
    for(let offset=0;;offset+=1000) {
      const r=await db.from("order_events").select("order_id,to_status,created_at").in("order_id",chunk).in("to_status",["delivered","finalized"]).order("created_at").order("id").range(offset,offset+999); if(r.error) throw r.error; events.push(...(r.data ?? [])); if((r.data?.length ?? 0)<1000) break;
    }
    for(let offset=0;;offset+=1000) {
      const r=await db.from("incidents").select("*").in("order_id",chunk).order("created_at",{ascending:false}).order("id").range(offset,offset+999); if(r.error) throw r.error; incidents.push(...(r.data ?? [])); if((r.data?.length ?? 0)<1000) break;
    }
  }
  const profileMap=new Map(profiles.map(p=>[p.id,p]));
  const completion=new Map<string,string>();
  for(const e of events) if(!completion.has(e.order_id)) completion.set(e.order_id,e.created_at);
  for(const d of deliveries) if(d.delivered_at) completion.set(d.order_id,d.delivered_at);
  const orders: BoardOrder[]=rawOrders.map(o=>({ ...o, driver:o.driver_id ? {full_name:profileMap.get(o.driver_id)?.full_name ?? null,phone:profileMap.get(o.driver_id)?.phone ?? null,photo_url:profileMap.get(o.driver_id)?.avatar_url ?? null}:null, responsible:o.created_by ? profileMap.get(o.created_by)?.full_name ?? null:null, incident:incidents.find(i=>i.order_id===o.id && !i.resolved_at) ?? null, actual_delivery_at:o.completed_at ?? completion.get(o.id) ?? null }));
  const activeIds=orders.filter(o=>!["delivered","finalized","cancelled"].includes(o.status)).map(o=>o.id);
  const samples=new Map<string,TelemetryPoint[]>();
  const since=new Date(Date.now()-Math.max(settings.stopMinutes+settings.gpsMinutes+5,settings.confirmationMinutes+5)*60_000).toISOString();
  for(let i=0;i<activeIds.length;i+=100) for(let offset=0;;offset+=1000) {
    const r=await db.from("order_tracking_points").select("order_id,lat,lng,speed,accuracy,created_at").in("order_id",activeIds.slice(i,i+100)).gte("created_at",since).order("created_at").order("id").range(offset,offset+999);
    if(r.error) throw r.error;
    for(const s of r.data ?? []) { const group=samples.get(s.order_id) ?? []; group.push(s); samples.set(s.order_id,group); }
    if((r.data?.length ?? 0)<1000) break;
  }
  const detected=orders.flatMap(o=>detectAlerts(o,samples.get(o.id) ?? [],Date.now(),settings)).filter(a=>!incidents.some(i=>i.order_id===a.order_id && (i.alert_key===a.alert_key || (i.type===a.type && !i.resolved_at) || (i.type===a.type && i.resolved_at && Date.parse(a.metadata.started_at)<=Date.parse(i.resolved_at)))));
  const staffIds=new Set((rolesRes.data ?? []).map(r=>r.user_id));
  return {orders,incidents,detected,settings,staff:profiles.filter(p=>staffIds.has(p.id)).map(p=>({id:p.id,name:p.full_name ?? "Equipe"})),isAdmin:(rolesRes.data ?? []).some(r=>r.user_id===context.userId && r.role==="admin"),updatedAt:new Date().toISOString()};
});

export const syncBoardAlerts = createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).handler(async({context})=>{
  const {data:allowed,error}=await context.supabase.rpc("can_manage_operation_board",{_user:context.userId});
  if(error || !allowed) throw new Error("Acesso não autorizado.");
  // The callable endpoint never trusts client-supplied positions or alert IDs.
  const { getBoardAlertsForSync } = await import("@/lib/operation-board-sync.server");
  const alerts=await getBoardAlertsForSync(context.supabase);
  if(alerts.length) { const r=await context.supabase.rpc("sync_operation_board_alerts",{_alerts:alerts}); if(r.error) throw r.error; }
  return {ok:true};
});
export const manageBoardIncident=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator(z.object({id:z.string().uuid(),action:z.enum(["acknowledge","assign","note","resolve"]),assignedTo:z.string().uuid().nullable().optional(),notes:z.string().max(4000).optional()})).handler(async({data,context})=>{
  const r=await context.supabase.rpc("manage_operation_board_incident",{_id:data.id,_action:data.action,_assigned_to:data.assignedTo ?? undefined,_notes:data.notes});
  if(r.error) throw new Error("Não foi possível atualizar a ocorrência. Verifique as permissões e a observação."); return {ok:true};
});
export const saveBoardSettings=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator(monitoringSchema).handler(async({data,context})=>{
  const role=await context.supabase.rpc("has_role",{_user_id:context.userId,_role:"admin"}); if(role.error || !role.data) throw new Error("Somente a administração pode alterar os limites.");
  const r=await context.supabase.from("app_settings").upsert({key:"operation_board_monitoring",value:data,updated_at:new Date().toISOString(),updated_by:context.userId}); if(r.error) throw r.error; return {ok:true};
});