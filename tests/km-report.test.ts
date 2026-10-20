import { describe, expect, it } from "vitest";
import {
  bucketKey,
  bucketRange,
  buildEvolution,
  buildWorkStats,
  compareKm,
  countedKm,
  previousPeriod,
  type KmOrder,
} from "../src/lib/km-report";

function order(partial: Partial<KmOrder>): KmOrder {
  return {
    id: partial.id ?? "o1",
    code: partial.code ?? "PED-1",
    work_id: "work_id" in partial ? (partial.work_id ?? null) : "w1",
    client_name: partial.client_name ?? "Cliente",
    status: partial.status ?? "delivered",
    created_at: partial.created_at ?? "2026-10-05T10:00:00",
    origin_city: null,
    origin_state: null,
    destination_city: null,
    destination_state: null,
    distance_km: partial.distance_km ?? null,
    recorded_distance_km: partial.recorded_distance_km ?? null,
    antt_distance_km: partial.antt_distance_km ?? null,
    driver_id: partial.driver_id ?? null,
    vehicle_id: partial.vehicle_id ?? null,
  };
}

describe("countedKm", () => {
  it("prefere o KM efetivo medido no frete", () => {
    const result = countedKm(
      order({ recorded_distance_km: 120.5, distance_km: 100, antt_distance_km: 90 }),
    );
    expect(result).toEqual({ km: 120.5, estimated: false });
  });

  it("usa o KM planejado como estimado quando não há medição", () => {
    expect(countedKm(order({ distance_km: 100, antt_distance_km: 90 }))).toEqual({
      km: 100,
      estimated: true,
    });
    expect(countedKm(order({ antt_distance_km: 90 }))).toEqual({ km: 90, estimated: true });
    expect(countedKm(order({}))).toEqual({ km: 0, estimated: true });
  });
});

describe("previousPeriod", () => {
  it("retorna o período equivalente imediatamente anterior", () => {
    expect(previousPeriod("2026-10-01", "2026-10-20")).toEqual({
      from: "2026-09-11",
      to: "2026-09-30",
    });
  });

  it("um único dia compara com o dia anterior", () => {
    expect(previousPeriod("2026-10-20", "2026-10-20")).toEqual({
      from: "2026-10-19",
      to: "2026-10-19",
    });
  });
});

describe("bucketKey e bucketRange", () => {
  it("agrupa por dia e mês", () => {
    expect(bucketKey("2026-10-05T10:00:00", "day")).toBe("2026-10-05");
    expect(bucketKey("2026-10-05T10:00:00", "month")).toBe("2026-10");
  });

  it("semana começa na segunda-feira", () => {
    // 2026-10-05 é segunda; 2026-10-11 é domingo da mesma semana.
    expect(bucketKey("2026-10-11T10:00:00", "week")).toBe("2026-10-05");
    expect(bucketKey("2026-10-12T10:00:00", "week")).toBe("2026-10-12");
  });

  it("preenche todas as lacunas do intervalo", () => {
    expect(bucketRange("2026-10-01", "2026-10-03", "day")).toEqual([
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
    ]);
  });
});

describe("buildWorkStats", () => {
  it("consolida por obra sem duplicar fretes", () => {
    const stats = buildWorkStats([
      order({ id: "a", work_id: "w1", recorded_distance_km: 100, driver_id: "d1" }),
      order({ id: "b", work_id: "w1", distance_km: 50, driver_id: "d1", vehicle_id: "v1" }),
      order({ id: "c", work_id: "w2", recorded_distance_km: 30 }),
      order({ id: "d", work_id: null, recorded_distance_km: 999 }),
    ]);
    const w1 = stats.get("w1")!;
    expect(w1.km).toBe(150);
    expect(w1.estimatedKm).toBe(50);
    expect(w1.freights).toBe(2);
    expect(w1.drivers.size).toBe(1);
    expect(w1.vehicles.size).toBe(1);
    expect(stats.get("w2")!.km).toBe(30);
    expect(stats.has("null")).toBe(false);
    expect(stats.size).toBe(2);
  });

  it("guarda a data do último frete", () => {
    const stats = buildWorkStats([
      order({ id: "a", created_at: "2026-10-01T10:00:00" }),
      order({ id: "b", created_at: "2026-10-09T10:00:00" }),
    ]);
    expect(stats.get("w1")!.lastAt).toBe("2026-10-09T10:00:00");
  });
});

describe("compareKm", () => {
  it("calcula variação absoluta e percentual", () => {
    expect(compareKm(150, 100)).toEqual({ abs: 50, pct: 50 });
    expect(compareKm(80, 100).pct).toBeCloseTo(-20);
  });

  it("sem base anterior não há percentual", () => {
    expect(compareKm(100, 0)).toEqual({ abs: 100, pct: null });
  });
});

describe("buildEvolution", () => {
  it("soma KM por bucket e preenche dias sem frete com zero", () => {
    const rows = buildEvolution(
      [
        order({ id: "a", work_id: "w1", recorded_distance_km: 10, created_at: "2026-10-01T08:00:00" }),
        order({ id: "b", work_id: "w1", recorded_distance_km: 5, created_at: "2026-10-01T20:00:00" }),
        order({ id: "c", work_id: "w2", recorded_distance_km: 99, created_at: "2026-10-01T09:00:00" }),
      ],
      ["w1"],
      "day",
      "2026-10-01",
      "2026-10-03",
    );
    expect(rows).toEqual([
      { bucket: "2026-10-01", w1: 15 },
      { bucket: "2026-10-02", w1: 0 },
      { bucket: "2026-10-03", w1: 0 },
    ]);
  });
});
