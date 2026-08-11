import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/client/indicadores")({
  component: () => (
    <AppShell title="Indicadores" subtitle="KPIs de performance (OTIF, SLA)">
      <div className="card-soft p-12 text-center">
        <p className="text-muted-foreground">Módulo de indicadores em desenvolvimento.</p>
      </div>
    </AppShell>
  ),
});
