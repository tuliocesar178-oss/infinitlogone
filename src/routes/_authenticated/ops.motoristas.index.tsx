import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { AVAILABILITY, availabilityBadgeClass, labelOf } from "@/lib/pf";
import { DriverInviteDialog } from "@/components/driver-invite-dialog";
import { DriverSidePanel } from "@/components/driver-side-panel";
import {
  ArrowUpDown,
  LayoutGrid,
  List,
  Plus,
  Search,
  Star,
  UserRound,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/ops/motoristas/")({
  head: () => ({
    meta: [
      { name: "description", content: 'Motoristas — InfinitLog. Informações e acompanhamento na plataforma INFINITLOG VAPT VUPT.' },{ title: "Motoristas — InfinitLog" }, {name:'description',content:'Cadastros, contatos e veículos dos motoristas INFINITLOG.'},{property:'og:title',content:'Motoristas — InfinitLog'},{property:'og:description',content:'Cadastro operacional de motoristas.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}, { name: "robots", content: "noindex" }],
  }),
  component: DriversList,
});

type View = "cards" | "list";
type SortKey = "name" | "created" | "city" | "availability";

const PAGE_SIZE = 12;

function DriversList() {
  const [view, setView] = useState<View>("cards");
  const [search, setSearch] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState<string>("all");
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

  const q = useQuery({
    queryKey: ["drivers-list"],
    queryFn: async () => {
      const { data: drivers, error } = await supabase
        .from("drivers")
        .select(
          "user_id, full_name, approval_status, status, availability, financial_status, city, state, phone, cpf, photo_url, rating, last_seen_at, created_at, current_vehicle_id",
        )
        .is("deleted_at", null).order("created_at", { ascending: false });
      if (error) throw error;
      const ids = (drivers ?? []).map((d) => d.user_id);
      const vehIds = (drivers ?? []).map((d) => d.current_vehicle_id).filter(Boolean) as string[];
      const [{ data: profiles }, { data: vehicles }] = await Promise.all([
        ids.length
          ? supabase.from("profiles").select("id, full_name").in("id", ids)
          : Promise.resolve({ data: [] as any[] }),
        vehIds.length
          ? supabase.from("vehicles").select("id, plate, brand, model, vehicle_type").in("id", vehIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      return (drivers ?? []).map((d) => ({
        ...d,
        profiles: (profiles ?? []).find((p: any) => p.id === d.user_id) ?? { full_name: d.full_name },
        vehicles: (vehicles ?? []).find((v: any) => v.id === d.current_vehicle_id) ?? null,
      }));
    },
  });

  const filtered = useMemo(() => {
    const rows = (q.data ?? []) as any[];
    const s = search.trim().toLowerCase();
    let out = rows.filter((r) => {
      if (availabilityFilter !== "all" && r.availability !== availabilityFilter) return false;
      if (!s) return true;
      const hay = `${r.profiles?.full_name ?? ""} ${r.city ?? ""} ${r.state ?? ""} ${r.phone ?? ""} ${r.cpf ?? ""} ${r.vehicles?.plate ?? ""}`.toLowerCase();
      return hay.includes(s) || Boolean(s.replace(/\D/g, "") && r.phone?.includes(s.replace(/\D/g, "")));
    });
    out = [...out].sort((a, b) => {
      if (sort === "name") return (a.profiles?.full_name ?? "").localeCompare(b.profiles?.full_name ?? "");
      if (sort === "city") return (a.city ?? "").localeCompare(b.city ?? "");
      if (sort === "availability") return (a.availability ?? "").localeCompare(b.availability ?? "");
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return out;
  }, [q.data, search, availabilityFilter, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const paged = filtered.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

  return (
    <AppShell
      title="Motoristas"
      subtitle={`${filtered.length} motoristas · gerencie cadastro, disponibilidade e ofertas`}
      actions={
        <button
          onClick={() => setInviteOpen(true)}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Novo motorista
        </button>
      }
    >
      {/* Toolbar */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Buscar por nome, telefone, CPF ou placa…"
            className="h-11 w-full rounded-full border border-border bg-surface pl-10 pr-4 text-sm outline-none focus:border-brand"
          />
        </div>
        <select
          value={availabilityFilter}
          onChange={(e) => {
            setAvailabilityFilter(e.target.value);
            setPage(0);
          }}
          className="h-11 rounded-full border border-border bg-surface px-4 text-sm"
        >
          <option value="all">Todas as disponibilidades</option>
          {AVAILABILITY.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
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
            <option value="city">Cidade</option>
            <option value="availability">Disponibilidade</option>
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

      {q.isLoading ? (
        <div className="grid place-items-center rounded-3xl border border-border bg-surface p-16 text-sm text-muted-foreground">
          Carregando motoristas…
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState onNew={() => setInviteOpen(true)} />
      ) : view === "cards" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {paged.map((d: any) => (
            <DriverCard key={d.user_id} d={d} onOpen={() => setSelected(d.user_id)} />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Motorista</th>
                <th className="px-4 py-3">Cidade / UF</th>
                <th className="px-4 py-3">Veículo</th>
                <th className="px-4 py-3">Disponibilidade</th>
                <th className="px-4 py-3 text-right">Último acesso</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((d: any) => (
                <tr
                  key={d.user_id}
                  onClick={() => setSelected(d.user_id)}
                  className="cursor-pointer border-t border-border transition hover:bg-accent/40"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {d.photo_url ? (
                        <img src={d.photo_url} alt="" className="h-10 w-10 rounded-xl object-cover" />
                      ) : (
                        <span className="grid h-10 w-10 place-items-center rounded-xl bg-surface-2">
                          <UserRound className="h-5 w-5 text-muted-foreground" />
                        </span>
                      )}
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{d.profiles?.full_name ?? "—"}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {d.phone ?? d.cpf ?? "—"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {[d.city, d.state].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {d.vehicles?.plate
                      ? `${d.vehicles.plate} · ${d.vehicles.vehicle_type ?? ""}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={availabilityBadgeClass(d.availability)}>
                      {labelOf(AVAILABILITY as any, d.availability)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                    {d.last_seen_at ? new Date(d.last_seen_at).toLocaleString("pt-BR") : "—"}
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
            disabled={currentPage === 0}
            className="rounded-full border border-border bg-background px-4 py-1.5 text-sm disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-xs text-muted-foreground">
            Página {currentPage + 1} de {pageCount}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={currentPage >= pageCount - 1}
            className="rounded-full border border-border bg-background px-4 py-1.5 text-sm disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      )}

      {inviteOpen && <DriverInviteDialog open onClose={() => setInviteOpen(false)} />}
      {selected && (
        <DriverSidePanel
          driverId={selected}
          onClose={() => setSelected(null)}
          isAdmin={!!meRole.data?.isAdmin}
        />
      )}
    </AppShell>
  );
}

function DriverCard({ d, onOpen }: { d: any; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="card-soft flex flex-col gap-4 p-5 text-left transition hover:shadow-md"
    >
      <div className="flex items-center gap-4">
        {d.photo_url ? (
          <img src={d.photo_url} alt="" className="h-14 w-14 rounded-2xl object-cover" />
        ) : (
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-surface-2">
            <UserRound className="h-7 w-7 text-muted-foreground" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{d.profiles?.full_name ?? "Sem nome"}</div>
          <div className="truncate text-xs text-muted-foreground">
            {[d.city, d.state].filter(Boolean).join(", ") || "—"}
          </div>
        </div>
        {d.rating && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
            <Star className="h-3 w-3 fill-amber-500 stroke-amber-500" />
            {Number(d.rating).toFixed(1)}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={availabilityBadgeClass(d.availability)}>
          {labelOf(AVAILABILITY as any, d.availability)}
        </span>
        {d.vehicles?.plate && (
          <span className="inline-flex rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {d.vehicles.plate} · {d.vehicles.vehicle_type ?? "—"}
          </span>
        )}
      </div>
      <div className="mt-auto flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
        <span>{d.phone ?? "sem telefone"}</span>
        <span>
          {d.last_seen_at
            ? new Date(d.last_seen_at).toLocaleDateString("pt-BR")
            : "sem acesso"}
        </span>
      </div>
    </button>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="grid place-items-center rounded-3xl border border-border bg-surface p-16 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-surface-2 text-muted-foreground">
        <UserRound className="h-6 w-6" />
      </span>
      <h2 className="mt-6 text-xl font-semibold tracking-tight">Nenhum motorista</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Cadastre o primeiro motorista.
      </p>
      <button
        onClick={onNew}
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow hover:opacity-90"
      >
        <Plus className="h-4 w-4" /> Novo motorista
      </button>
    </div>
  );
}
