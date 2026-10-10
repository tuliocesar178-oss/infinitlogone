import type { UnifiedContact } from './unified-chat';

export interface ChatSelectionContext {
  roomId?: string;
  canonicalRoomId?: string | null;
  driverId?: string;
  orderId?: string;
  orderPeerId?: string | null;
  staff?: boolean;
}

/** Only select contacts already returned by the authorized directory. */
export function selectChatContact(contacts: UnifiedContact[], context: ChatSelectionContext): UnifiedContact | undefined {
  if (context.roomId) return contacts.find(c => c.room_id === (context.canonicalRoomId || context.roomId));
  if (context.driverId) return contacts.find(c => c.peer_id === context.driverId);
  if (!context.orderId) return undefined;
  const peer = contacts.find(c => c.category === 'individual' && c.peer_id === context.orderPeerId);
  if (peer || context.staff) return peer;
  // A driver needs a writable individual conversation, not an ambiguous legacy history.
  return contacts.filter(c => c.category === 'individual').sort((a, b) =>
    (b.last_message_at || '').localeCompare(a.last_message_at || '') || a.title.localeCompare(b.title, 'pt-BR'))[0];
}