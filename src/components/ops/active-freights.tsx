import { Link } from "@tanstack/react-router";
import { Clock, Radio, Truck } from "lucide-react";
import { progressPercent, statusLabel, timeAgo } from "@/lib/ops-central";

export type ActiveOrder = {
  id: string;
  code: string;
  tracking_code: string;
  client_name?: string | null;
  origin_city?: string | null;
  destination_city?: string | null;
  status: string;
  distance_to_destination_km?: number | null;
  initial_distance_km?: number | null;
  eta_minutes?: number | null;
  last_ping_at?: string | null;
  driver_id?: string | null;
  vehicle_id?: string | null;
  driverName?: string | null;
  vehiclePlate?: string | null;
};

export function ActiveFreights({ orders }: { orders: ActiveOrder[] }) {
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-sky-100 text-sky-700">
            <Truck className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold">Em andamento</h2>
            <p className="text-[11px] text-muted-foreground">
              {orders.length} frete(s) ao vivo
            </p>
          </div>
        </div>
        <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-widest text-emerald-600">
          <Radio className="h-3 w-3 animate-pulse" /> live
        </span>
      </header>
      <div className="flex-1 overflow-y-auto p-3">
        {orders.length === 0 ? (
          <div className="grid h-full place-items-center text-center text-xs text-muted-foreground">
            Nenhum frete em execução
          </div>
        ) : (
          <ul className="space-y-2">
            {orders.map((o) => {
              const pct = progressPercent(o);
              const km = o.distance_to_destination_km;
              return (
                <Link
                  key={o.id}
                  to="/ops/pedidos/$id"
                  params={{ id: o.id }}
                  className="block rounded-xl border border-border/60 bg-card p-3 transition hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold">{o.code}</span>
                        <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {statusLabel(o.status)}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-sm font-semibold">
                        {o.client_name ?? "—"}
                      </div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {o.origin_city ?? "—"} → {o.destination_city ?? "—"}
                      </div>
                      <div className="mt-1 truncate text-[11px] text-muted-foreground">
                        {o.driverName ?? "Sem motorista"}
                        {o.vehiclePlate ? ` · ${o.vehiclePlate}` : ""}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold tabular-nums">
                        {km != null ? `${km.toFixed(1)} km` : "—"}
                      </div>
                      <div className="flex items-center justify-end gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {o.eta_minutes != null ? `${o.eta_minutes} min` : timeAgo(o.last_ping_at)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full rounded-full bg-brand transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="mt-1 text-right text-[10px] font-medium text-muted-foreground">
                      {pct}%
                    </div>
                  </div>
                </Link>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
