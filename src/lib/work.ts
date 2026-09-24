export const WORK_STATUSES = [
  { value: "active", label: "Ativa" },
  { value: "paused", label: "Pausada" },
  { value: "finished", label: "Finalizada" },
  { value: "cancelled", label: "Cancelada" },
] as const;

export type WorkStatus = (typeof WORK_STATUSES)[number]["value"];

export type Work = {
  id: string;
  client_id: string;
  name: string;
  code: string | null;
  address: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  latitude: number | null;
  longitude: number | null;
  responsible_name: string | null;
  responsible_phone: string | null;
  responsible_whatsapp: string | null;
  responsible_email: string | null;
  status: WorkStatus;
  allow_new_freights: boolean;
  start_date: string | null;
  expected_end_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export function workStatusLabel(status?: string | null) {
  return WORK_STATUSES.find((item) => item.value === status)?.label ?? "—";
}

export function workAddress(work: Pick<
  Work,
  "address" | "number" | "neighborhood" | "city" | "state"
>) {
  return [
    [work.address, work.number].filter(Boolean).join(", "),
    work.neighborhood,
    [work.city, work.state].filter(Boolean).join("/"),
  ]
    .filter(Boolean)
    .join(" · ");
}