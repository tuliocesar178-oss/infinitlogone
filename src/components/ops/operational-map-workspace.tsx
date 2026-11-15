import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useOperationalTracking } from "@/hooks/use-operational-tracking";
import { activeTrackingOrders, filterTrackingOrders, operationalState, trackingRoutes, type OperationalFilter } from "@/lib/operational-tracking";
import type { BoardOrder } from "@/lib/operation-board";
import { DEFAULT_MONITORING } from "@/lib/operation-board-monitor";
import type { MapUnit } from "@/components/ops/tracking-map";
import { OperationalMapDetail } from "./operational-map-detail";
import { cn } from "@/lib/utils";
import { STATUS_LABEL } from "@/lib/order-status";

const TrackingMap = lazy(() => import("./tracking-map").then(m => ({ default: m.TrackingMap })));
const FILTERS: { key: OperationalFilter; label: string }[] = [{ key: "all", label: "Rotas ativas" }, { key: "transit", label: "Em trânsito" }, { key: "late", label: "Atrasadas" }, { key: "incident", label: "Com ocorrência" }, { key: "stale", label: "GPS desatualizado" }];
export interface OperationalMapWorkspaceProps { orders?: BoardOrder[]; selectedId?: string | null; connection?: boolean; clock?: number; }
export function OperationalMapWorkspace({ orders: scope, selectedId, connection, clock }: OperationalMapWorkspaceProps) {
  const shared = useOperationalTracking(connection === undefined);
  const { query } = shared;
  const connected = connection ?? shared.connected, now = clock ?? shared.now;
  const [filter, setFilter] = useState<OperationalFilter>("all"), [search, setSearch] = useState("");
  const [driver, setDriver] = useState(""), [client, setClient] = useState(""), [work, setWork] = useState(""), [status, setStatus] = useState("");
  const [selected, setSelected] = useState<string | null>(null), [following, setFollowing] = useState(false), [focus, setFocus] = useState(0);
  const data = query.data, settings = data?.settings ?? DEFAULT_MONITORING;
  const active = useMemo(() => activeTrackingOrders(scope ?? data?.orders ?? []), [scope, data?.orders]);
  useEffect(() => {
    if (selected && !active.some((order) => order.id === selected)) {
      setSelected(null);
      setFollowing(false);
    }
  }, [active, selected]);
  const scoped = active.filter(o => (!driver || o.driver_id === driver) && (!client || o.client_name === client) && (!work || o.work?.name === work) && (!status || o.status === status));
  const visible = filterTrackingOrders(scoped, filter, search, now, settings);
  const selectedOrder = visible.find(o => o.id === (selected ?? selectedId));
  const routes = useMemo(() => trackingRoutes(visible, now, settings), [visible, now, settings]);
  const units: MapUnit[] = visible.flatMap(o => {
    if (o.current_lat == null || o.current_lng == null || !Number.isFinite(o.current_lat) || !Number.isFinite(o.current_lng)) return [];
    const state = operationalState(o, now, settings);
    return [{ id: o.id, lat: o.current_lat, lng: o.current_lng, kind: state.incident || state.late ? "incident" : state.stale ? "offline" : "in_transit", title: o.driver?.full_name ?? "Motorista", subtitle: [o.code, o.vehicle?.plate, o.vehicle?.vehicle_type].filter(Boolean).join(" · "), avatarUrl: o.driver?.photo_url, heading: o.tracking_heading, statusLabel: [state.incident ? "Ocorrência" : state.late ? "Em atraso" : STATUS_LABEL[o.status], state.stale ? "GPS antigo" : ""].filter(Boolean).join(" · ") }];
  });
  const select = (id: string) => { setSelected(id); setFollowing(false); };
  const options = [
    { label: "Motorista", value: driver, change: setDriver, rows: [...new Map(active.filter(o => o.driver_id).map(o => [o.driver_id, { value: o.driver_id ?? "", label: o.driver?.full_name ?? "Motorista" }])).values()] },
    { label: "Cliente", value: client, change: setClient, rows: [...new Set(active.map(o => o.client_name).filter((v): v is string => Boolean(v)))].map(v => ({ value: v, label: v })) },
    { label: "Obra", value: work, change: setWork, rows: [...new Set(active.map(o => o.work?.name).filter((v): v is string => Boolean(v)))].map(v => ({ value: v, label: v })) },
    { label: "Status", value: status, change: setStatus, rows: [...new Set(active.map(o => o.status))].map(v => ({ value: v, label: STATUS_LABEL[v] ?? v })) },
  ];
  return <section className="min-w-0 space-y-3" aria-label="Mapa operacional em tempo real">
    <header className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">Rotas ativas</h2><span className={cn("text-xs", connected ? "text-success" : "text-warning")}>{connected ? "Conectado" : "Reconectando"} · {data ? new Date(data.updatedAt).toLocaleTimeString("pt-BR") : "Carregando"}</span></header>
    {query.error && <p role="alert" className="text-destructive">Não foi possível atualizar as rotas. <Button variant="link" onClick={() => void query.refetch()}>Tentar novamente</Button></p>}
    {!connected && data && <p role="status" className="text-xs text-warning">Dados temporariamente desatualizados; última consulta {new Date(data.updatedAt).toLocaleTimeString("pt-BR")}.</p>}
    <div className="flex flex-wrap gap-2">
      <span className="self-center text-sm text-muted-foreground">{new Set(active.map(o => o.driver_id)).size} motoristas em operação</span>
      {FILTERS.map(f => <Button key={f.key} size="sm" variant={filter === f.key ? "default" : "outline"} onClick={() => setFilter(f.key)} aria-pressed={filter === f.key}>{f.label} · {filterTrackingOrders(scoped, f.key, "", now, settings).length}</Button>)}
    </div>
    <div className="flex flex-wrap gap-2">
      <input aria-label="Pesquisar rotas" placeholder="Motorista, placa ou frete" value={search} onChange={e => setSearch(e.target.value)} className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm" />
      {options.map(o => <select key={o.label} aria-label={`Filtrar ${o.label.toLowerCase()}`} value={o.value} onChange={e => o.change(e.target.value)} className="h-9 max-w-full rounded-md border border-input bg-background px-2 text-sm"><option value="">{o.label}: todos</option>{o.rows.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}</select>)}
      <Button size="sm" variant="ghost" onClick={() => { setFilter("all"); setSearch(""); setDriver(""); setClient(""); setWork(""); setStatus(""); setSelected(null); setFollowing(false); }}>Limpar</Button>
    </div>
    <div className={cn("grid min-w-0 gap-4", selectedOrder && "xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]")}>
      <div className="min-w-0"><ClientOnly fallback={<MapLoading />}><Suspense fallback={<MapLoading />}><TrackingMap units={units} routes={routes} selectedId={selectedOrder?.id} onSelect={select} focusToken={focus} followSelected={following} className="h-[430px] min-w-0 border border-border" /></Suspense></ClientOnly>
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground"><span className="text-brand">Rota ativa</span><span className="text-destructive">Atraso / ocorrência</span><span>Traçado pontilhado: GPS antigo</span></div>
        {visible.length > routes.length && <p className="text-xs text-warning">{visible.length - routes.length} frete(s) sem itinerário disponível.</p>}
        {visible.length > units.length && <p className="text-xs text-warning">{visible.length - units.length} frete(s) sem posição GPS conhecida.</p>}
      </div>
      {selectedOrder && <OperationalMapDetail order={selectedOrder} now={now} settings={settings} incidents={data?.incidents ?? []} following={following} onFocus={() => setFocus(v => v + 1)} onFollow={() => { setFollowing(v => !v); setFocus(v => v + 1); }} onClose={() => { setSelected(null); setFollowing(false); }} />}
    </div>
    <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">{visible.map(o => <Button key={o.id} variant={selected === o.id ? "default" : "outline"} size="sm" onClick={() => select(o.id)}>{o.code} · {o.driver?.full_name ?? "Motorista"} · {o.vehicle?.plate ?? "Sem placa"}</Button>)}{!query.isPending && !visible.length && <p className="py-3 text-sm text-muted-foreground">Nenhuma rota nesta seleção.</p>}</div>
  </section>;
}
function MapLoading() { return <div className="grid h-[430px] place-items-center bg-surface-2 text-muted-foreground">Carregando mapa…</div>; }