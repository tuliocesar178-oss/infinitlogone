export const TEAM_ROLES = [
  { value: "admin", label: "Administrador", desc: "Acesso total" },
  { value: "supervisor", label: "Supervisor", desc: "Gerencia equipes" },
  { value: "logistics", label: "Logística", desc: "Operação, pedidos, motoristas" },
  { value: "financeiro", label: "Financeiro", desc: "Faturamento e pagamentos" },
  { value: "comercial", label: "Comercial", desc: "Clientes e fretes" },
  { value: "operacional", label: "Operacional", desc: "Consulta e atualização" },
] as const;

export type TeamRoleValue = (typeof TEAM_ROLES)[number]["value"];

export const TEAM_STATUS = [
  { value: "ativo", label: "Ativo", tone: "emerald" },
  { value: "convite_pendente", label: "Convite pendente", tone: "amber" },
  { value: "bloqueado", label: "Bloqueado", tone: "red" },
  { value: "afastado", label: "Afastado", tone: "slate" },
] as const;

export const teamStatusBadge = (v?: string | null) => {
  const tone = TEAM_STATUS.find((t) => t.value === v)?.tone ?? "slate";
  const map: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    red: "bg-red-50 text-red-700 ring-red-200",
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
  };
  return `inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${map[tone]}`;
};

export const labelForRole = (v?: string | null) =>
  TEAM_ROLES.find((r) => r.value === v)?.label ?? v ?? "—";
export const labelForStatus = (v?: string | null) =>
  TEAM_STATUS.find((r) => r.value === v)?.label ?? v ?? "—";
