import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { VehicleForm } from "@/components/vehicle-form";
import { VehicleDocuments } from "@/components/vehicle-documents";
import { vehicleStatusBadgeClass, vehicleStatusMeta, formatDate } from "@/lib/vehicles";
import { ArrowLeft, Truck, FileText, History, Package } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ops/veiculos/$id")({
  head: () => ({ meta: [{ title: "Veículo — InfinitLog" }, { name: "robots", content: "noindex" }] }),
  component: VehicleDetail,
});

type Tab = "geral" | "documentos" | "historico";

function VehicleDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("geral");

  const q = useQuery({
    queryKey: ["vehicle", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicles").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const v = q.data as any;

  return (
    <AppShell
      title={v ? `${v.plate ?? "Veículo"}` : "Veículo"}
      subtitle={v ? [v.brand, v.model, v.year].filter(Boolean).join(" · ") : "Carregando…"}
      actions={
        <button
          onClick={() => navigate({ to: "/ops/veiculos" })}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2.5 text-sm font-semibold hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
      }
    >
      {q.isLoading ? (
        <div className="grid place-items-center rounded-3xl border border-border bg-surface p-16 text-sm text-muted-foreground">Carregando…</div>
      ) : !v ? (
        <div className="grid place-items-center rounded-3xl border border-border bg-surface p-16 text-sm text-muted-foreground">Veículo não encontrado.</div>
      ) : (
        <>
          {/* Header card */}
          <div className="card-soft mb-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
            {v.photo_url ? (
              <img src={v.photo_url} alt="" className="h-24 w-36 rounded-2xl object-cover" />
            ) : (
              <span className="grid h-24 w-36 place-items-center rounded-2xl bg-surface-2">
                <Truck className="h-8 w-8 text-muted-foreground" />
              </span>
            )}
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-xl font-semibold uppercase tracking-wide">{v.plate}</div>
                <span className={vehicleStatusBadgeClass(v.status)}>
                  <span className={`h-1.5 w-1.5 rounded-full ${vehicleStatusMeta(v.status).dot}`} />
                  {vehicleStatusMeta(v.status).label}
                </span>
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {[v.brand, v.model, v.year, v.color].filter(Boolean).join(" · ") || "—"}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-muted-foreground sm:grid-cols-4">
                <Info label="Tipo" value={v.vehicle_type ?? "—"} />
                <Info label="Capacidade" value={v.capacity_kg ? `${v.capacity_kg} kg` : "—"} />
                <Info label="KM atual" value={v.current_km ? `${Number(v.current_km).toLocaleString("pt-BR")} km` : "—"} />
                <Info label="Última atualização" value={v.updated_at ? new Date(v.updated_at).toLocaleString("pt-BR") : "—"} />
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mb-4 inline-flex rounded-full border border-border bg-surface p-1">
            <TabBtn active={tab === "geral"} onClick={() => setTab("geral")} icon={<Truck className="h-3.5 w-3.5" />} label="Geral" />
            <TabBtn active={tab === "documentos"} onClick={() => setTab("documentos")} icon={<FileText className="h-3.5 w-3.5" />} label="Documentos" />
            <TabBtn active={tab === "historico"} onClick={() => setTab("historico")} icon={<History className="h-3.5 w-3.5" />} label="Histórico" />
          </div>

          {tab === "geral" && (
            <VehicleForm
              initial={v}
              onSaved={async () => {
                await qc.invalidateQueries({ queryKey: ["vehicle", id] });
              }}
            />
          )}
          {tab === "documentos" && <VehicleDocuments vehicleId={v.id} />}
          {tab === "historico" && <VehicleHistory vehicleId={v.id} />}
        </>
      )}
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest">{label}</div>
      <div className="mt-0.5 text-sm text-foreground">{value}</div>
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
    >
      {icon}
      {label}
    </button>
  );
}

function VehicleHistory({ vehicleId }: { vehicleId: string }) {
  const q = useQuery({
    queryKey: ["vehicle-orders", vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, code, tracking_code, status, origin_city, destination_city, price, distance_km, created_at")
        .eq("vehicle_id", vehicleId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = (q.data ?? []) as any[];
  const totalKm = rows.reduce((s, r) => s + Number(r.distance_km ?? 0), 0);
  const totalRevenue = rows.reduce((s, r) => s + Number(r.price ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Fretes realizados" value={String(rows.length)} tint="bg-blue-50 text-blue-700" />
        <Kpi label="KM percorridos" value={`${totalKm.toLocaleString("pt-BR")} km`} tint="bg-indigo-50 text-indigo-700" />
        <Kpi label="Receita associada" value={totalRevenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} tint="bg-emerald-50 text-emerald-700" />
      </div>

      <div className="overflow-hidden rounded-3xl border border-border bg-surface">
        {rows.length === 0 ? (
          <div className="grid place-items-center p-12 text-center text-sm text-muted-foreground">
            <Package className="mb-3 h-8 w-8 opacity-40" />
            Nenhum frete registrado para este veículo ainda.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Pedido</th>
                <th className="px-4 py-3">Rota</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Distância</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3 text-right">Data</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-3 font-mono text-xs">{r.code}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.origin_city ?? "—"} → {r.destination_city ?? "—"}</td>
                  <td className="px-4 py-3 text-xs uppercase text-muted-foreground">{r.status}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{r.distance_km ? `${r.distance_km} km` : "—"}</td>
                  <td className="px-4 py-3 text-right">{r.price ? Number(r.price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}</td>
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground">{formatDate(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, tint }: { label: string; value: string; tint: string }) {
  return (
    <div className="card-soft p-5">
      <div className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-widest ${tint}`}>{label}</div>
      <div className="mt-3 text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}
