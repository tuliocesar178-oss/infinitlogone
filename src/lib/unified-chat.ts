import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';

export const chatContactSchema = z.object({
  peer_id: z.string().nullable(), room_id: z.string().nullable(), title: z.string(),
  avatar_url: z.string().nullable(), phone: z.string().nullable(), subtitle: z.string(),
  category: z.enum(['individual', 'group', 'history']), order_id: z.string().nullable(),
  last_message_at: z.string().nullable(), unread: z.number(),
});
export type UnifiedContact = z.infer<typeof chatContactSchema>;
export async function getChatDirectory(): Promise<UnifiedContact[]> {
  const { data, error } = await supabase.rpc('get_unified_chat_directory');
  if (error) throw error;
  return z.array(chatContactSchema).parse(data);
}
export async function openIndividualChat(other: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_individual_chat', { _other: other });
  if (error) throw error;
  return data;
}
export async function searchChat(term: string): Promise<string[]> {
  const { data, error } = await supabase.rpc('search_unified_chat', { _term: term });
  if (error) throw error;
  return z.array(z.string()).parse(data);
}
export function contactMatches(contact: UnifiedContact, term: string, roomMatches: string[]): boolean {
  return !term.trim() || contact.title.toLocaleLowerCase('pt-BR').includes(term.trim().toLocaleLowerCase('pt-BR')) || Boolean(contact.room_id && roomMatches.includes(contact.room_id));
}
