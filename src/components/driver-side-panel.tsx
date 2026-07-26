import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  AVAILABILITY,
  availabilityBadgeClass,
  brl,
  fmtDate,
  labelOf,
  PAYMENT_METHOD_PREFS,
} from "@/lib/pf";
import {
  deleteDriver,
  resendDriverInvite,
  resetDriverPassword,
  setDriverAvailability,
} from "@/lib/drivers.functions";
import { toast } from "sonner";
import {
  Ban,
  Edit3,
  Key,
  Mail,
  MapPin,
  Phone,
  Star,
  Trash2,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import { TripMap } from "@/components/trip-map";

export function DriverSidePanel({
  driverId,
  onClose,
  isAdmin,
}: {
  driverId: string;
  onClose: () => void;
  isAdmin: boolean;
}) {
  const qc = useQueryClient();
  const resetPwd = useServerFn(resetDriverPassword);
  const resend = useServerFn(resendDriverInvite);
  const remove = useServerFn(deleteDriver);
  const setAvail = useServerFn(setDriverAvailability);

  const q = useQuery({
    queryKey: ["driver-panel", driverId],
    queryFn: async () => {
      const [
        { data: d },
        { data: p },
        { data: v },
        { data: recent },
        { count: totalCount },
        { count: doneCount },
        { count: activeCount },
      ] = await Promise.all([
        supabase.from("drivers").select("*").eq("user_id", driverId).maybeSingle(),
        supabase.from("profiles").select("full_name, phone, avatar_url").eq("id", driverId).maybeSingle(),
        supabase
          .from("vehicles")
          .select("plate, brand, model, vehicle_type")
          .eq("id", "00000000-0000-0000-0000-000000000000")
          .maybeSingle()
          .then(async (r) => r),
        supabase
          .from("orders")
          .select("id, code, tracking_code, status, origin_city, destination_city, price, created_at")
          .eq("driver_id", driverId)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("driver_id", driverId),
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("driver_id", driverId)
          .in("status", ["delivered", "finalized"]),
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("driver_id", driverId)
          .not("status", "in", "(delivered,finalized,cancelled)"),
      ]);
      let vehicle = null as any;
      if (d?.current_vehicle_id) {
        const { data } = await supabase
          .from("vehicles")
          .select("plate, brand, model, vehicle_type, color")
          .eq("id", d.current_vehicle_id)
          .maybeSingle();
        vehicle = data;
      }
      return {
        driver: d,
        profile: p,
        vehicle: vehicle ?? v,
        recent: recent ?? [],
        totalCount: totalCount ?? 0,
        doneCount: doneCount ?? 0,
        activeCount: activeCount ?? 0,
      };
    },
    enabled: !!driverId,
  });

  const d = q.data?.driver;
  const p = q.data?.profile;
  const vehicle = q.data?.vehicle;

  async function updateAvail(a: string) {
    try {
      await setAvail({ data: { user_id: driverId, availability: a as any } });
      toast.success("Disponibilidade atualizada");
      qc.invalidateQueries({ queryKey: ["drivers-list"] });
      qc.invalidateQueries({ queryKey: ["driver-panel", driverId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  async function onReset() {
    try {
      await resetPwd({ data: { user_id: driverId } });
      toast.success("Link de redefinição enviado por e-mail");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  async function onResend() {
    try {
      await resend({ data: { user_id: driverId } });
      toast.success("Convite reenviado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  async function onDelete() {
    if (!confirm("Excluir motorista? Esta ação é irreversível.")) return;
    try {
      await remove({ data: { user_id: driverId } });
      toast.success("Motorista excluído");
      qc.invalidateQueries({ queryKey: ["drivers-list"] });
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <aside className="flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-border bg-background shadow-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 px-6 py-4 backdrop-blur">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Motorista</div>
            <h2 className="truncate text-lg font-semibold">{p?.full_name ?? "—"}</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-accent" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </header>

        {q.isLoading ? (
          <div className="p-8 text-sm text-muted-foreground">Carregando…</div>
        ) : (
          <div className="space-y-6 p-6">
            <div className="flex items-center gap-4">
              {d?.photo_url || p?.avatar_url ? (
                <img
                  src={d?.photo_url ?? p?.avatar_url ?? undefined}
                  alt=""
                  className="h-20 w-20 rounded-2xl object-cover"
                />
              ) : (
                <span className="grid h-20 w-20 place-items-center rounded-2xl bg-surface-2">
                  <UserRound className="h-8 w-8 text-muted-foreground" />
                </span>
              )}
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={availabilityBadgeClass(d?.availability)}>
                    {labelOf(AVAILABILITY as any, d?.availability)}
                  </span>
                  {d?.rating && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                      <Star className="h-3 w-3 fill-amber-500 stroke-amber-500" />
                      {Number(d.rating).toFixed(1)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  {[d?.city, d?.state].filter(Boolean).join(", ") || "—"}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  {p?.phone ?? d?.phone ?? "—"}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  {d?.email ?? "—"}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Stat label="Total" value={q.data?.totalCount ?? 0} />
              <Stat label="Em andamento" value={q.data?.activeCount ?? 0} />
              <Stat label="Concluídos" value={q.data?.doneCount ?? 0} />
            </div>

            <section>
              <SectionTitle>Disponibilidade</SectionTitle>
              <div className="flex flex-wrap gap-2">
                {AVAILABILITY.map((a) => (
                  <button
                    key={a.value}
                    onClick={() => updateAvail(a.value)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition ${
                      d?.availability === a.value
                        ? "bg-primary text-primary-foreground ring-primary"
                        : "bg-surface text-muted-foreground ring-border hover:bg-accent"
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <SectionTitle>Veículo</SectionTitle>
              {vehicle ? (
                <div className="card-soft flex items-center gap-3 p-4">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-surface-2">
                    <Truck className="h-5 w-5 text-muted-foreground" />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate font-semibold">
                      {vehicle.plate} · {vehicle.brand ?? ""} {vehicle.model ?? ""}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {vehicle.vehicle_type ?? "—"}
                      {vehicle.color ? ` · ${vehicle.color}` : ""}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Nenhum veículo vinculado.</div>
              )}
            </section>

            <section>
              <SectionTitle>Financeiro</SectionTitle>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Info label="Preferência" value={labelOf(PAYMENT_METHOD_PREFS as any, d?.preferred_payment_method)} />
                <Info label="Prazo" value={d?.payment_term_days ? `${d.payment_term_days}d` : "—"} />
                <Info label="R$ / KM" value={brl(d?.default_price_per_km)} />
                <Info label="Mín. por frete" value={brl(d?.min_freight_value)} />
                <Info label="Banco" value={d?.bank_name ?? "—"} />
                <Info label="PIX" value={d?.pix_key ?? "—"} />
              </div>
            </section>

            <section>
              <SectionTitle>Última localização</SectionTitle>
              {d?.current_lat && d?.current_lng ? (
                <div className="overflow-hidden rounded-2xl border border-border">
                  <TripMap
                    driver={{ lat: d.current_lat, lng: d.current_lng }}
                    className="h-56"
                    interactive={false}
                  />
                  <div className="border-t border-border bg-surface px-4 py-2 text-xs text-muted-foreground">
                    Último ping: {fmtDate(d.last_seen_at, true)}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Sem localização registrada ainda.
                </div>
              )}
            </section>

            <section>
              <SectionTitle>Últimos fretes</SectionTitle>
              {(q.data?.recent ?? []).length === 0 ? (
                <div className="text-sm text-muted-foreground">Nenhum frete ainda.</div>
              ) : (
                <ul className="space-y-2">
                  {q.data!.recent.map((o: any) => (
                    <li
                      key={o.id}
                      className="flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">{o.code}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {o.origin_city ?? "—"} → {o.destination_city ?? "—"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-medium">{brl(o.price)}</div>
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          {fmtDate(o.created_at)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="grid grid-cols-2 gap-2 pt-2">
              <Link
                to="/ops/motoristas/$id"
                params={{ id: driverId }}
                className="col-span-2 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                <Edit3 className="h-4 w-4" /> Abrir cadastro completo
              </Link>
              <button
                onClick={onReset}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-xs hover:bg-accent"
              >
                <Key className="h-3.5 w-3.5" /> Resetar senha
              </button>
              <button
                onClick={onResend}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-xs hover:bg-accent"
              >
                <Mail className="h-3.5 w-3.5" /> Reenviar convite
              </button>
              <button
                onClick={() => updateAvail(d?.availability === "bloqueado" ? "offline" : "bloqueado")}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-xs hover:bg-accent"
              >
                <Ban className="h-3.5 w-3.5" />
                {d?.availability === "bloqueado" ? "Desbloquear" : "Bloquear"}
              </button>
              {isAdmin && (
                <button
                  onClick={onDelete}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-xs font-medium text-red-700 hover:bg-red-100"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Excluir
                </button>
              )}
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-3 text-center">
      <div className="text-2xl font-semibold tracking-tight">{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-sm font-medium">{value}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </h3>
  );
}
