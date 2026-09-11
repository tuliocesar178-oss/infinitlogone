import { createFileRoute } from '@tanstack/react-router';
import { AppShell } from '@/components/app-shell';
import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getRooms, getDriverContacts, getOrCreateDriverRoom, markRoomAsRead,
  ChatRoom, DriverContact, DriverActiveOrder
} from '@/lib/chat';
import { STATUS_LABEL } from '@/lib/order-status';
import { supabase } from '@/integrations/supabase/client';
import { OrderChat } from '@/components/orders/order-chat';
import { Search, MessageSquare, Phone, MapPin, Truck, ArrowLeft, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { z } from 'zod';

export const Route = createFileRoute('/_authenticated/ops/chat')({
  validateSearch: (search: Record<string, unknown>) => z.object({
    orderId: z.string().optional(),
    roomId: z.string().optional(),
    driverId: z.string().optional()
  }).parse(search),
  component: OpsChatPage
});

type PresenceFilter = 'todos' | 'online' | 'offline' | 'operacao' | 'disponivel';

const FILTERS: { key: PresenceFilter; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'online', label: 'Online' },
  { key: 'operacao', label: 'Em operação' },
  { key: 'disponivel', label: 'Disponível' },
  { key: 'offline', label: 'Offline' }
];

interface ActiveChat {
  roomId: string;
  driver: DriverContact;
  order: DriverActiveOrder | null;
}

function lastSeenLabel(iso: string | null) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return `há ${Math.floor(hours / 24)} d`;
}

function OpsChatPage() {
  const searchParams = Route.useSearch() as { orderId?: string; roomId?: string; driverId?: string };
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<PresenceFilter>('todos');
  const [vehicleFilter, setVehicleFilter] = useState<string>('todos');
  const [active, setActive] = useState<ActiveChat | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ['chat-drivers'],
    queryFn: getDriverContacts,
    refetchInterval: 15000
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['chat-rooms'],
    queryFn: getRooms,
    refetchInterval: 20000
  });

  // Atualização em tempo real de motoristas, salas e mensagens
  useEffect(() => {
    const channel = supabase
      .channel('ops-chat-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' },
        () => qc.invalidateQueries({ queryKey: ['chat-drivers'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' },
        () => qc.invalidateQueries({ queryKey: ['chat-drivers'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_rooms' },
        () => {
          qc.invalidateQueries({ queryKey: ['chat-rooms'] });
          qc.invalidateQueries({ queryKey: ['chat-drivers'] });
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const openRoom = async (driver: DriverContact, order: DriverActiveOrder | null) => {
    try {
      setOpening(driver.user_id + (order?.id || ''));
      let roomId = order?.room_id || null;
      if (order && !roomId) {
        const room = rooms.find((r: ChatRoom) => r.order_id === order.id);
        roomId = room?.id || null;
      }
      if (!order) {
        roomId = driver.room_id || (await getOrCreateDriverRoom(driver.user_id));
      }
      if (!roomId) {
        toast.error('Conversa do frete ainda não foi criada.');
        return;
      }
      setActive({ roomId, driver, order });
      await markRoomAsRead(roomId);
      qc.invalidateQueries({ queryKey: ['chat-drivers'] });
    } catch (err: any) {
      toast.error(err?.message || 'Não foi possível abrir a conversa.');
    } finally {
      setOpening(null);
    }
  };

  // Abertura direta via link (?driverId / ?orderId / ?roomId)
  useEffect(() => {
    if (active || !drivers.length) return;
    if (searchParams.driverId) {
      const d = drivers.find(x => x.user_id === searchParams.driverId);
      if (d) void openRoom(d, null);
      return;
    }
    if (searchParams.orderId) {
      const d = drivers.find(x => x.orders.some(o => o.id === searchParams.orderId));
      const o = d?.orders.find(o => o.id === searchParams.orderId) || null;
      if (d && o) void openRoom(d, o);
      return;
    }
    if (searchParams.roomId) {
      const room = rooms.find((r: ChatRoom) => r.id === searchParams.roomId);
      if (!room) return;
      const d = drivers.find(x =>
        x.user_id === room.driver_id || x.orders.some(o => o.id === room.order_id));
      if (d) {
        const o = d.orders.find(o => o.id === room.order_id) || null;
        setActive({ roomId: room.id, driver: d, order: o });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drivers, rooms, searchParams.driverId, searchParams.orderId, searchParams.roomId]);

  const vehicleTypes = useMemo(
    () => Array.from(new Set(drivers.map(d => d.vehicle_type).filter(Boolean))) as string[],
    [drivers]
  );

  const counts = useMemo(() => ({
    todos: drivers.length,
    online: drivers.filter(d => d.presence === 'online').length,
    operacao: drivers.filter(d => d.orders.length > 0).length,
    disponivel: drivers.filter(d => d.orders.length === 0 && d.availability === 'disponivel').length,
    offline: drivers.filter(d => d.presence === 'offline').length
  }), [drivers]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return drivers.filter(d => {
      if (filter === 'online' && d.presence !== 'online') return false;
      if (filter === 'offline' && d.presence !== 'offline') return false;
      if (filter === 'operacao' && d.orders.length === 0) return false;
      if (filter === 'disponivel' && (d.orders.length > 0 || d.availability !== 'disponivel')) return false;
      if (vehicleFilter !== 'todos' && d.vehicle_type !== vehicleFilter) return false;
      if (!term) return true;
      return [d.full_name, d.phone, d.cpf, d.city, d.state, d.plate, d.vehicle_type]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(term));
    });
  }, [drivers, filter, vehicleFilter, search]);

  return (
    <AppShell title="Chat da Operação" subtitle="Comunicação em tempo real com a frota">
      <div className="flex h-[calc(100vh-180px)] overflow-hidden rounded-2xl border bg-background shadow-sm">
        {/* Lista de motoristas */}
        <aside className={cn(
          'flex w-full flex-col border-r bg-surface md:w-96',
          active && 'hidden md:flex'
        )}>
          <div className="space-y-3 border-b p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Motoristas</h2>
              <Badge variant="secondary" className="rounded-full">{counts.todos}</Badge>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { label: 'Online', value: counts.online },
                { label: 'Em operação', value: counts.operacao },
                { label: 'Disponíveis', value: counts.disponivel },
                { label: 'Offline', value: counts.offline }
              ].map(item => (
                <div key={item.label} className="rounded-xl bg-surface-2 p-2">
                  <div className="text-sm font-bold">{item.value}</div>
                  <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{item.label}</div>
                </div>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Nome, telefone, cidade, placa..."
                className="rounded-xl border-none bg-surface-2 pl-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors',
                    filter === f.key
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-surface-2 text-muted-foreground hover:text-foreground'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {vehicleTypes.length > 0 && (
              <select
                value={vehicleFilter}
                onChange={e => setVehicleFilter(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs"
              >
                <option value="todos">Todos os veículos</option>
                {vehicleTypes.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Carregando motoristas...</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Nenhum motorista encontrado.</div>
            ) : filtered.map(driver => {
              const inOperation = driver.orders.length > 0;
              const seen = lastSeenLabel(driver.last_seen_at);
              return (
                <div
                  key={driver.user_id}
                  className={cn(
                    'border-b p-3 transition-colors hover:bg-surface-2',
                    active?.driver.user_id === driver.user_id && 'bg-primary/5'
                  )}
                >
                  <button
                    onClick={() => openRoom(driver, null)}
                    className="flex w-full gap-3 text-left"
                  >
                    <div className="relative shrink-0">
                      <Avatar className="h-11 w-11 border-2 border-background">
                        <AvatarImage src={driver.avatar_url || ''} />
                        <AvatarFallback className="bg-primary/10 font-bold text-primary">
                          {driver.full_name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className={cn(
                        'absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-surface',
                        driver.presence === 'online' ? 'bg-emerald-500' : 'bg-muted-foreground/40'
                      )} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-bold">{driver.full_name}</span>
                        {driver.unread > 0 && (
                          <Badge className="h-5 min-w-5 justify-center rounded-full px-1.5 text-[10px]">
                            {driver.unread}
                          </Badge>
                        )}
                      </div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {[driver.vehicle_type, driver.plate].filter(Boolean).join(' • ') || 'Sem veículo vinculado'}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                        <span className={cn(
                          'font-semibold',
                          driver.presence === 'online' ? 'text-emerald-600' : 'text-muted-foreground'
                        )}>
                          {driver.presence === 'online' ? 'Online' : seen ? `Visto ${seen}` : 'Offline'}
                        </span>
                        {inOperation && (
                          <span className="rounded-full bg-blue-500/10 px-2 py-0.5 font-semibold text-blue-600">
                            Em operação
                          </span>
                        )}
                        {!inOperation && driver.availability === 'disponivel' && (
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-600">
                            Disponível
                          </span>
                        )}
                        {(driver.city || driver.state) && (
                          <span className="text-muted-foreground">
                            {[driver.city, driver.state].filter(Boolean).join('/')}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Ações rápidas */}
                  <div className="mt-2 flex items-center gap-1">
                    <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-[11px]"
                      onClick={() => openRoom(driver, null)}
                      disabled={opening === driver.user_id}>
                      {opening === driver.user_id
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <MessageSquare className="h-3 w-3" />} Chat
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-[11px]"
                      onClick={() => driver.phone
                        ? window.open(`tel:${driver.phone.replace(/\D/g, '')}`)
                        : toast.info('Motorista sem telefone cadastrado.')}>
                      <Phone className="h-3 w-3" /> Ligar
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-[11px]"
                      onClick={() => driver.current_lat && driver.current_lng
                        ? window.open(`https://www.google.com/maps?q=${driver.current_lat},${driver.current_lng}`, '_blank')
                        : toast.info('Localização não disponível.')}>
                      <MapPin className="h-3 w-3" /> Local
                    </Button>
                  </div>

                  {/* Conversas de frete */}
                  {driver.orders.map(order => (
                    <button
                      key={order.id}
                      onClick={() => openRoom(driver, order)}
                      className={cn(
                        'mt-1.5 flex w-full items-center gap-2 rounded-lg border border-dashed border-border px-2 py-1.5 text-left text-[11px] hover:bg-surface-2',
                        active?.roomId && active.order?.id === order.id && 'border-primary bg-primary/5'
                      )}
                    >
                      <Truck className="h-3 w-3 shrink-0 text-primary" />
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-semibold">{order.code}</span>{' '}
                        <span className="text-muted-foreground">
                          {[order.origin_city, order.destination_city].filter(Boolean).join(' → ')}
                        </span>
                      </span>
                      <span className="shrink-0 text-[9px] uppercase text-muted-foreground">
                        {STATUS_LABEL[order.status] || order.status}
                      </span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </aside>

        {/* Conversa */}
        <section className={cn('flex flex-1 flex-col bg-surface-2/30', !active && 'hidden md:flex')}>
          {active ? (
            <div className="flex h-full flex-col p-0 md:p-6">
              <div className="flex items-center gap-2 border-b bg-surface px-3 py-2 md:hidden">
                <Button variant="ghost" size="icon" onClick={() => setActive(null)}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <span className="text-sm font-bold">{active.driver.full_name}</span>
              </div>

              {active.order && (
                <div className="mb-3 rounded-xl border bg-surface p-3 text-xs">
                  <div className="mb-1 flex items-center gap-2 font-bold">
                    <Truck className="h-3.5 w-3.5 text-primary" /> Frete {active.order.code}
                    <Badge variant="secondary" className="ml-auto text-[10px]">
                      {STATUS_LABEL[active.order.status] || active.order.status}
                    </Badge>
                  </div>
                  <div className="text-muted-foreground">
                    {active.order.client_name && <div>Cliente: {active.order.client_name}</div>}
                    <div>
                      {[active.order.origin_city, active.order.origin_state].filter(Boolean).join('/')} →{' '}
                      {[active.order.destination_city, active.order.destination_state].filter(Boolean).join('/')}
                    </div>
                  </div>
                </div>
              )}

              <div className="min-h-0 flex-1">
                <OrderChat
                  key={active.roomId}
                  roomId={active.roomId}
                  orderId={active.order?.id || null}
                  title={active.driver.full_name}
                  subtitle={[
                    active.driver.presence === 'online' ? 'Online' : 'Offline',
                    [active.driver.vehicle_type, active.driver.plate].filter(Boolean).join(' • ')
                  ].filter(Boolean).join(' • ')}
                  avatarUrl={active.driver.avatar_url || ''}
                  onCallClick={() => active.driver.phone
                    ? window.open(`tel:${active.driver.phone.replace(/\D/g, '')}`)
                    : toast.info('Motorista sem telefone cadastrado.')}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-12 text-center text-muted-foreground">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-surface shadow-sm">
                <MessageSquare className="h-10 w-10 text-primary/40" />
              </div>
              <h3 className="mb-2 text-xl font-bold text-foreground">Selecione um motorista</h3>
              <p className="max-w-xs text-sm leading-relaxed">
                Converse com qualquer motorista aprovado ou abra a conversa específica de um frete.
              </p>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
