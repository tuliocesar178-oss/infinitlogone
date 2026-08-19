// Módulo Financeiro — Pagamento de motoristas.
// Constantes, rótulos e helpers compartilhados entre o painel do financeiro
// e a área de "Ganhos" do motorista.

export type PaymentStatus =
  | "aguardando_analise"
  | "em_conferencia"
  | "pendencia"
  | "aprovado"
  | "agendado"
  | "pago"
  | "cancelado"
  | "devolvido";

export const PAYMENT_STATUS: { value: PaymentStatus; label: string; tone: string }[] = [
  { value: "aguardando_analise", label: "Aguardando análise", tone: "amber" },
  { value: "em_conferencia", label: "Em conferência", tone: "sky" },
  { value: "pendencia", label: "Pendência", tone: "red" },
  { value: "aprovado", label: "Aprovado para pagamento", tone: "emerald" },
  { value: "agendado", label: "Pagamento agendado", tone: "violet" },
  { value: "pago", label: "Pago", tone: "emerald" },
  { value: "cancelado", label: "Cancelado", tone: "slate" },
  { value: "devolvido", label: "Devolvido para conferência", tone: "amber" },
];

export const paymentStatusLabel = (v?: string | null): string =>
  PAYMENT_STATUS.find((s) => s.value === v)?.label ?? "—";

const TONES: Record<string, string> = {
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  sky: "bg-sky-50 text-sky-700 ring-sky-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
};

export const paymentBadgeClass = (v?: string | null): string => {
  const tone = PAYMENT_STATUS.find((s) => s.value === v)?.tone ?? "slate";
  return `inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${TONES[tone]}`;
};

export const PAYMENT_METHODS = [
  { value: "pix", label: "PIX" },
  { value: "ted", label: "TED" },
  { value: "transferencia", label: "Transferência" },
  { value: "boleto", label: "Boleto" },
  { value: "dinheiro", label: "Dinheiro" },
] as const;

export type BankSnapshot = {
  favored_name?: string | null;
  favored_document?: string | null;
  bank_name?: string | null;
  bank_code?: string | null;
  bank_agency?: string | null;
  bank_account?: string | null;
  bank_account_digit?: string | null;
  bank_account_type?: string | null;
  pix_key?: string | null;
  pix_key_type?: string | null;
  snapshot_at?: string | null;
};

/** Considera pagável quando há PIX OU conta bancária completa. */
export function bankDataComplete(s: BankSnapshot | null | undefined): boolean {
  if (!s) return false;
  const hasPix = !!(s.pix_key && String(s.pix_key).trim());
  const hasAccount = !!(s.bank_name && s.bank_agency && s.bank_account);
  return (hasPix || hasAccount) && !!s.favored_name;
}

export function money(v: number | null | undefined): string {
  if (v == null || Number.isNaN(Number(v))) return "—";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function dt(iso: string | null | undefined, withTime = false): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return withTime ? d.toLocaleString("pt-BR") : d.toLocaleDateString("pt-BR");
}

/** CSV simples com escape de aspas. */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]!);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [headers.join(";"), ...rows.map((r) => headers.map((h) => esc(r[h])).join(";"))].join("\n");
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  const blob = new Blob(["\uFEFF" + toCsv(rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
