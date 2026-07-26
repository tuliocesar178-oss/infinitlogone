import { Link } from "@tanstack/react-router";
import { ArrowRight, MapPin, Package, Truck, Zap } from "lucide-react";
import { formatBRL, priorityChip } from "@/lib/ops-central";

export type DispatchOrder = {
  id: string;
  code: string;
  tracking_code: string;
  client_name?: string | null;
  origin_city?: string | null;
  destination_city?: string | null;
  cargo_weight_kg?: number | null;
  volumes?: number | null;
  price?: number | null;
  priority?: string | null;
  pickup_window_start?: string | null;
  pickup_window_end?: string | null;
  created_at?: string | null;
};

export function DispatchQueue({
  orders,
  onDispatch,
}: {
  orders: DispatchOrder[];
  onDispatch?: (o: DispatchOrder) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-100 text-amber-700">
            <Package className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold">Aguardando despacho</h2>
            <p className="text-[11px] text-muted-foreground">{orders.length} pedido(s)</p>
          </div>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto p-3">
        {orders.length === 0 ? (
          <div className="grid h-full place-items-center text-center text-xs text-muted-foreground">
            <div>
              <Truck className="mx-auto h-6 w-6 opacity-40" />
              <div className="mt-2">Nenhum pedido aguardando</div>
            </div>
          </div>
        ) : (
          <ul className="space-y-2">
            {orders.map((o) => (
              <li
                key={o.id}
                className="rounded-xl border border-border/60 bg-card p-3 transition hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold">{o.code}</span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest ${priorityChip(o.priority)}`}
                      >
                        {o.priority ?? "normal"}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-sm font-semibold">
                      {o.client_name ?? "Cliente"}
                    </div>
                    <div className="mt-1 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {o.origin_city ?? "—"} → {o.destination_city ?? "—"}
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <div className="font-semibold tabular-nums">{formatBRL(o.price)}</div>
                    {o.cargo_weight_kg != null && (
                      <div className="text-[10px] text-muted-foreground">
                        {o.cargo_weight_kg} kg
                        {o.volumes ? ` · ${o.volumes} vol` : ""}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() => onDispatch?.(o)}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground hover:opacity-90"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    Despachar
                  </button>
                  <Link
                    to="/ops/pedidos/$id"
                    params={{ id: o.id }}
                    className="inline-flex items-center justify-center rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
