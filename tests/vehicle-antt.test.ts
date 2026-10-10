import { describe, expect, test } from "bun:test";
import { buildFreightConfigurations, calculateConfigurationFloors, isBodyCompatible } from "../src/lib/vehicle-antt";
import type { AnttCalculation } from "../src/lib/antt";

const vehicles = [
  { id: "one", vehicle_type: "Carreta", axles: 5, capacity_kg: 26000, body_type: "Baú" },
  { id: "two", vehicle_type: "Carreta LS", axles: 6, capacity_kg: 33000, body_type: "Sider" },
  { id: "three", vehicle_type: "Carreta", axles: 5, capacity_kg: 26000, body_type: "Sider" },
];
const input = { distance_km: 400, cargo_class: "carga_geral", contract_type: "composicao" as const, high_performance: false, operation_type: "lotacao" as const };
describe("Vehicle ANTT comparison rules", () => {
  test("unknown names never invent axle counts", () => {
    const options = buildFreightConfigurations([]);
    expect(options).toHaveLength(7);
    expect(options.every((option) => option.axles === null && option.capacity === null)).toBe(true);
  });
  test("uses effective registered configuration, deduplicating registrations", () => {
    const options = buildFreightConfigurations(vehicles);
    expect(options.filter((option) => option.label === "Carreta")).toHaveLength(1);
    expect(options.find((option) => option.label === "Carreta")?.axles).toBe(5);
    expect(options.find((option) => option.label === "Carreta LS")?.axles).toBe(6);
  });
  test("all eligible cards calculate before selection with current route parameters", async () => {
    const calls: number[] = [];
    const calculate = async (value: typeof input & { axles: number }) => {
      calls.push(value.axles);
      return { minimum_freight: value.distance_km * value.axles, axles: value.axles } as AnttCalculation;
    };
    const configs = buildFreightConfigurations(vehicles);
    const results = await calculateConfigurationFloors(configs, input, calculate);
    expect(calls).toEqual([5, 6]);
    expect(results["carreta:5:26000"].minimum_freight).toBe(2000);
    expect(results["carreta ls:6:33000"].minimum_freight).toBe(2400);
    const updated = await calculateConfigurationFloors(configs, { ...input, distance_km: 500 }, calculate);
    expect(updated["carreta:5:26000"].minimum_freight).toBe(2500);
  });
  test("missing configurations do not produce prices", async () => {
    let calls = 0;
    const results = await calculateConfigurationFloors(buildFreightConfigurations([]), input, async () => { calls++; throw new Error("must not calculate"); });
    expect(calls).toBe(0);
    expect(results).toEqual({});
  });
  test("bodywork respects compatibility recorded in the vehicle catalog", () => {
    const selected = buildFreightConfigurations(vehicles)[0];
    expect(isBodyCompatible(selected, "Baú")).toBe(true);
    expect(isBodyCompatible(selected, "Tanque")).toBe(false);
  });
});