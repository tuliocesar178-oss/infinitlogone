import { COMMERCIAL_ORDERS } from "@/lib/order-projections";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { monitoringSchema, DEFAULT_MONITORING, detectAlerts, type TelemetryPoint } from "@/lib/operation-board-monitor";
import { ACTIVE_STATUSES, type BoardOrder } from "@/lib/operation-board";

export async function getBoardAlertsForSync(db: SupabaseClient<Database>) {
  const config=await db.from("app_settings").select("value").eq("key","operation_board_monitoring").maybeSingle(); if(config.error) throw config.error;
  const parsed=monitoringSchema.safeParse(config.data?.value ?? {}); const settings=parsed.success ? parsed.data:DEFAULT_MONITORING;
  const rows=[];
  for(let offset=0;;offset+=1000) { const r=await db.from(COMMERCIAL_ORDERS).select("*").is("deleted_at",null).in("status",ACTIVE_STATUSES as Database["public"]["Enums"]["order_status"][]).order("id").range(offset,offset+999); if(r.error) throw r.error; rows.push(...(r.data ?? [])); if((r.data?.length ?? 0)<1000) break; }
  const alerts=[];
  const samplesByOrder=new Map<string,TelemetryPoint[]>();
  const existing: Pick<Database["public"]["Tables"]["incidents"]["Row"],"order_id"|"type"|"alert_key"|"resolved_at"|"alert_metadata">[]=[];
  const since=new Date(Date.now()-Math.max(settings.stopMinutes+settings.gpsMinutes+5,settings.confirmationMinutes+5)*60_000).toISOString();
  const ids=rows.map(r=>r.id);
  for(let i=0;i<ids.length;i+=100) {
    const chunk=ids.slice(i,i+100);
    for(let offset=0;;offset+=1000) {const r=await db.from("order_tracking_points").select("order_id,lat,lng,speed,accuracy,created_at").in("order_id",chunk).gte("created_at",since).order("created_at").order("id").range(offset,offset+999);if(r.error)throw r.error;for(const s of r.data ?? []){const group=samplesByOrder.get(s.order_id) ?? [];group.push(s);samplesByOrder.set(s.order_id,group);}if((r.data?.length ?? 0)<1000)break;}
    for(let offset=0;;offset+=1000) {const r=await db.from("incidents").select("order_id,type,alert_key,resolved_at,alert_metadata").in("order_id",chunk).not("alert_key","is",null).order("id").range(offset,offset+999);if(r.error)throw r.error;existing.push(...(r.data ?? []));if((r.data?.length ?? 0)<1000)break;}
  }
  for(const row of rows) {
    const samples=samplesByOrder.get(row.id) ?? [];
    const detected=detectAlerts({...row,driver:null,vehicle:null,incident:null} as BoardOrder,samples,Date.now(),settings);
    alerts.push(...detected.filter(a=>!existing.some(i=>i.order_id===row.id && (i.alert_key===a.alert_key || (!i.resolved_at && i.type===a.type) || (i.resolved_at && i.type===a.type && Date.parse(a.metadata.started_at)<=Date.parse(i.resolved_at))))));
  }
  return alerts.slice(0,500);
}