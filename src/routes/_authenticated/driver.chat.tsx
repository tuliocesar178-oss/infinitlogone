import { createFileRoute, redirect } from '@tanstack/react-router';
import { DriverShell } from '@/components/driver/shell';
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getOrCreateDriverRoom, ChatRoom } from '@/lib/chat';
import { OrderChat } from '@/components/orders/order-chat';
import { Search, MessageSquare, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { getUserRolesCached } from '@/lib/roles';

export const Route = createFileRoute('/_authenticated/driver/chat')({
  validateSearch: (search: Record<string, unknown>) => z.object({
    orderId: z.string().optional(),
    roomId: z.string().optional()
  }).parse(search),
  beforeLoad: async ({ context }) => {
    const user = (context as { user?: { id: string } }).user;
    if (!user) throw redirect({ to: "/auth" });
    const userRoles = await getUserRolesCached(user.id);
    if (!userRoles.includes("driver")) {
      throw redirect({ to: "/driver" });
    }
  },
  component: DriverChatPage
});

function DriverChatPage() {
  const searchParams = Route.useSearch();
  const orderId = searchParams.orderId;
  const initialRoomId = searchParams.roomId;
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [search, setSearch] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id || null));
  }, []);

  const { data: rooms = [], isLoading, error, refetch } = useQuery({
    queryKey: ['chat-rooms', userId],
    queryFn: async () => {
      if (!userId) return [];

      // Todo motorista aprovado possui uma conversa geral. Isso também permite
      // que ele inicie o contato, sem esperar a equipe enviar primeiro.
      await getOrCreateDriverRoom(userId);

      // Salas vinculadas a fretes do motorista
      const orderRooms = await supabase
        .from('chat_rooms')
        .select(`
          *,
          order:orders!inner(
            id,
            driver_id,
            order_number:code,
            client_name
          )
        `)
        .eq('order.driver_id', userId)
        .order('last_message_at', { ascending: false });
      if (orderRooms.error) throw orderRooms.error;

      // Conversa geral com a logística (sem frete vinculado)
      const directRooms = await supabase
        .from('chat_rooms')
        .select('*')
        .is('order_id', null)
        .eq('driver_id', userId)
        .order('last_message_at', { ascending: false });
      if (directRooms.error) throw directRooms.error;

      const direct = (directRooms.data || []).map((r: any) => ({
        ...r,
        order: null,
      }));

      return [...direct, ...(orderRooms.data || [])] as unknown as ChatRoom[];
    },
    enabled: !!userId,
    refetchInterval: 10000
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`driver-chat-list:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_rooms' }, () => {
        queryClient.invalidateQueries({ queryKey: ['chat-rooms', userId] });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        queryClient.invalidateQueries({ queryKey: ['chat-rooms', userId] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);

  useEffect(() => {
    if (initialRoomId) {
      const room = rooms.find(r => r.id === initialRoomId);
      if (room) setSelectedRoom(room);
    } else if (orderId) {
      const room = rooms.find(r => r.order_id === orderId);
      if (room) setSelectedRoom(room);
    }
  }, [initialRoomId, orderId, rooms]);

  // O chat do motorista é sempre uma conversa com a equipe de operação.
  // O frete permanece identificado apenas como contexto da conversa,
  // evitando que o código PED seja exibido como nome principal.
  const roomLabel = (_r: ChatRoom) => 'Equipe de Operação';

  const roomSearchText = (r: ChatRoom) =>
    [roomLabel(r), r.order?.order_number, r.order?.client_name]
      .filter(Boolean)
      .join(' ');

  const filteredRooms = rooms.filter(r =>
    roomSearchText(r).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100dvh-130px)] overflow-hidden bg-background border rounded-2xl shadow-sm">
      {/* Sidebar - Ocultar se um chat estiver aberto no mobile */}
      <div className={`${selectedRoom ? 'hidden md:flex' : 'flex'} w-full md:w-80 border-r flex-col bg-surface`}>
        <div className="p-4 border-b space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Minhas Conversas</h2>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar conversa..." 
              className="pl-9 bg-surface-2 border-none rounded-xl"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando salas...</div>
          ) : error ? (
            <div className="space-y-3 p-8 text-center text-sm text-muted-foreground">
              <p>Não foi possível carregar suas conversas.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Tentar novamente</Button>
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma conversa encontrada.</div>
          ) : (
            filteredRooms.map(room => (
              <div 
                key={room.id}
                onClick={() => setSelectedRoom(room)}
                className={`p-4 border-b cursor-pointer transition-colors hover:bg-surface-2 ${selectedRoom?.id === room.id ? 'bg-primary/5 border-l-4 border-l-primary' : ''}`}
              >
                <div className="flex gap-3">
                  <Avatar className="h-12 w-12 border-2 border-background">
                    <AvatarFallback className="bg-primary/10 text-primary font-bold">
                      {roomLabel(room).substring(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-0.5">
                      <span className="font-bold text-sm truncate">{roomLabel(room)}</span>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1 shrink-0">
                        <Clock className="h-3 w-3" />
                        {new Date(room.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-xs font-medium text-muted-foreground truncate">
                      {room.order
                        ? `Frete • ${room.order.order_number}`
                        : 'Comunicação interna da operação'}
                    </div>
                  </div>

                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`${selectedRoom ? 'flex' : 'hidden md:flex'} flex-1 flex-col bg-surface-2/30`}>
        {selectedRoom ? (
          <div className="flex flex-col h-full">
            <div className="md:hidden p-4 bg-background border-b flex items-center justify-between">
              <button 
                onClick={() => setSelectedRoom(null)}
                className="text-sm font-bold text-brand flex items-center gap-1"
              >
                ← Voltar
              </button>
              <span className="font-bold text-sm truncate">
                {roomLabel(selectedRoom)}
              </span>
            </div>
            <div className="flex-1 p-0 md:p-6 overflow-hidden">
              <OrderChat 
                roomId={selectedRoom.id}
                orderId={selectedRoom.order_id}
                title={roomLabel(selectedRoom)}
                subtitle={
                  selectedRoom.order
                    ? `Equipe de Operação • Frete ${selectedRoom.order.order_number}`
                    : 'Equipe de Operação • InfinitLog Transportes'
                }
                onCallClick={() => toast.info("Chamando central...")}
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-12 text-center">
            <div className="w-20 h-20 bg-surface rounded-full flex items-center justify-center mb-6 shadow-sm">
              <MessageSquare className="h-10 w-10 text-primary/40" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Equipe de Operação</h3>
            <p className="max-w-xs text-sm leading-relaxed">
              Selecione uma conversa para falar com a equipe de operação em tempo real.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
