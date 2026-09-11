import { supabase } from "@/integrations/supabase/client";

export type MessageKind = 'text' | 'image' | 'video' | 'document' | 'location' | 'audio' | 'system' | 'occurrence';
export type CallStatus = 'dialing' | 'ringing' | 'connected' | 'ended' | 'missed' | 'rejected';

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  kind: MessageKind;
  content: string;
  metadata: any;
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
  driver_profile?: { full_name: string; avatar_url: string | null } | null;
  order?: {
    order_number: string;
    driver?: { full_name: string; avatar_url: string | null };
    client?: { full_name: string; avatar_url: string | null };
  } | null;
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

export async function getMessages(roomId: string) {
  const { data, error } = await supabase
    .from('messages')
    .select('*, sender:profiles!messages_sender_id_fkey(full_name, avatar_url)')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true });
  
  if (error) throw error;
  return data as unknown as ChatMessage[];
}

export async function sendMessage(roomId: string, content: string, kind: MessageKind = 'text', metadata: any = {}, orderId?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  const { error } = await supabase.from('messages').insert({
    room_id: roomId,
    order_id: orderId || null,
    sender_id: user.id,
    kind: kind as any,
    content,
    metadata
  } as any);

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

/** Marca como lidas as mensagens recebidas de uma sala. */
export async function markRoomAsRead(roomId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('room_id', roomId)
    .is('read_at', null)
    .neq('sender_id', user.id);
}
