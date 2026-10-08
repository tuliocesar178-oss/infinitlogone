import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { ChatWorkspace } from '@/components/chat/workspace';
import { AppShell } from '@/components/app-shell';

export const Route = createFileRoute('/_authenticated/ops/chat')({
  validateSearch: (search: Record<string, unknown>) => z.object({ orderId: z.string().optional(), roomId: z.string().optional(), driverId: z.string().optional() }).parse(search),
  head: () => ({ meta: [{ title: 'Meus chats — InfinitLog Operação' }, { name: 'description', content: 'Conversas individuais e históricos autorizados da InfinitLog.' }, { property: 'og:title', content: 'Meus chats — InfinitLog ops' }, { property: 'og:description', content: 'Comunicação e referências de fretes da InfinitLog.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: ChatPage,
});
function ChatPage() {
  const search = Route.useSearch();
  return <AppShell title="Meus chats"><ChatWorkspace {...search} staff /></AppShell>;
}
