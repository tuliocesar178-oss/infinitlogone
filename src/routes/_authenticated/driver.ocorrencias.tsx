import { createFileRoute } from '@tanstack/react-router';
import { IncidentWorkspace } from '@/components/incidents/workspace';

export const Route = createFileRoute('/_authenticated/driver/ocorrencias')({
  head: () => ({ meta: [{ title: 'Ocorrências da Viagem — InfinitLog Motorista' }, { name: 'description', content: 'Registro de ocorrências pelo motorista, com anexos protegidos e respostas da operação.' }, { property: 'og:title', content: 'Ocorrências da Viagem — InfinitLog' }, { property: 'og:description', content: 'Histórico e acompanhamento das ocorrências do motorista.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex' }] }),
  component: () => <IncidentWorkspace driver />,
  errorComponent: ({ error }) => <p role="alert">Não foi possível abrir suas ocorrências: {error.message}</p>,
});