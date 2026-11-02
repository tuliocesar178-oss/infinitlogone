import { createFileRoute } from '@tanstack/react-router';
import { AppShell } from '@/components/app-shell';
import { IncidentWorkspace } from '@/components/incidents/workspace';

export const Route = createFileRoute('/_authenticated/ops/ocorrencias')({
  validateSearch: (search: Record<string, unknown>): { incident?: string } => typeof search.incident === 'string' ? { incident: search.incident } : {},
  head: () => ({ meta: [{ title: 'Central de Ocorrências — InfinitLog Vapt Vupt' }, { name: 'description', content: 'Tratamento autorizado de ocorrências de viagens, responsáveis, orientações e anexos protegidos.' }, { property: 'og:title', content: 'Central de Ocorrências — InfinitLog' }, { property: 'og:description', content: 'Acompanhamento operacional de imprevistos de viagens.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex' }] }),
  component: IncidentPage,
  errorComponent: ({ error }) => <p role="alert">Não foi possível abrir as ocorrências: {error instanceof Error ? error.message : 'Tente novamente.'}</p>,
});
function IncidentPage() { const { incident } = Route.useSearch(); return <AppShell title="Ocorrências"><IncidentWorkspace initialIncidentId={incident} /></AppShell>; }