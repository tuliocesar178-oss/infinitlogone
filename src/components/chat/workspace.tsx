import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Search, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { OrderChat } from '@/components/orders/order-chat';
import { getChatDirectory, openIndividualChat, searchChat, contactMatches, type UnifiedContact } from '@/lib/unified-chat';
import { getOrCreateOperationRoom } from '@/lib/chat';
import { cn } from '@/lib/utils';
import { selectChatContact } from '@/lib/chat-selection';

export interface ChatWorkspaceProps { roomId?: string; orderId?: string; driverId?: string; staff?: boolean; }
export function ChatWorkspace({ roomId, orderId, driverId, staff = false }: ChatWorkspaceProps) {
  const qc = useQueryClient();
  const [term, setTerm] = useState('');
  const [selected, setSelected] = useState<UnifiedContact | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const automaticSelection = useRef('');
  const user = useQuery({ queryKey: ['chat-identity'], queryFn: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (!data.user) throw new Error('Não foi possível confirmar sua sessão.');
    return data.user.id;
  }, staleTime: 60000 });
  const identity = user.data || '';
  const directory = useQuery({ queryKey: ['unified-chat-directory', identity], queryFn: getChatDirectory, enabled: Boolean(identity), refetchInterval: 10000 });
  const matches = useQuery({ queryKey: ['unified-chat-search', identity, term], queryFn: () => searchChat(term), enabled: Boolean(identity && term.trim()), staleTime: 1000 });
  const rooms = directory.data || [];
  const context = useQuery({
    queryKey: ['chat-opening-context', identity, roomId, orderId, staff],
    enabled: Boolean(identity && (roomId || orderId)),
    queryFn: async () => {
      if (roomId) {
        const { data, error } = await supabase.from('chat_rooms').select('merged_into_room_id').eq('id', roomId).maybeSingle();
        if (error) throw error;
        return { canonicalRoomId: data?.merged_into_room_id };
      }
      if (!orderId) return {};
      const { data, error } = await supabase.from('orders').select('driver_id, created_by').eq('id', orderId).maybeSingle();
      if (error) throw error;
      return { orderPeerId: staff ? data?.driver_id : data?.created_by };
    },
  });
  useEffect(() => {
    if (!staff || !identity) return;
    void getOrCreateOperationRoom().then(() => qc.invalidateQueries({ queryKey: ['unified-chat-directory'] })).catch(() => undefined);
  }, [staff, identity, qc]);
  useEffect(() => {
    if (!identity) return;
    const channel = supabase.channel(`unified-chat:${identity}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        void qc.invalidateQueries({ queryKey: ['unified-chat-directory'] });
        void qc.invalidateQueries({ queryKey: ['chat-messages'] });
        void qc.invalidateQueries({ queryKey: ['unified-chat-search'] });
      }).on('postgres_changes', { event: '*', schema: 'public', table: 'chat_rooms' }, () => {
        void qc.invalidateQueries({ queryKey: ['unified-chat-directory'] });
      }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [identity, qc]);
  async function open(contact: UnifiedContact) {
    try {
      setOpening(contact.peer_id || contact.room_id);
      const id = contact.room_id || (contact.peer_id ? await openIndividualChat(contact.peer_id) : null);
      if (!id) return;
      setSelected({ ...contact, room_id: id });
      void qc.invalidateQueries({ queryKey: ['unified-chat-directory'] });
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível abrir a conversa.'); }
    finally { setOpening(null); }
  }
  useEffect(() => {
    const request = `${identity}:${roomId || ''}:${driverId || ''}:${orderId || ''}`;
    if (!identity || !rooms.length || automaticSelection.current === request) return;
    if ((roomId || orderId) && context.isPending) return;
    const contact = selectChatContact(rooms, { roomId, driverId, orderId, staff, ...context.data });
    if (!contact) return;
    automaticSelection.current = request;
    void open(contact);
  }, [rooms, roomId, driverId, orderId, staff, identity, context.data, context.isPending]);
  const visible = rooms.filter(contact => contactMatches(contact, term, matches.data || []));
  return <div className="flex h-[calc(100dvh-160px)] min-h-96 overflow-hidden rounded-lg border bg-background">
    <aside className={cn('flex w-full shrink-0 flex-col border-r bg-surface md:w-80', selected && 'hidden md:flex')}>
      <div className="space-y-4 border-b p-4"><h2 className="text-lg font-semibold">Meus chats</h2>
        <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Buscar conversa" placeholder="Buscar conversa..." value={term} onChange={e => setTerm(e.target.value)} className="pl-9" /></div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {(user.isPending || directory.isLoading) && <p className="p-6 text-sm text-muted-foreground">Carregando conversas...</p>}
        {(user.error || directory.error || matches.error || context.error) && <div className="p-4"><p className="text-sm text-destructive">Não foi possível carregar as conversas.</p><Button variant="outline" onClick={() => { void user.refetch(); if (identity) void directory.refetch(); if (term.trim()) void matches.refetch(); if (roomId || orderId) void context.refetch(); }}>Tentar novamente</Button></div>}
        {(['individual', 'group', 'history'] as const).map(category => {
          const contacts = visible.filter(c => c.category === category);
          if (!contacts.length) return null;
          return <section key={category}><h3 className="px-4 pb-2 pt-5 text-xs font-semibold uppercase text-muted-foreground">{category === 'individual' ? 'Conversas individuais' : category === 'group' ? 'Grupos' : 'Fretes e operações'}</h3>
            {contacts.map(contact => <Button key={contact.peer_id || contact.room_id} variant="ghost" aria-label={`Abrir ${contact.title}`} disabled={opening === (contact.peer_id || contact.room_id)} onClick={() => void open(contact)} className={cn('h-auto w-full justify-start gap-3 rounded-none px-4 py-3 text-left', selected?.room_id && selected.room_id === contact.room_id && 'bg-accent')}>
              <Avatar className="h-10 w-10 shrink-0"><AvatarImage src={contact.avatar_url || undefined} /><AvatarFallback>{contact.title.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
              <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{contact.title}</span><span className="block truncate text-xs font-normal text-muted-foreground">{contact.subtitle}</span></span>
              {contact.unread > 0 && <span className="grid h-6 min-w-6 place-items-center rounded-full bg-primary px-1 text-xs text-primary-foreground">{contact.unread}</span>}
            </Button>)}
          </section>;
        })}
        {!user.isPending && !user.error && !directory.isLoading && !directory.error && !visible.length && <p className="p-6 text-sm text-muted-foreground">Nenhuma conversa encontrada.</p>}
      </div>
    </aside>
    <section className={cn('flex min-w-0 flex-1 flex-col', !selected && 'hidden md:flex')}>
      {selected?.room_id ? <><div className="border-b p-2 md:hidden"><Button variant="ghost" onClick={() => setSelected(null)}><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Button></div>
        <OrderChat key={selected.room_id} roomId={selected.room_id} orderId={selected.category === 'history' ? selected.order_id : orderId} title={selected.title} subtitle={selected.subtitle} avatarUrl={selected.avatar_url || undefined} readOnly={selected.category === 'history'} driverView={!staff} onCallClick={selected.phone ? () => { window.location.href = `tel:${selected.phone}`; } : undefined} />
      </> : <div className="grid h-full place-content-center gap-3 text-center text-muted-foreground"><MessageSquare className="mx-auto h-10 w-10" /><p>Meus chats</p></div>}
    </section>
  </div>;
}
