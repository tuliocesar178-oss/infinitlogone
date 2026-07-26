import { Link } from "@tanstack/react-router";
import { AlertTriangle, Bell } from "lucide-react";
import { severityMeta, timeAgo, type OpsAlert } from "@/lib/ops-central";

export function AlertsPanel({ alerts }: { alerts: OpsAlert[] }) {
  const sorted = [...alerts].sort((a, b) => {
    const order = { critical: 0, warn: 1, info: 2 } as const;
    if (order[a.severity] !== order[b.severity]) return order[a.severity] - order[b.severity];
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-rose-100 text-rose-700">
            <AlertTriangle className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold">Central de alertas</h2>
            <p className="text-[11px] text-muted-foreground">{sorted.length} evento(s)</p>
          </div>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto p-3">
        {sorted.length === 0 ? (
          <div className="grid h-full place-items-center text-center text-xs text-muted-foreground">
            <div>
              <Bell className="mx-auto h-6 w-6 opacity-40" />
              <div className="mt-2">Tudo tranquilo</div>
            </div>
          </div>
        ) : (
          <ul className="space-y-2">
            {sorted.map((a) => {
              const meta = severityMeta(a.severity);
              const body = (
                <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-card p-3 transition hover:shadow-md">
                  <span
                    className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${meta.dot} ring-4 ${meta.ring}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate text-sm font-semibold">{a.title}</div>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {timeAgo(a.createdAt)}
                      </span>
                    </div>
                    {a.detail && (
                      <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {a.detail}
                      </div>
                    )}
                    <span
                      className={`mt-1 inline-block rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest ${meta.chip}`}
                    >
                      {a.kind}
                    </span>
                  </div>
                </div>
              );
              return (
                <li key={a.id}>
                  {a.orderId ? (
                    <Link to="/ops/pedidos/$id" params={{ id: a.orderId }}>
                      {body}
                    </Link>
                  ) : (
                    body
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
