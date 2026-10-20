import { describe, it, expect } from "vitest";
import { BOARD_ROLES, ROTATION_SECONDS, DEFAULT_MONITORING, boardKpis, deadline, detectAlerts, periodBounds, scopedOrders, type TelemetryPoint } from "../src/lib/operation-board-monitor";
import type { BoardOrder } from "../src/lib/operation-board";
const now=Date.parse("2026-10-20T15:00:00Z");
function order(patch:Partial<BoardOrder>={}):BoardOrder {return {id:"o1",status:"in_transit",delivery_window_start:"2026-10-20T14:00:00Z",delivery_window_end:"2026-10-20T16:00:00Z",last_ping_at:new Date(now).toISOString(),eta_minutes:30,vehicle_id:"v1",driver_id:"d1",created_at:"2026-10-20T10:00:00Z",driver:null,vehicle:null,incident:null,...patch} as BoardOrder;}
describe("TV central business rules",()=>{
 it("starts presentation at 20 seconds",()=>expect(ROTATION_SECONDS).toBe(20));
 it("uses the requested initial 20-minute prolonged stop",()=>expect(DEFAULT_MONITORING.stopMinutes).toBe(20));
 it("counts each freight once and distinct drivers/vehicles",()=>expect(boardKpis([order(),order(),order({id:"o2"})],now)).toMatchObject({total:2,vehicles:1,drivers:1,pending:2,done:0}));
 it("does not count an in-transit delivery as performed",()=>expect(boardKpis([order()],now).done).toBe(0));
 it("never invents contracted deadline from scheduled ETA",()=>expect(deadline(order({delivery_window_end:null,scheduled_at:"2026-10-20T10:00:00Z",estimated_minutes:20}),now).state).toBe("undefined"));
 it("separates risk of future delay from confirmed lateness",()=>{const timing=deadline(order({eta_minutes:120}),now);expect(timing.state).toBe("risk");expect(boardKpis([order({eta_minutes:120})],now).late).toBe(0);});
 it("does not classify expired deadline with old GPS as confirmed late",()=>expect(deadline(order({delivery_window_end:"2026-10-20T14:00:00Z",last_ping_at:"2026-10-20T12:00:00Z"}),now).state).toBe("unreliable"));
 it("anchors estimated arrival to received GPS timestamp",()=>expect(deadline(order({last_ping_at:"2026-10-20T14:59:00Z"}),now).eta).toBe(Date.parse("2026-10-20T15:29:00Z")));
 it("excludes unknown actual completion rather than using updated_at",()=>expect(scopedOrders([order({status:"delivered",updated_at:new Date(now).toISOString(),completed_at:null})],periodBounds("today",now))).toHaveLength(0));
 it("includes real event-derived completion in selected period",()=>expect(scopedOrders([order({status:"delivered",actual_delivery_at:new Date(now).toISOString()})],periodBounds("today",now))).toHaveLength(1));
 it("uses São Paulo day at UTC midnight",()=>expect(periodBounds("today",Date.parse("2026-10-20T01:00:00Z"))[0]).toBe(Date.parse("2026-10-19T03:00:00Z")));
 it("restricts board permissions to operational profiles",()=>{expect(BOARD_ROLES).toEqual(["admin","logistics","supervisor","operacional"]);expect(BOARD_ROLES.includes("driver")).toBe(false);expect(BOARD_ROLES.includes("client")).toBe(false);});
 const samples=(minutes:number,patch:Partial<TelemetryPoint>={}):TelemetryPoint[]=>Array.from({length:minutes+1},(_,i)=>({lat:-23,lng:-46,speed:0,accuracy:10,created_at:new Date(now-(minutes-i)*60000).toISOString(),...patch}));
 it("confirms stop only after 20 minutes of continuous reliable samples",()=>{expect(detectAlerts(order(),samples(19),now).some(a=>a.type==="prolonged_stop")).toBe(false);expect(detectAlerts(order(),samples(20),now).some(a=>a.type==="prolonged_stop")).toBe(true);});
 it("does not treat loading or unknown speed as unjustified stop",()=>{expect(detectAlerts(order({status:"loading"}),samples(25),now).some(a=>a.type==="prolonged_stop")).toBe(false);expect(detectAlerts(order(),samples(25,{speed:null}),now).some(a=>a.type==="prolonged_stop")).toBe(false);});
 it("rejects imprecise GPS for deviation and stop detection",()=>expect(detectAlerts(order(),samples(25,{accuracy:150}),now).some(a=>["prolonged_stop","route_deviation"].includes(a.type))).toBe(false));
 it("requires sustained deviation beyond configurable tolerance",()=>{const o=order({route_geometry:JSON.stringify({type:"LineString",coordinates:[[-46,-23],[-45.9,-23]]})});expect(detectAlerts(o,samples(1,{lat:-23.02,speed:40}),now).some(a=>a.type==="route_deviation")).toBe(false);expect(detectAlerts(o,samples(3,{lat:-23.02,speed:40}),now).some(a=>a.type==="route_deviation")).toBe(true);expect(detectAlerts(o,samples(3,{lat:-23.0001,speed:40}),now).some(a=>a.type==="route_deviation")).toBe(false);});
 it("gives stale GPS episode stable identity on polling",()=>{const o=order({last_ping_at:"2026-10-20T14:00:00Z"});expect(detectAlerts(o,[],now)[0].alert_key).toBe(detectAlerts(o,[],now+30000)[0].alert_key);});
});