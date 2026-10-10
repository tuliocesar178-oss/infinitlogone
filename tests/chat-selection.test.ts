import { describe, expect, test } from 'bun:test';
import { selectChatContact } from '../src/lib/chat-selection';
import type { UnifiedContact } from '../src/lib/unified-chat';

const contact = (peer_id: string | null, room_id: string, category: UnifiedContact['category'], last_message_at: string | null): UnifiedContact => ({
  peer_id, room_id, category, last_message_at, title: peer_id || 'Histórico', order_id: category === 'history' ? 'order' : null,
  subtitle: '', avatar_url: null, phone: null, unread: 0,
});
const contacts = [contact(null, 'legacy', 'history', '2026-10-10'), contact('recent', 'recent-room', 'individual', '2026-10-09'), contact('creator', 'creator-room', 'individual', '2026-10-08')];
describe('Freight chat opening', () => {
  test('driver opens the freight creator individual chat', () => {
    expect(selectChatContact(contacts, { orderId: 'order', orderPeerId: 'creator' })?.room_id).toBe('creator-room');
  });
  test('driver fallback opens an authorized individual, not read-only history', () => {
    expect(selectChatContact(contacts, { orderId: 'order', orderPeerId: 'unknown' })?.room_id).toBe('recent-room');
  });
  test('never selects an unrelated fallback for explicit rooms', () => {
    expect(selectChatContact(contacts, { roomId: 'unauthorized', orderId: 'order' })).toBeUndefined();
  });
  test('resolves merged room links', () => {
    expect(selectChatContact(contacts, { roomId: 'source', canonicalRoomId: 'creator-room' })?.peer_id).toBe('creator');
  });
  test('staff opens the assigned driver only', () => {
    expect(selectChatContact(contacts, { orderId: 'order', orderPeerId: 'unknown', staff: true })).toBeUndefined();
  });
});