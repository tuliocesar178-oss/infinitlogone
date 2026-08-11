import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/client/insights")({
  component: () => (
    <AppShell title="Insights IA" subtitle="Análise preditiva da sua logística">
      <div className="card-soft p-12 text-center">
        <p className="text-muted-foreground">Módulo de insights em desenvolvimento.</p>
      </div>
    </AppShell>
  ),
});
