import { createFileRoute } from '@tanstack/react-router';
import { AppShell } from '@/components/app-shell';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getRooms, ChatRoom } from '@/lib/chat';
import { OrderChat } from '@/components/orders/order-chat';
import { Search, MessageSquare, Filter, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { z } from 'zod';

export const Route = createFileRoute('/_authenticated/ops/chat')({
  validateSearch: (search: Record<string, unknown>) => z.object({
    orderId: z.string().optional(),
    roomId: z.string().optional()
  }).parse(search),
  component: OpsChatPage
});

function OpsChatPage() {
  const searchParams = Route.useSearch();
  const orderId = (searchParams as any).orderId;
  const initialRoomId = (searchParams as any).roomId;
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [search, setSearch] = useState("");

  const { data: rooms = [], isLoading } = useQuery({
    queryKey: ['chat-rooms'],
    queryFn: getRooms,
    refetchInterval: 10000
  });

  // Effect to select room if orderId or roomId provided in search
  useState(() => {
    if (initialRoomId) {
      const room = rooms.find(r => r.id === initialRoomId);
      if (room) setSelectedRoom(room);
    } else if (orderId) {
      const room = rooms.find(r => r.order_id === orderId);
      if (room) setSelectedRoom(room);
    }
  });

  const filteredRooms = rooms.filter(r => 
    r.order?.order_number?.toLowerCase().includes(search.toLowerCase()) ||
    r.order?.driver?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.order?.client?.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell title="Chat da Operação" subtitle="Comunicação em tempo real">
      <div className="flex h-[calc(100vh-180px)] overflow-hidden bg-background border rounded-2xl shadow-sm">
        {/* Sidebar */}
        <div className="w-80 border-r flex flex-col bg-surface">
          <div className="p-4 border-b space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Conversas</h2>
              <Filter className="h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground" />
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por pedido ou nome..." 
                className="pl-9 bg-surface-2 border-none rounded-xl"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Carregando salas...</div>
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
                      <AvatarImage src={room.order?.driver?.avatar_url || ''} />
                      <AvatarFallback className="bg-primary/10 text-primary font-bold">
                        {room.order?.order_number.substring(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-0.5">
                        <span className="font-bold text-sm truncate">{room.order?.order_number}</span>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1 shrink-0">
                          <Clock className="h-3 w-3" />
                          {new Date(room.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="text-xs font-medium text-muted-foreground truncate">
                        {room.order?.driver?.full_name} • {room.order?.client?.full_name}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-surface-2/30">
          {selectedRoom ? (
            <div className="p-6 h-full flex flex-col">
              <OrderChat 
                roomId={selectedRoom.id}
                orderId={selectedRoom.order_id}
                title={selectedRoom.order?.order_number || "Pedido"}
                subtitle={`${selectedRoom.order?.driver?.full_name || 'Motorista'} | ${selectedRoom.order?.client?.full_name || 'Cliente'}`}
                avatarUrl={selectedRoom.order?.driver?.avatar_url || ''}
              />
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-12 text-center">
              <div className="w-20 h-20 bg-surface rounded-full flex items-center justify-center mb-6 shadow-sm">
                <MessageSquare className="h-10 w-10 text-primary/40" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Selecione uma conversa</h3>
              <p className="max-w-xs text-sm leading-relaxed">
                Escolha um chat na lista ao lado para iniciar a comunicação com o motorista e o cliente.
              </p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
