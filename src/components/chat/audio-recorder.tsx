import { useEffect, useRef, useState } from 'react';
import { Mic, Send, Square, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { sendChatAudio } from '@/lib/chat-audio';

export interface AudioRecorderProps { roomId: string; orderId?: string; onSent: () => void; }
export function AudioRecorder({ roomId, orderId, onSent }: AudioRecorderProps) {
  const [state, setState] = useState<'idle' | 'starting' | 'recording' | 'preview' | 'sending'>('idle');
  const [clip, setClip] = useState<Blob | null>(null);
  const [url, setUrl] = useState('');
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => {
    mounted.current = false;
    if (recorder.current?.state === 'recording') recorder.current.stop();
    stream.current?.getTracks().forEach(track => track.stop());
  }; }, []);
  useEffect(() => {
    if (!clip) { setUrl(''); return; }
    const value = URL.createObjectURL(clip); setUrl(value);
    return () => URL.revokeObjectURL(value);
  }, [clip]);
  async function start() {
    if (state !== 'idle') return;
    setState('starting');
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('Este navegador não permite gravação. Abra o app no Chrome ou Safari e permita o microfone.');
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media;
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm'].find(type => MediaRecorder.isTypeSupported(type));
      const recording = new MediaRecorder(media, mimeType ? { mimeType } : undefined);
      recorder.current = recording;
      const chunks: Blob[] = [];
      recording.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recording.onstop = () => {
        media.getTracks().forEach(track => track.stop());
        if (!mounted.current) return;
        const blob = new Blob(chunks, { type: recording.mimeType });
        if (!blob.size) { toast.error('Nenhum áudio foi gravado. Tente novamente.'); setState('idle'); return; }
        setClip(blob); setState('preview');
      };
      recording.onerror = () => { media.getTracks().forEach(track => track.stop()); toast.error('A gravação foi interrompida.'); setState('idle'); };
      recording.start(); setState('recording');
    } catch (error) {
      stream.current?.getTracks().forEach(track => track.stop());
      if (mounted.current) setState('idle');
      toast.error(error instanceof DOMException && error.name === 'NotAllowedError' ? 'Permita o microfone nas configurações do navegador para gravar áudio.' : error instanceof Error ? error.message : 'Não foi possível abrir o microfone.');
    }
  }
  async function send() {
    if (!clip || state !== 'preview') return;
    setState('sending');
    try { await sendChatAudio(roomId, clip, orderId); if (mounted.current) { setClip(null); setState('idle'); onSent(); } }
    catch (error) { if (mounted.current) setState('preview'); toast.error(error instanceof Error ? error.message : 'Falha ao enviar áudio.'); }
  }
  if (state === 'idle' || state === 'starting') return <Button variant="ghost" size="icon" aria-label="Gravar áudio" title="Gravar áudio" disabled={state === 'starting'} onClick={() => void start()}><Mic className="h-5 w-5" /></Button>;
  if (state === 'recording') return <div className="flex items-center gap-2"><span role="status" className="text-xs text-destructive">Gravando</span><Button variant="ghost" size="icon" aria-label="Parar gravação" title="Parar gravação" onClick={() => recorder.current?.stop()}><Square className="h-5 w-5" /></Button></div>;
  return <div className="flex min-w-0 flex-wrap items-center gap-1">
    <audio aria-label="Prévia do áudio" controls src={url} className="h-10 w-44 max-w-full" />
    <Button variant="ghost" size="icon" aria-label="Descartar áudio" title="Descartar áudio" disabled={state === 'sending'} onClick={() => { setClip(null); setState('idle'); }}><Trash2 className="h-4 w-4" /></Button>
    <Button size="icon" aria-label="Enviar áudio" title="Enviar áudio" disabled={state === 'sending'} onClick={() => void send()}><Send className="h-4 w-4" /></Button>
    {state === 'sending' && <span role="status" className="text-xs">Enviando...</span>}
  </div>;
}