import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Send, Image as ImageIcon, Paperclip, MapPin, Phone,
  Smile, MoreVertical, CheckCheck, Download, Trash2, 
  Search, Filter, FileText
} from "lucide-react";
import { toast } from "sonner";
import { 
  getMessages, sendMessage, markRoomAsRead
} from "@/lib/chat";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { AudioRecorder } from '@/components/chat/audio-recorder';
import { AudioMessage } from '@/components/chat/audio-message';

interface ChatProps {
  roomId: string;
  orderId?: string | null;
  title: string;
  subtitle?: string;
  avatarUrl?: string;
  onCallClick?: () => void;
  readOnly?: boolean;
  driverView?: boolean;
}

export function OrderChat({ roomId, orderId, title, subtitle, avatarUrl, onCallClick, readOnly = false, driverView = false }: ChatProps) {
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const [me, setMe] = useState<{ id: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user));
  }, []);

  const { data: messages = [], isLoading, error: messagesError } = useQuery({
    queryKey: ["chat-messages", roomId],
    queryFn: () => getMessages(roomId),
    refetchInterval: 5000,
  });

  const sendMutation = useMutation({
    mutationFn: (content: string) => sendMessage(roomId, content, 'text', {}, orderId || undefined),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["chat-messages", roomId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  useEffect(() => {
    const channel = supabase
      .channel(`chat:${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` },
        () => qc.invalidateQueries({ queryKey: ["chat-messages", roomId] })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, qc]);

  useEffect(() => {
    if (messages.length) {
      void markRoomAsRead(roomId).then(() => qc.invalidateQueries({ queryKey: ['unified-chat-directory'] })).catch(() => undefined);
    }
    if (scrollRef.current) {
      const viewport = scrollRef.current.closest('[data-radix-scroll-area-viewport]');
      if (viewport) viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages, roomId, qc]);

  const handleSend = () => {
    if (!text.trim() || readOnly || sendMutation.isPending) return;
    sendMutation.mutate(text);
  };

  return (
    <div className="flex min-h-0 flex-col h-full w-full bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-4 bg-surface border-b shrink-0">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="h-10 w-10 border-2 border-primary/10">
            <AvatarImage src={avatarUrl} />
            <AvatarFallback className="bg-primary/5 text-primary font-bold">
              {title.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col">
            <h3 className="text-[15px] font-bold break-words">{title}</h3>
            <span className="text-[11px] font-medium text-muted-foreground">
              {subtitle || "Operacional"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="Ligar" disabled={!onCallClick} onClick={onCallClick} className="rounded-full hover:bg-success/10 hover:text-success">
            <Phone className="h-5 w-5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl">
              <DropdownMenuItem className="gap-2">
                <Search className="h-4 w-4" /> Buscar no chat
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2">
                <Filter className="h-4 w-4" /> Mídia e links
              </DropdownMenuItem>
              <DropdownMenuItem disabled className="gap-2 text-destructive">
                <Trash2 className="h-4 w-4" /> Limpar conversa
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-6 bg-surface-2/50">
        <div ref={scrollRef} className="flex flex-col gap-4">
          {isLoading && <p className="text-sm text-muted-foreground">Carregando mensagens...</p>}
          {messagesError && <p className="text-sm text-destructive">Não foi possível carregar as mensagens.</p>}
          {!isLoading && !messagesError && !messages.length && <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda.</p>}
          {messages.map((msg) => {
            const isMe = msg.sender_id === me?.id;
            return (
              <div 
                key={msg.id} 
                className={`flex flex-col max-w-[85%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}
              >
                {!isMe && (
                  <span className="text-[10px] font-bold text-muted-foreground ml-2 mb-1 uppercase tracking-tighter">
                    {msg.sender?.full_name}
                  </span>
                )}
                <div 
                  className={`px-4 py-2.5 rounded-2xl text-[14px] leading-relaxed shadow-sm ${
                    isMe 
                      ? 'bg-primary text-primary-foreground rounded-tr-none' 
                      : 'bg-card border rounded-tl-none'
                  }`}
                >
                  {msg.kind === 'text' && (
                    <span className="whitespace-pre-wrap break-words">
                      {msg.content}
                    </span>
                  )}
                  {msg.kind === 'location' && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" /> Localização enviada
                    </div>
                  )}
                  {msg.kind === 'system' && (
                    <div className="italic text-xs opacity-80">{msg.content}</div>
                  )}
                  {msg.kind === 'audio' && <AudioMessage path={typeof msg.metadata?.audio_path === 'string' ? msg.metadata.audio_path : undefined} legacyUrl={msg.attachment_url || (typeof msg.metadata?.url === 'string' ? msg.metadata.url : undefined)} />}
                  {msg.kind !== 'audio' && msg.kind !== 'text' && msg.kind !== 'system' && msg.kind !== 'location' && <div className="whitespace-pre-wrap break-words">{msg.content}</div>}
                  {msg.kind !== 'audio' && (msg.attachment_url || typeof msg.metadata?.url === 'string') && <a className="mt-2 block text-sm underline" href={msg.attachment_url || String(msg.metadata.url)} target="_blank" rel="noopener noreferrer">Abrir arquivo</a>}
                  {msg.order_id && msg.order_code && <div className="mt-2 border-t border-border/40 pt-2 text-xs">
                    <span className="block">Referência: {msg.order_code}</span>
                    <a className="underline" href={driverView ? `/driver/navegacao/${msg.order_id}` : `/ops/pedidos/${msg.order_id}`}>Ver frete</a>
                  </div>}
                  
                  <div className={`flex items-center gap-1 mt-1 text-[9px] ${isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {isMe && <CheckCheck className="h-3 w-3" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Input */}
      {readOnly ? <div className="border-t bg-surface p-4 text-sm text-muted-foreground">Histórico operacional · Somente leitura</div> : <div className="p-4 bg-surface border-t shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="icon" className="rounded-full shrink-0">
            <Smile className="h-5 w-5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full shrink-0">
                <Paperclip className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" className="rounded-xl min-w-[200px]">
              <DropdownMenuItem className="gap-2">
                <ImageIcon className="h-4 w-4 text-brand" /> Galeria / Fotos
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2">
                <FileText className="h-4 w-4 text-primary" /> Documentos / NF
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2">
                <MapPin className="h-4 w-4 text-success" /> Localização
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <div className="min-w-0 flex-1 relative">
            <Input 
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Digite uma mensagem..."
              className="rounded-full pr-12 h-11 border-border/60 bg-surface-2"
            />
            {text.trim() !== "" && (
              <Button 
                variant="default" 
                size="icon" 
                className="absolute right-1 top-1 rounded-full bg-primary hover:opacity-90 h-9 w-9"
                onClick={handleSend}
                aria-label="Enviar mensagem"
                disabled={sendMutation.isPending}
              >
                <Send className="h-4 w-4 text-primary-foreground" />
              </Button>
            )}
          </div>
          <AudioRecorder roomId={roomId} orderId={orderId || undefined} onSent={() => {
            void qc.invalidateQueries({ queryKey: ['chat-messages', roomId] });
            void qc.invalidateQueries({ queryKey: ['unified-chat-directory'] });
          }} />
        </div>
      </div>}
    </div>
  );
}
