import type { ReactNode } from "react";

export type Kpi = {
  key: string;
  label: string;
  value: string | number;
  icon?: ReactNode;
  tint?: string;
};

export function KpiBar({ kpis }: { kpis: Kpi[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-8">
      {kpis.map((k) => (
        <div
          key={k.key}
          className="card-soft flex items-center gap-2.5 rounded-xl p-3"
        >
          {k.icon && (
            <span
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${k.tint ?? "bg-brand/10 text-brand"}`}
            >
              {k.icon}
            </span>
          )}
          <div className="min-w-0">
            <div className="truncate text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              {k.label}
            </div>
            <div className="text-lg font-semibold tabular-nums">{k.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
