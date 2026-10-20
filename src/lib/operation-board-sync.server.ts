import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { monitoringSchema, DEFAULT_MONITORING, detectAlerts, type TelemetryPoint } from "@/lib/operation-board-monitor";
import { ACTIVE_STATUSES, type BoardOrder } from "@/lib/operation-board";

export async function getBoardAlertsForSync(db: SupabaseClient<Database>) {
  const config=await db.from("app_settings").select("value").eq("key","operation_board_monitoring").maybeSingle(); if(config.error) throw config.error;
  const parsed=monitoringSchema.safeParse(config.data?.value ?? {}); const settings=parsed.success ? parsed.data:DEFAULT_MONITORING;
  const rows=[];
  for(let offset=0;;offset+=1000) { const r=await db.from("orders").select("*").is("deleted_at",null).in("status",ACTIVE_STATUSES as Database["public"]["Enums"]["order_status"][]).order("id").range(offset,offset+999); if(r.error) throw r.error; rows.push(...(r.data ?? [])); if((r.data?.length ?? 0)<1000) break; }
  const alerts=[];
  for(const row of rows) {
    const samples: TelemetryPoint[]=[];
    for(let offset=0;;offset+=1000) { const r=await db.from("order_tracking_points").select("lat,lng,speed,accuracy,created_at").eq("order_id",row.id).gte("created_at",new Date(Date.now()-3*60*60_000).toISOString()).order("created_at").order("id").range(offset,offset+999); if(r.error) throw r.error; samples.push(...(r.data ?? [])); if((r.data?.length ?? 0)<1000) break; }
    const existing=await db.from("incidents").select("type,alert_key,resolved_at,alert_metadata").eq("order_id",row.id).not("alert_key","is",null); if(existing.error) throw existing.error;
    const detected=detectAlerts({...row,driver:null,vehicle:null,incident:null} as BoardOrder,samples,Date.now(),settings);
    alerts.push(...detected.filter(a=>!(existing.data ?? []).some(i=>i.alert_key===a.alert_key || (!i.resolved_at && i.type===a.type))));
  }
  return alerts.slice(0,500);
}