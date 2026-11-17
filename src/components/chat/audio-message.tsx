import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AudioMessageProps { path?: string; legacyUrl?: string; }
export function AudioMessage({ path, legacyUrl }: AudioMessageProps) {
  const audio = useQuery({
    queryKey: ['chat-audio-url', path], enabled: Boolean(path), staleTime: 240_000, refetchInterval: 240_000,
    queryFn: async () => {
      if (!path) return null;
      const { data, error } = await supabase.storage.from('chat-audio').createSignedUrl(path, 300);
      if (error) throw error;
      return data.signedUrl;
    },
  });
  const url = audio.data ?? legacyUrl;
  if (audio.isError) return <p role="alert">Não foi possível carregar o áudio.</p>;
  if (!url) return <p className="text-xs">Carregando áudio...</p>;
  return <audio aria-label="Mensagem de áudio" controls preload="metadata" src={url} className="h-10 w-56 max-w-full" />;
}