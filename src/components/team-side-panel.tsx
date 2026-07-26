import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Ban,
  History,
  Key,
  Mail,
  Phone,
  Shield,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  deleteTeamMember,
  resendTeamInvite,
  resetTeamPassword,
  setTeamBlocked,
  setTeamRole,
} from "@/lib/team.functions";
import { TEAM_ROLES, labelForRole, labelForStatus, teamStatusBadge } from "@/lib/team";

export function TeamSidePanel({
  userId,
  onClose,
  isAdmin,
}: {
  userId: string;
  onClose: () => void;
  isAdmin: boolean;
}) {
  const qc = useQueryClient();
  const resendFn = useServerFn(resendTeamInvite);
  const resetFn = useServerFn(resetTeamPassword);
  const blockFn = useServerFn(setTeamBlocked);
  const deleteFn = useServerFn(deleteTeamMember);
  const roleFn = useServerFn(setTeamRole);

  const [savingRole, setSavingRole] = useState(false);

  const q = useQuery({
    queryKey: ["team-panel", userId],
    queryFn: async () => {
      const [{ data: t }, { data: role }, { data: dept }, { data: acts }] = await Promise.all([
        supabase.from("team_members").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId).limit(1).maybeSingle(),
        supabase
          .from("departments")
          .select("id, name")
          .eq("active", true)
          .order("name"),
        supabase
          .from("activity_log")
          .select("id, action, description, created_at")
          .eq("actor_id", userId)
          .order("created_at", { ascending: false })
          .limit(15),
      ]);
      return { t, role: role?.role ?? null, depts: dept ?? [], activity: acts ?? [] };
    },
  });

  const t = q.data?.t;
  const currentRole = q.data?.role;

  async function run(fn: () => Promise<any>, msg: string) {
    try {
      await fn();
      toast.success(msg);
      qc.invalidateQueries({ queryKey: ["team-list"] });
      qc.invalidateQueries({ queryKey: ["team-panel", userId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  async function changeRole(v: string) {
    setSavingRole(true);
    try {
      await roleFn({ data: { user_id: userId, role: v as any } });
      toast.success("Perfil atualizado");
      qc.invalidateQueries({ queryKey: ["team-panel", userId] });
      qc.invalidateQueries({ queryKey: ["team-list"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setSavingRole(false);
    }
  }

  async function onDelete() {
    if (!confirm("Excluir colaborador? Esta ação é irreversível.")) return;
    try {
      await deleteFn({ data: { user_id: userId } });
      toast.success("Colaborador excluído");
      qc.invalidateQueries({ queryKey: ["team-list"] });
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
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Colaborador</div>
            <h2 className="truncate text-lg font-semibold">{t?.full_name ?? "—"}</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-accent" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </header>

        {q.isLoading ? (
          <div className="p-8 text-sm text-muted-foreground">Carregando…</div>
        ) : !t ? (
          <div className="p-8 text-sm text-muted-foreground">Colaborador não encontrado.</div>
        ) : (
          <div className="space-y-6 p-6">
            <div className="flex items-center gap-4">
              {t.photo_url ? (
                <img src={t.photo_url} alt="" className="h-20 w-20 rounded-2xl object-cover" />
              ) : (
                <span className="grid h-20 w-20 place-items-center rounded-2xl bg-surface-2">
                  <UserRound className="h-8 w-8 text-muted-foreground" />
                </span>
              )}
              <div className="min-w-0 flex-1 space-y-1">
                <span className={teamStatusBadge(t.status)}>{labelForStatus(t.status)}</span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  {t.email ?? "—"}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  {t.phone ?? t.whatsapp ?? "—"}
                </div>
              </div>
            </div>

            <section className="grid grid-cols-2 gap-3 text-sm">
              <Info label="Cargo" value={t.position ?? "—"} />
              <Info label="Departamento" value={q.data?.depts.find((d: any) => d.id === t.department_id)?.name ?? "—"} />
              <Info label="CPF" value={t.cpf ?? "—"} />
              <Info label="RG" value={t.rg ?? "—"} />
              <Info label="Admissão" value={t.admission_date ? new Date(t.admission_date).toLocaleDateString("pt-BR") : "—"} />
              <Info label="Último acesso" value={t.last_seen_at ? new Date(t.last_seen_at).toLocaleString("pt-BR") : "—"} />
            </section>

            <section>
              <SectionTitle>Perfil de acesso</SectionTitle>
              <div className="flex items-center gap-3">
                <select
                  className="h-11 flex-1 rounded-xl border border-border bg-surface px-3 text-sm"
                  value={currentRole ?? ""}
                  disabled={savingRole}
                  onChange={(e) => changeRole(e.target.value)}
                >
                  {TEAM_ROLES.map((r) => (
                    <option key={r.value} value={r.value} disabled={r.value === "admin" && !isAdmin}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Atual: {labelForRole(currentRole)}. Permissões granulares por módulo virão na próxima
                fase.
              </p>
            </section>

            <section>
              <SectionTitle>
                <span className="inline-flex items-center gap-2">
                  <History className="h-3.5 w-3.5" /> Atividades recentes
                </span>
              </SectionTitle>
              {q.data!.activity.length === 0 ? (
                <div className="text-sm text-muted-foreground">Sem registros.</div>
              ) : (
                <ul className="space-y-2">
                  {q.data!.activity.map((a: any) => (
                    <li key={a.id} className="rounded-xl border border-border bg-surface px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{a.description ?? a.action}</span>
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          {new Date(a.created_at).toLocaleString("pt-BR")}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => run(() => resendFn({ data: { user_id: userId } }), "Convite reenviado")}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-xs hover:bg-accent"
              >
                <Mail className="h-3.5 w-3.5" /> Reenviar convite
              </button>
              <button
                onClick={() => run(() => resetFn({ data: { user_id: userId } }), "Link de reset enviado")}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-xs hover:bg-accent"
              >
                <Key className="h-3.5 w-3.5" /> Resetar senha
              </button>
              <button
                onClick={() =>
                  run(
                    () => blockFn({ data: { user_id: userId, blocked: t.status !== "bloqueado" } }),
                    t.status === "bloqueado" ? "Desbloqueado" : "Bloqueado",
                  )
                }
                className="col-span-2 inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-xs hover:bg-accent"
              >
                <Ban className="h-3.5 w-3.5" />
                {t.status === "bloqueado" ? "Desbloquear" : "Bloquear"}
              </button>
              {isAdmin && (
                <button
                  onClick={onDelete}
                  className="col-span-2 inline-flex items-center justify-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-xs font-medium text-red-700 hover:bg-red-100"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Excluir colaborador
                </button>
              )}
            </section>
          </div>
        )}
      </aside>
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
