import { z } from "zod";
import nearestPointOnLine from "@turf/nearest-point-on-line";
import { lineString, point } from "@turf/helpers";
import distance from "@turf/distance";
import { geometrySchema } from "@/lib/navigation/map-route";
import { ACTIVE_STATUSES, DELIVERED_STATUSES, type BoardOrder } from "@/lib/operation-board";

export const BOARD_ROLES = ["admin", "logistics", "supervisor", "operacional"];
export const ROTATION_SECONDS = 20;
export const monitoringSchema = z.object({
  stopMinutes: z.number().int().min(5).max(120).default(20),
  gpsMinutes: z.number().int().min(1).max(60).default(3),
  deviationMeters: z.number().min(100).max(5000).default(300),
  confirmationMinutes: z.number().min(1).max(30).default(2),
  accuracyMeters: z.number().min(10).max(200).default(50),
  movementMeters: z.number().min(20).max(500).default(100),
  deadlineMinutes: z.number().int().min(5).max(240).default(60),
});
export type MonitoringSettings = z.infer<typeof monitoringSchema>;
export const DEFAULT_MONITORING = monitoringSchema.parse({});
export type TelemetryPoint = { created_at: string; lat: number; lng: number; speed: number | null; accuracy: number | null };
export type DeadlineState = "undefined" | "on_time" | "near" | "risk" | "late" | "unreliable" | "done";
export const DEADLINE_LABELS: Record<DeadlineState, string> = { undefined: "Prazo não definido", on_time: "No prazo", near: "Prazo próximo", risk: "Risco de atraso", late: "Em atraso", unreliable: "Prazo vencido sem atualização confiável", done: "Concluída" };
export function timestamp(value?: string | null): number | null {
  if (!value) return null;
  const result = Date.parse(value);
  return Number.isFinite(result) ? result : null;
}
export function gpsFresh(order: Pick<BoardOrder, "last_ping_at">, now: number, settings = DEFAULT_MONITORING) {
  const ping = timestamp(order.last_ping_at);
  return ping != null && ping <= now + 30_000 && now - ping <= settings.gpsMinutes * 60_000;
}
export function deadline(order: BoardOrder, now: number, settings = DEFAULT_MONITORING) {
  const due = timestamp(order.delivery_window_end);
  const ping = timestamp(order.last_ping_at);
  const eta = gpsFresh(order, now, settings) && ping != null && order.eta_minutes != null && order.eta_minutes >= 0 ? ping + order.eta_minutes * 60_000 : null;
  const state: DeadlineState = DELIVERED_STATUSES.includes(order.status) ? "done" : due == null ? "undefined" : now > due ? gpsFresh(order, now, settings) ? "late" : "unreliable" : eta != null && eta > due ? "risk" : due - now <= settings.deadlineMinutes * 60_000 ? "near" : "on_time";
  return { due, eta, state, minutes: due == null ? null : Math.ceil(Math.abs(due - now) / 60_000) };
}
export function routeGeometry(raw?: string | null): GeoJSON.LineString | null {
  if (!raw) return null;
  try { const result = geometrySchema.safeParse(JSON.parse(raw)); return result.success ? result.data : null; } catch { return null; }
}
export function saoDay(now: number) { return new Date(now).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }); }
export function periodBounds(period: string, now: number, from = "", to = ""): [number, number] {
  const start = Date.parse(`${saoDay(now)}T00:00:00-03:00`);
  if (period === "tomorrow") return [start + 86_400_000, start + 2 * 86_400_000];
  if (period === "week") return [start, start + 7 * 86_400_000];
  if (period === "custom") {
    const a = timestamp(`${from}T00:00:00-03:00`), b = timestamp(`${to}T00:00:00-03:00`);
    if (a != null && b != null && b >= a) return [a, b + 86_400_000];
  }
  return [start, start + 86_400_000];
}
export const deliveryPlannedAt = (order: BoardOrder) => timestamp(order.delivery_window_start) ?? timestamp(order.delivery_window_end);
export function within(value: number | null, bounds: [number, number]) { return value != null && value >= bounds[0] && value < bounds[1]; }
export function scopedOrders(orders: BoardOrder[], bounds: [number, number]) {
  return [...new Map(orders.filter(o => o.status !== "cancelled").map(o => [o.id, o])).values()].filter(o => within(DELIVERED_STATUSES.includes(o.status) ? timestamp(o.actual_delivery_at ?? o.completed_at) : deliveryPlannedAt(o), bounds));
}
export function boardKpis(orders: BoardOrder[], now: number, settings = DEFAULT_MONITORING) {
  const unique = [...new Map(orders.map(o => [o.id, o])).values()];
  const active = unique.filter(o => ACTIVE_STATUSES.includes(o.status));
  const done = unique.filter(o => DELIVERED_STATUSES.includes(o.status));
  const today = periodBounds("today", now);
  return { total: unique.length, vehicles: new Set(active.map(o => o.vehicle_id).filter(Boolean)).size, drivers: new Set(active.map(o => o.driver_id).filter(Boolean)).size, done: done.length, pending: unique.filter(o => !DELIVERED_STATUSES.includes(o.status) && o.status !== "cancelled").length, late: unique.filter(o => deadline(o, now, settings).state === "late").length, today: unique.filter(o => within(deliveryPlannedAt(o), today)).length, next24: unique.filter(o => within(deliveryPlannedAt(o), [now, now + 86_400_000])).length };
}
export type DetectedAlert = { order_id: string; type: string; description: string; severity: "high" | "medium"; alert_key: string; metadata: { started_at: string; distance_m?: number; minutes?: number } };
export function detectAlerts(order: BoardOrder, samples: TelemetryPoint[], now: number, settings = DEFAULT_MONITORING): DetectedAlert[] {
  if (!ACTIVE_STATUSES.includes(order.status)) return [];
  const alerts: DetectedAlert[] = [];
  const add = (type: string, started: number, description: string, severity: "high" | "medium", extra: { distance_m?: number; minutes?: number } = {}) => alerts.push({ order_id: order.id, type, description, severity, alert_key: `${order.id}:${type}:${new Date(started).toISOString()}`, metadata: { started_at: new Date(started).toISOString(), ...extra } });
  const ping = timestamp(order.last_ping_at);
  if (!gpsFresh(order, now, settings)) {
    const base = ping ?? timestamp(order.started_at) ?? timestamp(order.started_trip_at) ?? timestamp(order.created_at);
    if (base != null && now - base >= settings.gpsMinutes * 60_000) add("gps_lost", base, ping == null ? "Nenhuma posição GPS recebida" : `Sem atualização GPS há ${Math.floor((now - base) / 60_000)} min`, "medium");
    return alerts;
  }
  const timing = deadline(order, now, settings);
  if (timing.due != null && timing.state === "late") add("delivery_late", timing.due, `Entrega atrasada há ${timing.minutes} min`, "high", { minutes: timing.minutes ?? 0 });
  if (timing.due != null && (timing.state === "near" || timing.state === "risk")) add("deadline_near", timing.due, timing.state === "risk" ? "Previsão atual ultrapassa o prazo contratado" : `Prazo vence em ${timing.minutes} min`, "medium");
  // Invalid/low-quality readings break continuity instead of being silently skipped.
  const sorted = [...samples].sort((a,b) => Date.parse(a.created_at)-Date.parse(b.created_at));
  const valid = (s: TelemetryPoint) => timestamp(s.created_at) != null && Date.parse(s.created_at) <= now + 30_000 && Number.isFinite(s.lat) && Math.abs(s.lat)<=90 && Number.isFinite(s.lng) && Math.abs(s.lng)<=180 && s.accuracy != null && s.accuracy >= 0 && s.accuracy <= settings.accuracyMeters;
  const tail: TelemetryPoint[] = [];
  for (let i=sorted.length-1;i>=0;i--) { const s=sorted[i]; const newer=tail[0]; if (!valid(s) || (newer && Date.parse(newer.created_at)-Date.parse(s.created_at)>Math.min(settings.gpsMinutes*60_000,90_000))) break; tail.unshift(s); }
  const latest=tail.at(-1);
  if (!latest || now-Date.parse(latest.created_at)>settings.gpsMinutes*60_000) return alerts;
  const operational=["at_pickup","loading","at_destination","unloading"].includes(order.status);
  if (!operational) {
    const stopped: TelemetryPoint[]=[];
    for(let i=tail.length-1;i>=0;i--) { const s=tail[i]; if(s.speed==null || s.speed<0 || s.speed>=3 || distance(point([s.lng,s.lat]),point([latest.lng,latest.lat]))*1000>settings.movementMeters) break; stopped.unshift(s); }
    const first=stopped[0];
    if(first && stopped.length>=2 && Date.parse(latest.created_at)-Date.parse(first.created_at)>=settings.stopMinutes*60_000) add("prolonged_stop",Date.parse(first.created_at),"Parada prolongada sem justificativa registrada", "medium", {minutes:Math.floor((Date.parse(latest.created_at)-Date.parse(first.created_at))/60_000)});
  }
  const geometry=routeGeometry(order.route_geometry);
  if(geometry && !operational) {
    const deviating: TelemetryPoint[]=[]; let meters=0;
    for(let i=tail.length-1;i>=0;i--) { const s=tail[i]; const d=Number(nearestPointOnLine(lineString(geometry.coordinates),point([s.lng,s.lat])).properties.dist)*1000; if(!Number.isFinite(d) || d<=settings.deviationMeters+(s.accuracy ?? 0)) break; if(i===tail.length-1) meters=d; deviating.unshift(s); }
    const first=deviating[0];
    if(first && deviating.length>=2 && Date.parse(latest.created_at)-Date.parse(first.created_at)>=settings.confirmationMinutes*60_000) add("route_deviation",Date.parse(first.created_at),`Desvio confirmado: ${Math.round(meters)} m do itinerário`,"high",{distance_m:Math.round(meters)});
  }
  return alerts;
}