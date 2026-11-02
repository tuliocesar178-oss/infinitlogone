import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/client/indicadores")({
  head: () => ({ meta: [{ title: 'client · indicadores — INFINITLOG' }, { name: "description", content: 'client · indicadores — INFINITLOG. Informações e acompanhamento na plataforma INFINITLOG VAPT VUPT.' }, { property: "og:title", content: 'client · indicadores — INFINITLOG' }, { property: "og:description", content: 'client · indicadores — INFINITLOG. Informações e acompanhamento na plataforma INFINITLOG VAPT VUPT.' }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" } ] }),
  component: () => (
    <AppShell title="Indicadores" subtitle="KPIs de performance (OTIF, SLA)">
      <div className="card-soft p-12 text-center">
        <p className="text-muted-foreground">Módulo de indicadores em desenvolvimento.</p>
      </div>
    </AppShell>
  ),
});
