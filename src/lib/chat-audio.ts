import { supabase } from '@/integrations/supabase/client';
import { sendMessage } from '@/lib/chat';

export function audioExtension(mime: string): string {
  const type = mime.split(';')[0];
  const extensions: Record<string, string> = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/wav': 'wav' };
  if (!extensions[type]) throw new Error('Formato de áudio não suportado.');
  return extensions[type];
}

export async function sendChatAudio(roomId: string, blob: Blob, orderId?: string) {
  const mime = blob.type.split(';')[0];
  const extension = audioExtension(mime);
  if (!blob.size || blob.size > 10 * 1024 * 1024) throw new Error('Áudio vazio ou maior que 10 MB.');
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Entre novamente para enviar áudio.');
  const path = `${roomId}/${user.id}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from('chat-audio').upload(path, blob, { contentType: mime, upsert: false });
  if (error) throw new Error('Não foi possível enviar o arquivo de áudio. Tente novamente.');
  try {
    await sendMessage(roomId, 'Mensagem de áudio', 'audio', { audio_path: path, mime_type: mime }, orderId);
  } catch (cause) {
    await supabase.storage.from('chat-audio').remove([path]);
    throw cause;
  }
}