import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { ChatWorkspace } from '@/components/chat/workspace';

export const Route = createFileRoute('/_authenticated/driver/chat')({
  validateSearch: (search: Record<string, unknown>) => z.object({ orderId: z.string().optional(), roomId: z.string().optional(), driverId: z.string().optional() }).parse(search),
  head: () => ({ meta: [{ title: 'Meus chats — InfinitLog Motorista' }, { name: 'description', content: 'Conversas individuais e históricos autorizados da InfinitLog.' }, { property: 'og:title', content: 'Meus chats — InfinitLog driver' }, { property: 'og:description', content: 'Comunicação e referências de fretes da InfinitLog.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: ChatPage,
});
function ChatPage() {
  const search = Route.useSearch();
  return <ChatWorkspace {...search} />;
}
