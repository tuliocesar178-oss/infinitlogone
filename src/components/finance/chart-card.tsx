import { cn } from "@/lib/utils";
import type { ComponentProps, ReactNode } from "react";

export interface ChartCardProps extends ComponentProps<"section"> {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function ChartCard({ title, description, actions, children, className, ...rest }: ChartCardProps) {
  return (
    <section
      {...rest}
      className={cn("rounded-xl border border-border bg-card p-4 shadow-sm", className)}
    >
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {actions}
      </header>
      <div className="h-64 w-full">{children}</div>
    </section>
  );
}
