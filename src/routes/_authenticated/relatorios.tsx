import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { OperationalReports } from "@/components/operational-reports";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios Operacionais — InfinitLog" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  return (
    <AppShell
      title="Relatórios"
      subtitle="Análise operacional de clientes, obras, fretes e quilômetros rodados."
    >
      <OperationalReports />
    </AppShell>
  );
}