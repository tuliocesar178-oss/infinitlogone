import { cn } from "@/lib/utils";
import type { ComponentProps, ReactNode } from "react";

export interface KpiCardProps extends ComponentProps<"div"> {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  tone?: "default" | "positive" | "warning" | "danger";
}

const TONE: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  default: "text-foreground",
  positive: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  danger: "text-destructive",
};

export function KpiCard({ label, value, hint, icon, tone = "default", className, ...rest }: KpiCardProps) {
  return (
    <div
      {...rest}
      className={cn(
        "rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/40",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      </div>
      <p className={cn("mt-2 text-2xl font-semibold tabular-nums", TONE[tone])}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
