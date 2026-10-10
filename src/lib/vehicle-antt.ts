import type { AnttCalculation, AnttCalculationInput } from "@/lib/antt";

export interface RegisteredFreightVehicle {
  id: string;
  vehicle_type: string | null;
  axles: number | null;
  capacity_kg: number | null;
  body_type: string | null;
}

export interface FreightVehicleConfiguration {
  key: string;
  label: string;
  value: string;
  axles: number | null;
  capacity: number | null;
  bodyTypes: string[];
  registered: boolean;
}

const INITIAL_HEAVY_TYPES = ["Carreta", "Carreta LS", "Vanderleia", "Carreta de 4 eixos", "Bitrem", "Bitrenzão", "Rodotrem"];
const LIGHT_TYPES = new Set(["fiorino", "van", "vuc", "3/4", "caminhão 3/4", "moto", "utilitário"]);
const normalize = (value: string) => value.trim().toLocaleLowerCase("pt-BR");

/** Names never supply axle counts: only registered or explicitly entered data do. */
export function buildFreightConfigurations(vehicles: RegisteredFreightVehicle[]): FreightVehicleConfiguration[] {
  const grouped = new Map<string, FreightVehicleConfiguration>();
  for (const vehicle of vehicles) {
    const label = vehicle.vehicle_type?.trim();
    if (!label || LIGHT_TYPES.has(normalize(label))) continue;
    const axles = vehicle.axles != null && Number.isInteger(vehicle.axles) && vehicle.axles > 0 ? vehicle.axles : null;
    const capacity = vehicle.capacity_kg != null && vehicle.capacity_kg > 0 ? Number(vehicle.capacity_kg) : null;
    const key = `${normalize(label)}:${axles ?? "unknown"}:${capacity ?? "unknown"}`;
    const body = vehicle.body_type?.trim();
    const existing = grouped.get(key);
    if (existing) {
      if (body && !existing.bodyTypes.includes(body)) existing.bodyTypes.push(body);
    } else {
      grouped.set(key, { key, label, value: label, axles, capacity, bodyTypes: body ? [body] : [], registered: true });
    }
  }
  const result: FreightVehicleConfiguration[] = [];
  for (const label of INITIAL_HEAVY_TYPES) {
    const matches = [...grouped.values()].filter((item) => normalize(item.label) === normalize(label));
    result.push(...(matches.length ? matches : [{ key: `unconfigured:${label}`, label, value: label, axles: null, capacity: null, bodyTypes: [], registered: false }]));
    matches.forEach((item) => grouped.delete(item.key));
  }
  return [...result, ...grouped.values()];
}

/** Calculate all eligible configurations before selection, deduplicating equal axle inputs. */
export async function calculateConfigurationFloors(
  configurations: FreightVehicleConfiguration[],
  input: Omit<AnttCalculationInput, "axles">,
  calculate: (input: AnttCalculationInput) => Promise<AnttCalculation>,
): Promise<Record<string, AnttCalculation>> {
  const eligible = configurations.filter((item) => item.axles !== null);
  const byAxles = new Map<number, Promise<AnttCalculation>>();
  for (const item of eligible) {
    if (item.axles !== null && !byAxles.has(item.axles)) byAxles.set(item.axles, calculate({ ...input, axles: item.axles }));
  }
  const results = await Promise.all(eligible.map(async (item) => {
    const calculation = item.axles !== null ? await byAxles.get(item.axles) : undefined;
    return calculation ? [item.key, calculation] as const : null;
  }));
  return Object.fromEntries(results.filter((item) => item !== null));
}

export function isBodyCompatible(configuration: FreightVehicleConfiguration | null, body: string): boolean {
  return !body || !configuration?.bodyTypes.length || configuration.bodyTypes.includes(body);
}