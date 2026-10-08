import { supabase } from "@/integrations/supabase/client";

export type MessageKind = 'text' | 'image' | 'video' | 'document' | 'location' | 'audio' | 'system' | 'occurrence';
export type CallStatus = 'dialing' | 'ringing' | 'connected' | 'ended' | 'missed' | 'rejected';

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  kind: MessageKind;
  content: string;
  metadata: Record<string, unknown>;
  order_id?: string | null;
  order_code?: string | null;
  attachment_url?: string | null;
  read_at: string | null;
  created_at: string;
  sender?: {
    full_name: string;
    avatar_url?: string;
  };
}

export interface ChatRoom {
  id: string;
  order_id: string | null;
  driver_id?: string | null;
  created_at: string;
  last_message_at: string;
  team_members?: { full_name: string; avatar_url: string | null }[];
  driver_profile?: { full_name: string; avatar_url: string | null } | null;
  order?: {
    order_number: string;
    client_name?: string | null;
    driver?: { full_name: string; avatar_url: string | null };
    client?: { full_name: string; avatar_url: string | null };
  } | null;
}

/** Acrescenta os integrantes da equipe que realmente participaram de cada sala. */
export async function attachTeamMembersToRooms(
  rooms: ChatRoom[],
  _driverId: string,
): Promise<ChatRoom[]> {
  if (!rooms.length) return rooms;

  const roomIds = rooms.map((room) => room.id);
  const { data: participants, error } = await supabase.rpc('get_chat_room_team_members', {
    _room_ids: roomIds,
  });

  if (error) throw error;

  return rooms.map((room) => {
    const teamMembers = (participants || [])
      .filter((participant) => participant.room_id === room.id)
      .sort((first, second) => second.latest_message_at.localeCompare(first.latest_message_at))
      .map((participant) => ({
        full_name: participant.full_name,
        avatar_url: participant.avatar_url,
      }));

    return { ...room, team_members: teamMembers };
  });
}

export const CHAT_KIND_LABELS: Record<MessageKind, string> = {
  text: 'Texto',
  image: 'Imagem',
  video: 'Vídeo',
  document: 'Documento',
  location: 'Localização',
  audio: 'Áudio',
  system: 'Sistema',
  occurrence: 'Ocorrência'
};

export async function getRooms() {
  const { data, error } = await supabase
    .from('chat_rooms')
    .select(`
      *,
      driver_profile:profiles!chat_rooms_driver_id_fkey(full_name, avatar_url),
      order:orders(
        order_number:code,
        driver:profiles!orders_driver_id_fkey(full_name, avatar_url),
        client:profiles!orders_client_id_fkey(full_name, avatar_url)
      )
    `)
    .order('last_message_at', { ascending: false });
  
  if (error) throw error;
  return data as unknown as ChatRoom[];
}

export async function getMessages(roomId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase.rpc('get_unified_chat_messages', { _room: roomId });
  if (error) throw error;
  return data as unknown as ChatMessage[];
}

export async function sendMessage(roomId: string, content: string, kind: MessageKind = 'text', metadata: Record<string, unknown> = {}, orderId?: string) {
  const kinds = { text: 'text', image: 'photo', video: 'video', document: 'pdf', location: 'text', audio: 'audio', system: 'text', occurrence: 'text' } as const;
  const { error } = await supabase.rpc('send_unified_chat_message', {
    _room: roomId, _content: content, _order: orderId, _kind: kinds[kind], _metadata: metadata as import('@/integrations/supabase/types').Json,
  });
  if (error) throw error;
}

export async function markAsRead(messageIds: string[]) {
  const { error } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .in('id', messageIds);
  
  if (error) throw error;
}

/* ---------------------------------------------------------------
 * Central de comunicação com motoristas (conversa geral + fretes)
 * --------------------------------------------------------------- */

export type DriverPresence = 'online' | 'offline';

export interface DriverActiveOrder {
  id: string;
  code: string;
  status: string;
  origin_city: string | null;
  origin_state: string | null;
  destination_city: string | null;
  destination_state: string | null;
  client_name: string | null;
  room_id?: string | null;
}

export interface DriverContact {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  phone: string | null;
  cpf: string | null;
  city: string | null;
  state: string | null;
  availability: string;
  last_seen_at: string | null;
  current_lat: number | null;
  current_lng: number | null;
  vehicle_type: string | null;
  plate: string | null;
  presence: DriverPresence;
  active_order: DriverActiveOrder | null;
  orders: DriverActiveOrder[];
  room_id: string | null;
  unread: number;
}

const ONLINE_WINDOW_MS = 5 * 60 * 1000;

const ACTIVE_ORDER_STATUSES = [
  'driver_assigned', 'en_route_pickup', 'in_transit_to_pickup', 'near_pickup',
  'arriving_pickup', 'at_pickup', 'loading', 'loaded', 'picked_up',
  'out_for_delivery', 'in_transit', 'near_destination', 'arriving_destination',
  'at_destination', 'unloading', 'incident'
];

/** Lista todos os motoristas aprovados com veículo, presença e fretes. */
export async function getDriverContacts(): Promise<DriverContact[]> {
  const { data: { user } } = await supabase.auth.getUser();

  const { data: drivers, error } = await supabase
    .from('drivers')
    .select('user_id, phone, cpf, city, state, availability, last_seen_at, photo_url, current_vehicle_id, current_lat, current_lng')
    .eq('approval_status', 'active');
  if (error) throw error;
  if (!drivers?.length) return [];

  const userIds = drivers.map(d => d.user_id);
  const vehicleIds = drivers.map(d => d.current_vehicle_id).filter(Boolean) as string[];

  const [profilesRes, vehiclesRes, ordersRes, roomsRes] = await Promise.all([
    supabase.from('profiles').select('id, full_name, avatar_url').in('id', userIds),
    vehicleIds.length
      ? supabase.from('vehicles').select('id, plate, vehicle_type').in('id', vehicleIds)
      : Promise.resolve({ data: [], error: null } as any),
    supabase
      .from('orders')
      .select('id, code, status, driver_id, origin_city, origin_state, destination_city, destination_state, client_name')
      .in('driver_id', userIds)
      .is('deleted_at', null)
      .in('status', ACTIVE_ORDER_STATUSES as any),
    supabase.from('chat_rooms').select('id, order_id, driver_id')
  ]);

  const profiles = new Map((profilesRes.data || []).map((p: any) => [p.id, p]));
  const vehicles = new Map((vehiclesRes.data || []).map((v: any) => [v.id, v]));
  const rooms = roomsRes.data || [];
  const directRoomByDriver = new Map(
    rooms.filter((r: any) => !r.order_id && r.driver_id).map((r: any) => [r.driver_id, r.id])
  );
  const roomByOrder = new Map(rooms.filter((r: any) => r.order_id).map((r: any) => [r.order_id, r.id]));

  // Mensagens não lidas por sala (excluindo as próprias)
  const unreadByRoom = new Map<string, number>();
  if (rooms.length && user) {
    const { data: unread } = await supabase
      .from('messages')
      .select('room_id')
      .is('read_at', null)
      .neq('sender_id', user.id)
      .in('room_id', rooms.map((r: any) => r.id));
    (unread || []).forEach((m: any) => {
      unreadByRoom.set(m.room_id, (unreadByRoom.get(m.room_id) || 0) + 1);
    });
  }

  const ordersByDriver = new Map<string, DriverActiveOrder[]>();
  (ordersRes.data || []).forEach((o: any) => {
    const list = ordersByDriver.get(o.driver_id) || [];
    list.push({
      id: o.id,
      code: o.code,
      status: o.status,
      origin_city: o.origin_city,
      origin_state: o.origin_state,
      destination_city: o.destination_city,
      destination_state: o.destination_state,
      client_name: o.client_name,
      room_id: roomByOrder.get(o.id) || null
    });
    ordersByDriver.set(o.driver_id, list);
  });

  const now = Date.now();

  return drivers.map(d => {
    const profile: any = profiles.get(d.user_id);
    const vehicle: any = d.current_vehicle_id ? vehicles.get(d.current_vehicle_id) : null;
    const driverOrders = ordersByDriver.get(d.user_id) || [];
    const directRoom = directRoomByDriver.get(d.user_id) || null;
    const unread =
      (directRoom ? unreadByRoom.get(directRoom) || 0 : 0) +
      driverOrders.reduce((sum, o) => sum + (o.room_id ? unreadByRoom.get(o.room_id) || 0 : 0), 0);

    const seen = d.last_seen_at ? new Date(d.last_seen_at).getTime() : 0;
    const presence: DriverPresence =
      seen && now - seen < ONLINE_WINDOW_MS && d.availability !== 'offline' ? 'online' : 'offline';

    return {
      user_id: d.user_id,
      full_name: profile?.full_name || 'Motorista',
      avatar_url: profile?.avatar_url || d.photo_url || null,
      phone: d.phone,
      cpf: d.cpf,
      city: d.city,
      state: d.state,
      availability: d.availability,
      last_seen_at: d.last_seen_at,
      current_lat: d.current_lat,
      current_lng: d.current_lng,
      vehicle_type: vehicle?.vehicle_type || null,
      plate: vehicle?.plate || null,
      presence,
      active_order: driverOrders[0] || null,
      orders: driverOrders,
      room_id: directRoom,
      unread
    };
  }).sort((a, b) => {
    if (a.presence !== b.presence) return a.presence === 'online' ? -1 : 1;
    return a.full_name.localeCompare(b.full_name);
  });
}

/** Abre (ou cria, sem duplicar) a conversa geral com um motorista. */
export async function getOrCreateDriverRoom(driverId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_driver_room' as any, { _driver_id: driverId } as any);
  if (error) throw error;
  return data as unknown as string;
}

/* ---------------------------------------------------------------
 * Conversas internas entre membros da equipe
 * --------------------------------------------------------------- */

export interface TeamContact {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  position: string | null;
  phone: string | null;
  status: string;
  room_id: string | null;
  unread: number;
}

/** Lista os colegas internos (exceto o próprio usuário) com sala e não lidas. */
export async function getTeamContacts(): Promise<TeamContact[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: members, error } = await supabase
    .from('team_members')
    .select('user_id, full_name, position, phone, photo_url, status')
    .neq('user_id', user.id);
  if (error) throw error;
  if (!members?.length) return [];

  const ids = members.map((m) => m.user_id);
  const [profilesRes, roomsRes, rolesRes] = await Promise.all([
    supabase.from('profiles').select('id, full_name, avatar_url').in('id', ids),
    supabase
      .from('chat_rooms')
      .select('id, staff_a, staff_b, order_id')
      .is('order_id', null)
      .or(`staff_a.eq.${user.id},staff_b.eq.${user.id}`),
    supabase
      .from('user_roles')
      .select('user_id, role')
      .in('user_id', ids),
  ]);

  const operationRoles = new Set(['admin', 'supervisor', 'logistics', 'operacional']);
  const operationUserIds = new Set(
    (rolesRes.data || [])
      .filter((r: any) => operationRoles.has(r.role))
      .map((r: any) => r.user_id),
  );

  const profiles = new Map((profilesRes.data || []).map((p: any) => [p.id, p]));
  const rooms = (roomsRes.data || []) as any[];
  const roomByPeer = new Map<string, string>();
  rooms.forEach((r) => {
    if (!r.staff_a || !r.staff_b) return;
    const peer = r.staff_a === user.id ? r.staff_b : r.staff_a;
    roomByPeer.set(peer, r.id);
  });

  const unreadByRoom = new Map<string, number>();
  if (rooms.length) {
    const { data: unread } = await supabase
      .from('messages')
      .select('room_id')
      .is('read_at', null)
      .neq('sender_id', user.id)
      .in('room_id', rooms.map((r) => r.id));
    (unread || []).forEach((m: any) =>
      unreadByRoom.set(m.room_id, (unreadByRoom.get(m.room_id) || 0) + 1),
    );
  }

  return members
    .filter((m) => operationUserIds.has(m.user_id))
    .map((m) => {
      const profile: any = profiles.get(m.user_id);
      const roomId = roomByPeer.get(m.user_id) || null;
      return {
        user_id: m.user_id,
        full_name: profile?.full_name || m.full_name || 'Membro da equipe',
        avatar_url: profile?.avatar_url || m.photo_url || null,
        position: m.position,
        phone: m.phone,
        status: m.status,
        room_id: roomId,
        unread: roomId ? unreadByRoom.get(roomId) || 0 : 0,
      };
    })
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
}

/** Abre (ou cria, sem duplicar) a conversa interna com um colega. */
export async function getOrCreateStaffRoom(otherId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_staff_room' as any, { _other_id: otherId } as any);
  if (error) throw error;
  return data as unknown as string;
}

/** Abre ou cria a sala unica da equipe de operacao. */
export async function getOrCreateOperationRoom(): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_operation_room' as any);
  if (error) throw error;
  return data as unknown as string;
}

/** Marca como lidas as mensagens recebidas de uma sala. */
export async function markRoomAsRead(roomId: string) {
  const { error } = await supabase.rpc('mark_unified_chat_read', { _room: roomId });
  if (error) throw error;
}
