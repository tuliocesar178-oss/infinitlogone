import { describe, it, expect } from "vitest";
import { activeTrackingOrders, filterTrackingOrders, operationalState, trackingPosition, trackingRoutes } from "../src/lib/operational-tracking";
import { DEFAULT_MONITORING } from "../src/lib/operation-board-monitor";
import type { BoardOrder } from "../src/lib/operation-board";
const now = Date.parse("2026-11-02T19:51:00Z");
function order(patch: Partial<BoardOrder> = {}): BoardOrder {
  return { id: "o1", driver_id: "d1", status: "in_transit", code: "PED-1", driver: { full_name: "Alessandro", phone: null }, vehicle: null, incident: null, last_ping_at: new Date(now).toISOString(), delivery_window_end: null, ...patch } as BoardOrder;
}
describe("mapa operacional compartilhado", () => {
  it("exclui concluídos, cancelados e finalizados legados de rotas ativas", () => expect(activeTrackingOrders([order(), order({ id: "o2", status: "delivered" }), order({ id: "o3", status: "finalized" }), order({ id: "o4", status: "cancelled" }), order({ id: "o5", status: "completed" })]).map(o => o.id)).toEqual(["o1"]));
  it("não conta fretes sem motorista nem duplicatas", () => expect(activeTrackingOrders([order(), order(), order({ id: "o2", driver_id: null })])).toHaveLength(1));
  it("GPS antigo não prova parada ou atraso confirmado", () => expect(operationalState(order({ last_ping_at: "2026-11-02T18:00:00Z", delivery_window_end: "2026-11-02T19:00:00Z" }), now, DEFAULT_MONITORING)).toEqual({ late: false, stale: true, incident: false }));
  it("atraso exige prazo vencido e GPS confiável", () => expect(filterTrackingOrders([order({ delivery_window_end: "2026-11-02T19:00:00Z" }), order({ id: "o2", last_ping_at: null })], "late", "", now, DEFAULT_MONITORING).map(o => o.id)).toEqual(["o1"]));
  it("pesquisa nome do motorista", () => expect(filterTrackingOrders([order()], "all", "alessandro", now, DEFAULT_MONITORING)).toHaveLength(1));
  it("pesquisa placa e código reais", () => { const o = order({ vehicle: { plate: "ABC1D23" } as BoardOrder["vehicle"] }); expect(filterTrackingOrders([o], "all", "abc1d23", now, DEFAULT_MONITORING)).toHaveLength(1); expect(filterTrackingOrders([o], "all", "PED-2", now, DEFAULT_MONITORING)).toHaveLength(0); });
  it("mantém todas as geometrias reais e não inventa as ausentes", () => expect(trackingRoutes([order({ route_geometry: JSON.stringify({ type: "LineString", coordinates: [[-46, -23], [-45, -22]] }) }), order({ id: "o2", route_geometry: null })], now, DEFAULT_MONITORING).map(r => r.id)).toEqual(["o1"]));
  it("não mistura longitude do motorista com latitude do pedido", () => expect(trackingPosition({ current_lat: -23, current_lng: null, last_ping_at: "order-ping" }, { current_lat: -22, current_lng: -44, last_seen_at: "driver-ping" })).toEqual({ current_lat: -22, current_lng: -44, last_ping_at: "driver-ping" }));
  it("posição do pedido mantém o horário da mesma origem", () => expect(trackingPosition({ current_lat: -23, current_lng: -46, last_ping_at: "order-ping" }, { current_lat: -22, current_lng: -44, last_seen_at: "driver-ping" }).last_ping_at).toBe("order-ping"));
  it("sem coordenadas não cria posição em zero", () => expect(trackingPosition({ current_lat: null, current_lng: null, last_ping_at: null })).toEqual({ current_lat: null, current_lng: null, last_ping_at: null }));
});