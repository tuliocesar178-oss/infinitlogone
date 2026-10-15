import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { TeamInviteDialog } from "@/components/team-invite-dialog";
import { TeamSidePanel } from "@/components/team-side-panel";
import { NotificationSettings } from "@/components/notification-settings";
import { TEAM_ROLES, TEAM_STATUS, labelForRole, labelForStatus, teamStatusBadge } from "@/lib/team";
import {
  ArrowUpDown,
  LayoutGrid,
  List,
  Plus,
  Search,
  UserRound,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/ops/equipe")({
  head: () => ({
    meta: [{ title: "Equipe e notificações operacionais — InfinitLog" }, { name: "description", content: "Gestão da equipe e preferências de avisos operacionais no celular." }, { property: "og:title", content: "Equipe operacional — InfinitLog" }, { property: "og:description", content: "Gestão da equipe e notificações do dispositivo." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }],
  }),
  component: TeamList,
});

type View = "cards" | "list";
type SortKey = "created" | "name" | "position" | "department";
const PAGE_SIZE = 12;

function TeamList() {
  const [view, setView] = useState<View>("cards");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("created");
  const [page, setPage] = useState(0);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const meRole = useQuery({
    queryKey: ["me-role"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return { isAdmin: false };
      const { data: r } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id);
      return { isAdmin: (r ?? []).some((x) => x.role === "admin") };
    },
  });

  const depts = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("departments")
        .select("id, name")
        .eq("active", true)
        .order("name");
      return data ?? [];
    },
  });

  const team = useQuery({
    queryKey: ["team-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select(
          "user_id, full_name, email, phone, whatsapp, cpf, position, department_id, photo_url, status, last_seen_at, created_at",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;

      const ids = (data ?? []).map((r) => r.user_id);
      let rolesMap = new Map<string, string>();
      if (ids.length) {
        const { data: rs } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", ids);
        (rs ?? []).forEach((r: any) => rolesMap.set(r.user_id, r.role));
      }
      return (data ?? []).map((r) => ({ ...r, role: rolesMap.get(r.user_id) ?? null }));
    },
  });

  const filtered = useMemo(() => {
    const rows = team.data ?? [];
    const s = search.trim().toLowerCase();
    let out = rows.filter((r: any) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (deptFilter !== "all" && r.department_id !== deptFilter) return false;
      if (!s) return true;
      const hay = `${r.full_name ?? ""} ${r.email ?? ""} ${r.position ?? ""} ${r.phone ?? ""} ${r.cpf ?? ""}`.toLowerCase();
      return hay.includes(s);
    });
    out = [...out].sort((a: any, b: any) => {
      if (sort === "name") return (a.full_name ?? "").localeCompare(b.full_name ?? "");
      if (sort === "position") return (a.position ?? "").localeCompare(b.position ?? "");
      if (sort === "department") {
        const an = depts.data?.find((d: any) => d.id === a.department_id)?.name ?? "";
        const bn = depts.data?.find((d: any) => d.id === b.department_id)?.name ?? "";
        return an.localeCompare(bn);
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return out;
  }, [team.data, search, statusFilter, deptFilter, sort, depts.data]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const cur = Math.min(page, pageCount - 1);
  const paged = filtered.slice(cur * PAGE_SIZE, cur * PAGE_SIZE + PAGE_SIZE);

  const deptName = (id?: string | null) => depts.data?.find((d: any) => d.id === id)?.name ?? "—";

  return (
    <AppShell
      title="Equipe"
      subtitle={`${filtered.length} colaboradores · convites, perfis e permissões`}
      actions={
        <button
          onClick={() => setInviteOpen(true)}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Novo colaborador
        </button>
      }
    >
      <NotificationSettings className="mb-6" />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Buscar por nome, e-mail, cargo, CPF…"
            className="h-11 w-full rounded-full border border-border bg-surface pl-10 pr-4 text-sm outline-none focus:border-brand"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(0);
          }}
          className="h-11 rounded-full border border-border bg-surface px-4 text-sm"
        >
          <option value="all">Todos os status</option>
          {TEAM_STATUS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          value={deptFilter}
          onChange={(e) => {
            setDeptFilter(e.target.value);
            setPage(0);
          }}
          className="h-11 rounded-full border border-border bg-surface px-4 text-sm"
        >
          <option value="all">Todos os departamentos</option>
          {(depts.data ?? []).map((d: any) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-sm">
          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="bg-transparent text-sm outline-none"
          >
            <option value="created">Mais recentes</option>
            <option value="name">Nome</option>
            <option value="position">Cargo</option>
            <option value="department">Departamento</option>
          </select>
        </div>
        <div className="inline-flex rounded-full border border-border bg-surface p-1">
          <button
            onClick={() => setView("cards")}
            className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium ${
              view === "cards" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Cards
          </button>
          <button
            onClick={() => setView("list")}
            className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium ${
              view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            <List className="h-3.5 w-3.5" /> Lista
          </button>
        </div>
      </div>

      {team.isLoading ? (
        <div className="grid place-items-center rounded-3xl border border-border bg-surface p-16 text-sm text-muted-foreground">
          Carregando colaboradores…
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState onNew={() => setInviteOpen(true)} />
      ) : view === "cards" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {paged.map((m: any) => (
            <button
              key={m.user_id}
              onClick={() => setSelected(m.user_id)}
              className="card-soft flex flex-col gap-4 p-5 text-left transition hover:shadow-md"
            >
              <div className="flex items-center gap-4">
                {m.photo_url ? (
                  <img src={m.photo_url} alt="" className="h-14 w-14 rounded-2xl object-cover" />
                ) : (
                  <span className="grid h-14 w-14 place-items-center rounded-2xl bg-surface-2">
                    <UserRound className="h-7 w-7 text-muted-foreground" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{m.full_name ?? "Sem nome"}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {m.position ?? labelForRole(m.role)}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={teamStatusBadge(m.status)}>{labelForStatus(m.status)}</span>
                <span className="inline-flex rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  {deptName(m.department_id)}
                </span>
              </div>
              <div className="mt-auto flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                <span className="truncate">{m.email ?? "—"}</span>
                <span>
                  {m.last_seen_at
                    ? new Date(m.last_seen_at).toLocaleDateString("pt-BR")
                    : "sem acesso"}
                </span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Colaborador</th>
                <th className="px-4 py-3">Cargo · Depto</th>
                <th className="px-4 py-3">Perfil</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Último acesso</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((m: any) => (
                <tr
                  key={m.user_id}
                  onClick={() => setSelected(m.user_id)}
                  className="cursor-pointer border-t border-border transition hover:bg-accent/40"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {m.photo_url ? (
                        <img src={m.photo_url} alt="" className="h-10 w-10 rounded-xl object-cover" />
                      ) : (
                        <span className="grid h-10 w-10 place-items-center rounded-xl bg-surface-2">
                          <UserRound className="h-5 w-5 text-muted-foreground" />
                        </span>
                      )}
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{m.full_name ?? "—"}</div>
                        <div className="truncate text-xs text-muted-foreground">{m.email ?? "—"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <div className="truncate">{m.position ?? "—"}</div>
                    <div className="truncate text-xs">{deptName(m.department_id)}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{labelForRole(m.role)}</td>
                  <td className="px-4 py-3">
                    <span className={teamStatusBadge(m.status)}>{labelForStatus(m.status)}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                    {m.last_seen_at ? new Date(m.last_seen_at).toLocaleString("pt-BR") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={cur === 0}
            className="rounded-full border border-border bg-background px-4 py-1.5 text-sm disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-xs text-muted-foreground">
            Página {cur + 1} de {pageCount}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={cur >= pageCount - 1}
            className="rounded-full border border-border bg-background px-4 py-1.5 text-sm disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      )}

      <TeamInviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} />
      {selected && (
        <TeamSidePanel
          userId={selected}
          onClose={() => setSelected(null)}
          isAdmin={!!meRole.data?.isAdmin}
        />
      )}
    </AppShell>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="grid place-items-center rounded-3xl border border-border bg-surface p-16 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-surface-2 text-muted-foreground">
        <UserRound className="h-6 w-6" />
      </span>
      <h2 className="mt-6 text-xl font-semibold tracking-tight">Nenhum colaborador ainda</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Convide o primeiro colaborador para começar a operar. Ele receberá um e-mail com o link de
        acesso.
      </p>
      <button
        onClick={onNew}
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow hover:opacity-90"
      >
        <Plus className="h-4 w-4" /> Novo colaborador
      </button>
    </div>
  );
}
