export type VehicleStatus =
  | "disponivel"
  | "em_coleta"
  | "em_transito"
  | "em_entrega"
  | "retornando"
  | "manutencao"
  | "bloqueado"
  | "reserva"
  | "offline";

export const VEHICLE_STATUS: { value: VehicleStatus; label: string; dot: string; badge: string }[] = [
  { value: "disponivel", label: "Disponível", dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  { value: "em_coleta", label: "Em Coleta", dot: "bg-sky-500", badge: "bg-sky-50 text-sky-700 ring-sky-200" },
  { value: "em_transito", label: "Em Trânsito", dot: "bg-blue-500", badge: "bg-blue-50 text-blue-700 ring-blue-200" },
  { value: "em_entrega", label: "Em Entrega", dot: "bg-indigo-500", badge: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
  { value: "retornando", label: "Retornando", dot: "bg-cyan-500", badge: "bg-cyan-50 text-cyan-700 ring-cyan-200" },
  { value: "manutencao", label: "Manutenção", dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700 ring-amber-200" },
  { value: "bloqueado", label: "Bloqueado", dot: "bg-rose-500", badge: "bg-rose-50 text-rose-700 ring-rose-200" },
  { value: "reserva", label: "Reserva", dot: "bg-violet-500", badge: "bg-violet-50 text-violet-700 ring-violet-200" },
  { value: "offline", label: "Offline", dot: "bg-zinc-400", badge: "bg-zinc-100 text-zinc-700 ring-zinc-200" },
];

export function vehicleStatusMeta(s?: string | null) {
  return VEHICLE_STATUS.find((v) => v.value === s) ?? VEHICLE_STATUS[VEHICLE_STATUS.length - 1];
}

export function vehicleStatusBadgeClass(s?: string | null) {
  const m = vehicleStatusMeta(s);
  return `inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${m.badge}`;
}

export const DOCUMENT_KINDS = [
  { value: "crlv", label: "CRLV" },
  { value: "seguro", label: "Seguro" },
  { value: "licenciamento", label: "Licenciamento" },
  { value: "ipva", label: "IPVA" },
  { value: "antt", label: "ANTT" },
  { value: "foto", label: "Foto" },
  { value: "laudo", label: "Laudo" },
  { value: "contrato", label: "Contrato" },
  { value: "outro", label: "Outro" },
];

export function daysUntil(date?: string | null): number | null {
  if (!date) return null;
  const d = new Date(date + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}

export function expiryBadgeClass(days: number | null): string {
  if (days === null) return "bg-zinc-100 text-zinc-600 ring-zinc-200";
  if (days < 0) return "bg-rose-50 text-rose-700 ring-rose-200";
  if (days <= 30) return "bg-amber-50 text-amber-700 ring-amber-200";
  return "bg-emerald-50 text-emerald-700 ring-emerald-200";
}

export function formatDate(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("pt-BR");
}
