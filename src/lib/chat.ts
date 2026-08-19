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
  order_id: string;
  created_at: string;
  last_message_at: string;
  order?: {
    order_number: string;
    driver?: { full_name: string; avatar_url: string | null };
    client?: { full_name: string; avatar_url: string | null };
  };
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
