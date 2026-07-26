import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import {
  VEHICLE_STATUS,
  vehicleStatusBadgeClass,
  vehicleStatusMeta,
  daysUntil,
  expiryBadgeClass,
} from "@/lib/vehicles";
import {
  ArrowUpDown,
  LayoutGrid,
  List,
  Plus,
  Search,
  Truck,
  MapPin,
  Gauge,
  AlertCircle,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/ops/veiculos/lista")({
  head: () => ({
    meta: [{ title: "Veículos — InfinitLog" }, { name: "robots", content: "noindex" }],
  }),
  component: VehiclesList,
});

type View = "cards" | "list";
type SortKey = "created" | "plate" | "status" | "km";
const PAGE_SIZE = 12;

function VehiclesList() {
  const navigate = useNavigate();
  const [view, setView] = useState<View>("cards");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("created");
  const [page, setPage] = useState(0);

  const q = useQuery({
    queryKey: ["vehicles-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select(
          "id, plate, model, brand, year, color, vehicle_type, capacity_kg, capacity_m3, status, photo_url, current_city, current_state, current_km, last_location_at, updated_at, active, owner_driver_id, crlv_expires_at, licensing_expires_at, insurance_expires_at, ipva_expires_at",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const types = useQuery({
    queryKey: ["vehicle-types"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicle_types").select("id, name").eq("active", true).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const drivers = useQuery({
    queryKey: ["drivers-quick"],
    queryFn: async () => {
      const { data } = await supabase
        .from("drivers")
        .select("user_id, profiles:profiles!inner(full_name)");
      return data ?? [];
    },
  });

  const driverName = (userId?: string | null) => {
    if (!userId) return null;
    const d: any = (drivers.data ?? []).find((x: any) => x.user_id === userId);
    return d?.profiles?.full_name ?? null;
  };

  const filtered = useMemo(() => {
    const rows = (q.data ?? []) as any[];
    const s = search.trim().toLowerCase();
    let out = rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (typeFilter !== "all" && r.vehicle_type !== typeFilter) return false;
      if (!s) return true;
      const hay = `${r.plate ?? ""} ${r.model ?? ""} ${r.brand ?? ""} ${r.vehicle_type ?? ""} ${r.current_city ?? ""}`.toLowerCase();
      return hay.includes(s);
    });
    out = [...out].sort((a, b) => {
      if (sort === "plate") return (a.plate ?? "").localeCompare(b.plate ?? "");
      if (sort === "status") return (a.status ?? "").localeCompare(b.status ?? "");
      if (sort === "km") return (b.current_km ?? 0) - (a.current_km ?? 0);
      return new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime();
    });
    return out;
  }, [q.data, search, statusFilter, typeFilter, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const paged = filtered.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

  const counts = useMemo(() => {
    const rows = (q.data ?? []) as any[];
    return {
      total: rows.length,
      disponivel: rows.filter((r) => r.status === "disponivel").length,
      em_viagem: rows.filter((r) => ["em_coleta", "em_transito", "em_entrega", "retornando"].includes(r.status)).length,
      manutencao: rows.filter((r) => r.status === "manutencao").length,
    };
  }, [q.data]);

  return (
    <AppShell
      title="Veículos"
      subtitle={`${filtered.length} veículos · frota completa da InfinitLog`}
      actions={
        <button
          onClick={() => navigate({ to: "/ops/veiculos/novo" })}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Novo veículo
        </button>
      }
    >
      {/* KPIs */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Total" value={counts.total} icon={<Truck className="h-4 w-4" />} tint="bg-blue-50 text-blue-700" />
        <Kpi label="Disponíveis" value={counts.disponivel} icon={<Gauge className="h-4 w-4" />} tint="bg-emerald-50 text-emerald-700" />
        <Kpi label="Em viagem" value={counts.em_viagem} icon={<MapPin className="h-4 w-4" />} tint="bg-indigo-50 text-indigo-700" />
        <Kpi label="Manutenção" value={counts.manutencao} icon={<AlertCircle className="h-4 w-4" />} tint="bg-amber-50 text-amber-700" />
      </div>

      {/* Toolbar */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Buscar por placa, modelo, marca, cidade…"
            className="h-11 w-full rounded-full border border-border bg-surface pl-10 pr-4 text-sm outline-none focus:border-brand"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
          className="h-11 rounded-full border border-border bg-surface px-4 text-sm"
        >
          <option value="all">Todos os status</option>
          {VEHICLE_STATUS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(0); }}
          className="h-11 rounded-full border border-border bg-surface px-4 text-sm"
        >
          <option value="all">Todos os tipos</option>
          {(types.data ?? []).map((t: any) => (
            <option key={t.id} value={t.name}>{t.name}</option>
          ))}
        </select>
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-sm">
          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="bg-transparent text-sm outline-none">
            <option value="created">Mais recentes</option>
            <option value="plate">Placa</option>
            <option value="status">Status</option>
            <option value="km">Quilometragem</option>
          </select>
        </div>
        <div className="inline-flex rounded-full border border-border bg-surface p-1">
          <button
            onClick={() => setView("cards")}
            className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium ${view === "cards" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Cards
          </button>
          <button
            onClick={() => setView("list")}
            className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium ${view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            <List className="h-3.5 w-3.5" /> Lista
          </button>
        </div>
      </div>

      {q.isLoading ? (
        <div className="grid place-items-center rounded-3xl border border-border bg-surface p-16 text-sm text-muted-foreground">
          Carregando frota…
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState onNew={() => navigate({ to: "/ops/veiculos/novo" })} />
      ) : view === "cards" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {paged.map((v: any) => (
            <VehicleCard key={v.id} v={v} driverName={driverName(v.owner_driver_id)} onOpen={() => navigate({ to: "/ops/veiculos/$id", params: { id: v.id } })} />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Veículo</th>
                <th className="px-4 py-3">Tipo / Capacidade</th>
                <th className="px-4 py-3">Motorista</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Cidade Atual</th>
                <th className="px-4 py-3 text-right">KM · Atualizado</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((v: any) => (
                <tr
                  key={v.id}
                  onClick={() => navigate({ to: "/ops/veiculos/$id", params: { id: v.id } })}
                  className="cursor-pointer border-t border-border transition hover:bg-accent/40"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {v.photo_url ? (
                        <img src={v.photo_url} alt="" className="h-10 w-14 rounded-lg object-cover" />
                      ) : (
                        <span className="grid h-10 w-14 place-items-center rounded-lg bg-surface-2">
                          <Truck className="h-5 w-5 text-muted-foreground" />
                        </span>
                      )}
                      <div className="min-w-0">
                        <div className="truncate font-semibold uppercase tracking-wide">{v.plate}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {[v.brand, v.model, v.year].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <div>{v.vehicle_type ?? "—"}</div>
                    <div className="text-xs">
                      {v.capacity_kg ? `${v.capacity_kg} kg` : "—"}
                      {v.capacity_m3 ? ` · ${v.capacity_m3} m³` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{driverName(v.owner_driver_id) ?? "—"}</td>
                  <td className="px-4 py-3"><span className={vehicleStatusBadgeClass(v.status)}><span className={`h-1.5 w-1.5 rounded-full ${vehicleStatusMeta(v.status).dot}`} />{vehicleStatusMeta(v.status).label}</span></td>
                  <td className="px-4 py-3 text-muted-foreground">{[v.current_city, v.current_state].filter(Boolean).join(", ") || "—"}</td>
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                    {v.current_km ? `${Number(v.current_km).toLocaleString("pt-BR")} km` : "—"}
                    <div>{v.last_location_at ? new Date(v.last_location_at).toLocaleString("pt-BR") : (v.updated_at ? new Date(v.updated_at).toLocaleString("pt-BR") : "—")}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={currentPage === 0} className="rounded-full border border-border bg-background px-4 py-1.5 text-sm disabled:opacity-40">Anterior</button>
          <span className="text-xs text-muted-foreground">Página {currentPage + 1} de {pageCount}</span>
          <button onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={currentPage >= pageCount - 1} className="rounded-full border border-border bg-background px-4 py-1.5 text-sm disabled:opacity-40">Próxima</button>
        </div>
      )}
    </AppShell>
  );
}

function Kpi({ label, value, icon, tint }: { label: string; value: number; icon: React.ReactNode; tint: string }) {
  return (
    <div className="card-soft flex items-center gap-4 p-5">
      <span className={`grid h-10 w-10 place-items-center rounded-full ${tint}`}>{icon}</span>
      <div>
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function VehicleCard({ v, driverName, onOpen }: { v: any; driverName: string | null; onOpen: () => void }) {
  const meta = vehicleStatusMeta(v.status);
  const nextExp = [
    { label: "CRLV", d: v.crlv_expires_at },
    { label: "Licenc.", d: v.licensing_expires_at },
    { label: "Seguro", d: v.insurance_expires_at },
    { label: "IPVA", d: v.ipva_expires_at },
  ]
    .map((x) => ({ ...x, days: daysUntil(x.d) }))
    .filter((x) => x.days !== null)
    .sort((a, b) => (a.days as number) - (b.days as number))[0];

  return (
    <button onClick={onOpen} className="card-soft flex flex-col gap-4 p-5 text-left transition hover:shadow-md">
      <div className="flex items-center gap-4">
        {v.photo_url ? (
          <img src={v.photo_url} alt="" className="h-16 w-24 rounded-xl object-cover" />
        ) : (
          <span className="grid h-16 w-24 place-items-center rounded-xl bg-surface-2">
            <Truck className="h-7 w-7 text-muted-foreground" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-lg font-semibold uppercase tracking-wide">{v.plate}</span>
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {[v.brand, v.model, v.year].filter(Boolean).join(" · ") || "—"}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {v.vehicle_type ?? "—"}
            {v.capacity_kg ? ` · ${v.capacity_kg} kg` : ""}
            {v.capacity_m3 ? ` · ${v.capacity_m3} m³` : ""}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={vehicleStatusBadgeClass(v.status)}>
          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
          {meta.label}
        </span>
        {driverName && (
          <span className="inline-flex rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {driverName}
          </span>
        )}
        {nextExp && (
          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${expiryBadgeClass(nextExp.days)}`}>
            {nextExp.label}: {(nextExp.days as number) < 0 ? `vencido` : `${nextExp.days}d`}
          </span>
        )}
      </div>
      <div className="mt-auto flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
        <span>
          <MapPin className="mr-1 inline h-3 w-3" />
          {[v.current_city, v.current_state].filter(Boolean).join(", ") || "sem localização"}
        </span>
        <span>{v.current_km ? `${Number(v.current_km).toLocaleString("pt-BR")} km` : "—"}</span>
      </div>
    </button>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="grid place-items-center rounded-3xl border border-border bg-surface p-16 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-surface-2 text-muted-foreground">
        <Truck className="h-6 w-6" />
      </span>
      <h2 className="mt-6 text-xl font-semibold tracking-tight">Nenhum veículo cadastrado</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Cadastre o primeiro veículo da frota com documentação, capacidade e status operacional.
      </p>
      <button onClick={onNew} className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow hover:opacity-90">
        <Plus className="h-4 w-4" /> Novo veículo
      </button>
    </div>
  );
}
