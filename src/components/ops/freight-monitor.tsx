import { AlertTriangle, ArrowRight, Radio } from "lucide-react";
import { progressPercent, statusLabel, timeAgo } from "@/lib/ops-central";
import { STATUS_BADGE_CLASS } from "@/lib/order-status";

export type MonitorOrder = {
  id: string;
  code: string;
  status: string;
  client_name?: string | null;
  origin_city?: string | null;
  destination_city?: string | null;
  distance_to_destination_km?: number | null;
  initial_distance_km?: number | null;
  eta_minutes?: number | null;
  last_ping_at?: string | null;
  driverName?: string | null;
  vehiclePlate?: string | null;
  hasIncident?: boolean;
};

export function FreightMonitor({
  orders,
  onSelect,
}: {
  orders: MonitorOrder[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand/10 text-brand">
            <Radio className="h-4 w-4 animate-pulse" />
          </span>
          <div>
            <h2 className="text-sm font-semibold">Monitor de fretes</h2>
            <p className="text-[11px] text-muted-foreground">{orders.length} em execução</p>
          </div>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Código</th>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Motorista</th>
              <th className="px-3 py-2">Rota</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">ETA</th>
              <th className="px-3 py-2 w-40">Progresso</th>
              <th className="px-3 py-2">Ocorr.</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-xs text-muted-foreground">
                  Nenhum frete em execução.
                </td>
              </tr>
            )}
            {orders.map((o) => {
              const pct = progressPercent(o);
              const badge = STATUS_BADGE_CLASS[o.status] ?? "bg-muted text-muted-foreground";
              return (
                <tr
                  key={o.id}
                  onClick={() => onSelect(o.id)}
                  className="cursor-pointer border-t border-border/50 transition hover:bg-accent/40"
                >
                  <td className="px-3 py-2 font-mono text-xs font-semibold">{o.code}</td>
                  <td className="px-3 py-2 truncate max-w-[180px]">{o.client_name ?? "—"}</td>
                  <td className="px-3 py-2 truncate max-w-[160px] text-xs">
                    {o.driverName ?? <span className="text-muted-foreground">—</span>}
                    {o.vehiclePlate ? (
                      <span className="ml-1 rounded bg-surface-2 px-1 py-0.5 font-mono text-[10px]">
                        {o.vehiclePlate}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 truncate max-w-[220px] text-xs text-muted-foreground">
                    {o.origin_city ?? "—"} → {o.destination_city ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge}`}>
                      {statusLabel(o.status)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {o.eta_minutes != null ? `${o.eta_minutes} min` : timeAgo(o.last_ping_at)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-8 text-right text-[10px] font-semibold tabular-nums">{pct}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {o.hasIncident ? (
                      <AlertTriangle className="h-4 w-4 text-rose-600" />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
