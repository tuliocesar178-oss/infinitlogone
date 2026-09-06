import { supabase } from "@/integrations/supabase/client";

/**
 * Motor de cálculo do Piso Mínimo de Frete (PNPM-TRC / ANTT).
 *
 * Fórmula oficial: PISO = (DISTÂNCIA_KM x CCD) + CC
 * Os coeficientes NUNCA são fixados no código: vêm da tabela versionada
 * `antt_freight_rates`, vinculada à resolução vigente em `antt_rate_tables`.
 */

export type AnttTableCode = "A" | "B" | "C" | "D";

export type AnttContractType = "composicao" | "tracao";

/** Enquadramento da operação frente à PNPM-TRC. */
export type AnttOperationType =
  | "lotacao"
  | "fracionada"
  | "carga_propria"
  | "internacional"
  | "nao_diesel";

export const ANTT_CARGO_CLASSES = [
  { code: "granel_solido", label: "Granel sólido" },
  { code: "granel_liquido", label: "Granel líquido" },
  { code: "frigorificada_ou_aquecida", label: "Frigorificada ou aquecida" },
  { code: "conteinerizada", label: "Conteinerizada" },
  { code: "carga_geral", label: "Carga geral" },
  { code: "neogranel", label: "Neogranel" },
  { code: "perigosa_granel_solido", label: "Perigosa (granel sólido)" },
  { code: "perigosa_granel_liquido", label: "Perigosa (granel líquido)" },
  { code: "perigosa_frigorificada_ou_aquecida", label: "Perigosa (frigorificada ou aquecida)" },
  { code: "perigosa_conteinerizada", label: "Perigosa (conteinerizada)" },
  { code: "perigosa_carga_geral", label: "Perigosa (carga geral)" },
  { code: "carga_granel_pressurizada", label: "Granel pressurizada" },
] as const;

export const ANTT_CONTRACT_TYPES: Array<{ code: AnttContractType; label: string }> = [
  { code: "composicao", label: "Composição veicular / caminhão simples" },
  { code: "tracao", label: "Apenas unidade de tração" },
];

export const ANTT_OPERATION_TYPES: Array<{ code: AnttOperationType; label: string }> = [
  { code: "lotacao", label: "Carga lotação (sujeita ao piso ANTT)" },
  { code: "fracionada", label: "Carga fracionada" },
  { code: "carga_propria", label: "Carga própria" },
  { code: "internacional", label: "Transporte internacional" },
  { code: "nao_diesel", label: "Veículo não movido a diesel" },
];

export const ANTT_AXLE_OPTIONS = [2, 3, 4, 5, 6, 7, 9] as const;

const NOT_APPLICABLE_REASON: Record<Exclude<AnttOperationType, "lotacao">, string> = {
  fracionada: "Carga fracionada não é abrangida pela PNPM-TRC.",
  carga_propria: "Transporte de carga própria não é abrangido pela PNPM-TRC.",
  internacional: "Transporte internacional não é abrangido pela PNPM-TRC.",
  nao_diesel: "Veículo não movido a diesel não é abrangido pela PNPM-TRC.",
};

export type AnttCalculationInput = {
  distance_km: number;
  cargo_class: string;
  axles: number;
  contract_type: AnttContractType;
  high_performance: boolean;
  operation_type: AnttOperationType;
};

export type AnttCalculation = {
  applicable: boolean;
  not_applicable_reason: string | null;
  table: AnttTableCode | null;
  rate_table_id: string | null;
  cargo_class: string;
  cargo_class_label: string;
  axles: number;
  distance_km: number;
  ccd: number | null;
  cc: number | null;
  minimum_freight: number | null;
  minimum_per_km: number | null;
  regulation: string | null;
  effective_from: string | null;
  source: string | null;
  formula: string | null;
  calculation_date: string;
  status: "ok" | "not_applicable" | "missing_rate" | "missing_params";
  message: string;
};

export function resolveAnttTable(
  contract: AnttContractType,
  highPerformance: boolean,
): AnttTableCode {
  if (contract === "composicao") return highPerformance ? "C" : "A";
  return highPerformance ? "D" : "B";
}

export function cargoClassLabel(code: string): string {
  return ANTT_CARGO_CLASSES.find((c) => c.code === code)?.label ?? code;
}

export type AnttRateTable = {
  id: string;
  resolucao: string;
  anexo: string | null;
  fonte: string | null;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  active: boolean;
};

/** Busca a tabela ANTT vigente (a mais recente marcada como ativa). */
export async function getActiveAnttTable(): Promise<AnttRateTable | null> {
  const { data, error } = await supabase
    .from("antt_rate_tables")
    .select("id, resolucao, anexo, fonte, vigencia_inicio, vigencia_fim, active")
    .eq("active", true)
    .order("vigencia_inicio", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return (data as AnttRateTable | null) ?? null;
}

function baseResult(input: AnttCalculationInput): AnttCalculation {
  return {
    applicable: true,
    not_applicable_reason: null,
    table: null,
    rate_table_id: null,
    cargo_class: input.cargo_class,
    cargo_class_label: cargoClassLabel(input.cargo_class),
    axles: input.axles,
    distance_km: input.distance_km,
    ccd: null,
    cc: null,
    minimum_freight: null,
    minimum_per_km: null,
    regulation: null,
    effective_from: null,
    source: null,
    formula: null,
    calculation_date: new Date().toISOString(),
    status: "missing_params",
    message: "Informe distância, tipo de carga e número de eixos.",
  };
}

/**
 * Calcula o piso mínimo com os coeficientes vigentes.
 * Retorna sempre um objeto auditável — nunca lança por dado ausente.
 */
export async function calculateANTTMinimumFreight(
  input: AnttCalculationInput,
): Promise<AnttCalculation> {
  const result = baseResult(input);

  if (input.operation_type !== "lotacao") {
    return {
      ...result,
      applicable: false,
      status: "not_applicable",
      not_applicable_reason: NOT_APPLICABLE_REASON[input.operation_type],
      message: NOT_APPLICABLE_REASON[input.operation_type],
    };
  }

  if (!input.distance_km || !input.cargo_class || !input.axles) return result;

  const table = resolveAnttTable(input.contract_type, input.high_performance);
  const active = await getActiveAnttTable();

  if (!active) {
    return {
      ...result,
      table,
      status: "missing_rate",
      message:
        "Nenhuma tabela ANTT vigente cadastrada. Cadastre a resolução vigente em Configurações → Tabelas ANTT.",
    };
  }

  const { data: rate } = await supabase
    .from("antt_freight_rates")
    .select("ccd, cc")
    .eq("table_id", active.id)
    .eq("tabela", table)
    .eq("codigo_tipo_carga", input.cargo_class)
    .eq("eixos", input.axles)
    .maybeSingle();

  if (!rate) {
    return {
      ...result,
      table,
      rate_table_id: active.id,
      regulation: active.resolucao,
      effective_from: active.vigencia_inicio,
      source: active.fonte,
      status: "missing_rate",
      message: `Sem coeficiente na tabela ${table} para ${cargoClassLabel(input.cargo_class)} com ${input.axles} eixos. Célula vazia na tabela oficial não significa valor zero.`,
    };
  }

  const ccd = Number(rate.ccd);
  const cc = Number(rate.cc);
  const minimum = Math.round((input.distance_km * ccd + cc) * 100) / 100;

  return {
    ...result,
    table,
    rate_table_id: active.id,
    ccd,
    cc,
    minimum_freight: minimum,
    minimum_per_km: input.distance_km > 0 ? minimum / input.distance_km : null,
    regulation: active.resolucao,
    effective_from: active.vigencia_inicio,
    source: active.fonte,
    formula: `(${input.distance_km.toFixed(1)} km × R$ ${ccd.toFixed(4)}) + R$ ${cc.toFixed(2)}`,
    status: "ok",
    message: "Piso mínimo calculado com a tabela vigente.",
  };
}

export function brl(value: number | null | undefined): string {
  return (value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
