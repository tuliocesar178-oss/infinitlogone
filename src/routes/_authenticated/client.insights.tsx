import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/client/insights")({
  head: () => ({ meta: [{ title: 'client · insights — INFINITLOG' }, { name: "description", content: 'client · insights — INFINITLOG. Informações e acompanhamento na plataforma INFINITLOG VAPT VUPT.' }, { property: "og:title", content: 'client · insights — INFINITLOG' }, { property: "og:description", content: 'client · insights — INFINITLOG. Informações e acompanhamento na plataforma INFINITLOG VAPT VUPT.' }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" } ] }),
  component: () => (
    <AppShell title="Insights IA" subtitle="Análise preditiva da sua logística">
      <div className="card-soft p-12 text-center">
        <p className="text-muted-foreground">Módulo de insights em desenvolvimento.</p>
      </div>
    </AppShell>
  ),
});
