import { describe, expect, it } from "bun:test";
import { authorizedTrackingOrder, hasActiveDriverRoute, savedTrackingRoute, selectedTrackingOrder, trackingPoint, trackingStage, type TrackingRouteOrder } from "../src/lib/tracking-route-model";
const base: TrackingRouteOrder = { id: "frete-1", driver_id: "motorista-1", status: "in_transit", origin_lat: -23, origin_lng: -46, destination_lat: -22, destination_lng: -45, route_geometry: JSON.stringify({ type: "LineString", coordinates: [[-46,-23],[-45.8,-22.7],[-45,-22]] }) };
describe("seleção de rota no rastreamento", () => {
  it("mantém o frete selecionado quando o GPS é atualizado", () => {
    const updated = { ...base, current_lat: -22.8 };
    expect(selectedTrackingOrder([updated], "frete-1")).toBe(updated);
  });
  it("troca o frete sem misturar trajetos do mesmo motorista", () => {
    const other = { ...base, id: "frete-2" };
    expect(selectedTrackingOrder([base, other], "frete-2")).toBe(other);
  });
  it("fechar a seleção retorna à visão geral", () => expect(selectedTrackingOrder([base], null)).toBeNull());
  it("cliente não pode acessar frete de outro cliente mesmo com ID válido", () => {
    expect(authorizedTrackingOrder("cliente-2", "cliente-1", false)).toBe(false);
    expect(authorizedTrackingOrder("cliente-1", "cliente-1", false)).toBe(true);
  });
  it("equipe autorizada pode visualizar fretes da operação", () => expect(authorizedTrackingOrder("cliente-2", "equipe", true)).toBe(true));
  it("frete sem motorista, aguardando aceite, concluído ou cancelado não é rota ativa", () => {
    expect(hasActiveDriverRoute({ ...base, driver_id: null })).toBe(false);
    for (const status of ["awaiting_driver","negotiating","delivered","finalized","cancelled"]) expect(savedTrackingRoute({ ...base, status })).toBeNull();
  });
  it("prioriza coleta antes do carregamento e entrega após coleta", () => {
    expect(trackingStage({ status: "en_route_pickup" })).toBe("pickup");
    expect(trackingStage({ status: "loaded" })).toBe("delivery");
  });
  it("reutiliza geometria rodoviária e não inventa rota ausente", () => {
    expect(savedTrackingRoute(base)?.coordinates).toHaveLength(3);
    expect(savedTrackingRoute({ ...base, route_geometry: "inválida" })).toBeNull();
    expect(trackingPoint(null, -46)).toBeNull();
  });
});