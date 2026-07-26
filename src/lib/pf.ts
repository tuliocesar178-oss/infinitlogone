// Helpers e constantes do módulo Programação de Frete (PF)

export const COST_KINDS = [
  { value: "frete", label: "Frete" },
  { value: "pedagio", label: "Pedágio" },
  { value: "licenca", label: "Licença" },
  { value: "batedor", label: "Batedor" },
  { value: "escolta", label: "Escolta" },
  { value: "combustivel", label: "Combustível" },
  { value: "ajudante", label: "Ajudante" },
  { value: "estadia", label: "Estadia" },
  { value: "diaria", label: "Diária" },
  { value: "outros", label: "Outros" },
] as const;
export type CostKind = (typeof COST_KINDS)[number]["value"];

export const PAYMENT_METHODS = [
  { value: "pix", label: "PIX" },
  { value: "ted", label: "TED" },
  { value: "transferencia", label: "Transferência" },
  { value: "boleto", label: "Boleto" },
] as const;

export const PAYMENT_TERMS = [
  { value: "a_vista", label: "À vista" },
  { value: "30d", label: "30 dias" },
  { value: "45d", label: "45 dias" },
  { value: "60d", label: "60 dias" },
  { value: "90d", label: "90 dias" },
] as const;

export const ATTACHMENT_KINDS = [
  { value: "nota_fiscal", label: "Nota Fiscal" },
  { value: "cte", label: "CT-e" },
  { value: "mdfe", label: "MDF-e" },
  { value: "manifesto", label: "Manifesto" },
  { value: "pdf", label: "PDF" },
  { value: "foto", label: "Foto" },
  { value: "video", label: "Vídeo" },
  { value: "xml", label: "XML" },
] as const;

export const BANK_ACCOUNT_TYPES = [
  { value: "corrente", label: "Corrente" },
  { value: "poupanca", label: "Poupança" },
] as const;

export const PIX_KEY_TYPES = [
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone" },
  { value: "random", label: "Chave aleatória" },
] as const;

export const PAYMENT_METHOD_PREFS = [
  { value: "pix", label: "PIX" },
  { value: "ted", label: "TED" },
  { value: "doc", label: "DOC" },
  { value: "boleto", label: "Boleto" },
] as const;

export const FIN_STATUS = [
  { value: "ativo", label: "Ativo" },
  { value: "bloqueado", label: "Bloqueado" },
  { value: "pagamento_pendente", label: "Pagamento pendente" },
] as const;

export const AVAILABILITY = [
  { value: "disponivel", label: "Disponível", tone: "emerald" },
  { value: "em_frete", label: "Em Frete", tone: "sky" },
  { value: "folga", label: "Folga", tone: "amber" },
  { value: "ferias", label: "Férias", tone: "violet" },
  { value: "bloqueado", label: "Bloqueado", tone: "red" },
  { value: "offline", label: "Offline", tone: "slate" },
] as const;
export type Availability = (typeof AVAILABILITY)[number]["value"];

export const DOCUMENT_KINDS = [
  { value: "cnh_frente", label: "CNH — Frente" },
  { value: "cnh_verso", label: "CNH — Verso" },
  { value: "foto_motorista", label: "Foto do motorista" },
  { value: "antt", label: "ANTT / RNTRC" },
  { value: "residencia", label: "Comprovante de residência" },
  { value: "doc_veiculo", label: "Documento do veículo" },
  { value: "certificado", label: "Certificado" },
  { value: "outros", label: "Outros" },
] as const;

export const CIVIL_STATUS = [
  { value: "solteiro", label: "Solteiro(a)" },
  { value: "casado", label: "Casado(a)" },
  { value: "divorciado", label: "Divorciado(a)" },
  { value: "viuvo", label: "Viúvo(a)" },
  { value: "uniao_estavel", label: "União estável" },
] as const;

export const GENDER = [
  { value: "masculino", label: "Masculino" },
  { value: "feminino", label: "Feminino" },
  { value: "outro", label: "Outro" },
  { value: "nao_informar", label: "Prefiro não informar" },
] as const;

export const availabilityBadgeClass = (v?: string | null): string => {
  const tone = AVAILABILITY.find((a) => a.value === v)?.tone ?? "slate";
  const map: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    sky: "bg-sky-50 text-sky-700 ring-sky-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    violet: "bg-violet-50 text-violet-700 ring-violet-200",
    red: "bg-red-50 text-red-700 ring-red-200",
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
  };
  return `inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${map[tone]}`;
};

export function brl(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function labelOf<T extends readonly { value: string; label: string }[]>(
  arr: T,
  v: string | null | undefined,
): string {
  if (!v) return "—";
  return arr.find((x) => x.value === v)?.label ?? v;
}

export function fmtDate(iso: string | null | undefined, withTime = false): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return withTime ? d.toLocaleString("pt-BR") : d.toLocaleDateString("pt-BR");
}
