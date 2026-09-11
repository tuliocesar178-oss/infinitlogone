import type { Database } from "@/integrations/supabase/types";

export type DriverPaymentStatus = Database["public"]["Enums"]["driver_payment_status"];

/** Rótulos amigáveis em português para os status de pagamento de motorista. */
export const PAYMENT_STATUS_LABEL: Record<DriverPaymentStatus, string> = {
  aguardando_analise: "Aguardando análise",
  em_conferencia: "Em conferência",
  pendencia: "Com pendência",
  aprovado: "Aprovado",
  agendado: "Agendado",
  pago: "Pago",
  cancelado: "Cancelado",
  devolvido: "Devolvido",
};

export const PAYMENT_STATUS_ORDER: DriverPaymentStatus[] = [
  "aguardando_analise",
  "em_conferencia",
  "pendencia",
  "aprovado",
  "agendado",
  "pago",
  "devolvido",
  "cancelado",
];

/** Classes de cor (tokens semânticos + paleta de estado) por status. */
export function paymentStatusChip(status: DriverPaymentStatus): string {
  switch (status) {
    case "pago":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    case "aprovado":
    case "agendado":
      return "bg-sky-500/10 text-sky-600 dark:text-sky-400";
    case "pendencia":
    case "devolvido":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
    case "cancelado":
      return "bg-destructive/10 text-destructive";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export type MonthBucket = {
  key: string;
  label: string;
  start: Date;
  end: Date;
};

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Últimos `count` meses (inclusive o atual), do mais antigo para o mais recente. */
export function lastMonths(count: number, ref: Date = new Date()): MonthBucket[] {
  const out: MonthBucket[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const start = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    out.push({
      key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
      label: `${MONTHS[start.getMonth()]}/${String(start.getFullYear()).slice(2)}`,
      start,
      end,
    });
  }
  return out;
}

/** Chave "AAAA-MM" de uma data ISO; null quando a data é inválida/ausente. */
export function monthKey(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function sum(values: Array<number | null | undefined>): number {
  return values.reduce<number>((acc, v) => acc + (Number(v) || 0), 0);
}

export function compactBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: Math.abs(v) >= 10000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(v) >= 10000 ? 1 : 2,
  }).format(v);
}
