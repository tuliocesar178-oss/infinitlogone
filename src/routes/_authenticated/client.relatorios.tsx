import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/client/relatorios")({
  component: () => (
    <AppShell title="Relatórios" subtitle="Consulte o desempenho da sua operação">
      <div className="card-soft p-12 text-center">
        <p className="text-muted-foreground">Módulo de relatórios em desenvolvimento.</p>
      </div>
    </AppShell>
  ),
});
