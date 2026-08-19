import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Send, Image as ImageIcon, Paperclip, MapPin, Mic, Phone, 
  Smile, MoreVertical, Check, CheckCheck, Download, Trash2, 
  CornerUpLeft, Reply, Forward, Search, Filter, PhoneCall
} from "lucide-react";
import { toast } from "sonner";
import { 
  getMessages, sendMessage, markAsRead, ChatMessage, 
  MessageKind, CHAT_KIND_LABELS 
} from "@/lib/chat";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

interface ChatProps {
  roomId: string;
  orderId: string;
  title: string;
  subtitle?: string;
  avatarUrl?: string;
  onCallClick?: () => void;
}

export function OrderChat({ roomId, orderId, title, subtitle, avatarUrl, onCallClick }: ChatProps) {
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const [isRecording, setIsRecording] = useState(false);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["chat-messages", roomId],
    queryFn: () => getMessages(roomId),
    refetchInterval: 5000,
  });

  const sendMutation = useMutation({
    mutationFn: (content: string) => sendMessage(roomId, content, 'text', {}, orderId),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["chat-messages", roomId] });
    },
    onError: (err: any) => toast.error(err.message),
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
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!text.trim()) return;
    sendMutation.mutate(text);
  };

  return (
    <div className="flex flex-col h-[600px] w-full bg-background border rounded-2xl overflow-hidden shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-surface border-b">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border-2 border-primary/10">
            <AvatarImage src={avatarUrl} />
            <AvatarFallback className="bg-primary/5 text-primary font-bold">
              {title.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <h3 className="text-[15px] font-bold tracking-tight">{title}</h3>
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">
              {subtitle || "Operacional"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onCallClick} className="rounded-full hover:bg-emerald-500/10 hover:text-emerald-600">
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
              <DropdownMenuItem className="gap-2 text-red-600">
                <Trash2 className="h-4 w-4" /> Limpar conversa
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-6 bg-surface-2/50" viewportRef={scrollRef}>
        <div className="flex flex-col gap-4">
          {messages.map((msg, i) => {
            const isMe = msg.sender_id === (supabase.auth.getUser() as any).data?.user?.id; // Mock simple check for now
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
                      : 'bg-white border rounded-tl-none'
                  }`}
                >
                  {msg.kind === 'text' && <span>{msg.content}</span>}
                  {msg.kind === 'location' && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" /> Localização enviada
                    </div>
                  )}
                  {msg.kind === 'system' && (
                    <div className="italic text-xs opacity-80">{msg.content}</div>
                  )}
                  
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
      <div className="p-4 bg-surface border-t">
        <div className="flex items-center gap-2">
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
                <ImageIcon className="h-4 w-4 text-blue-500" /> Galeria / Fotos
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2">
                <FileText className="h-4 w-4 text-purple-500" /> Documentos / NF
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2">
                <MapPin className="h-4 w-4 text-emerald-500" /> Localização
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <div className="flex-1 relative">
            <Input 
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Digite uma mensagem..."
              className="rounded-full pr-12 h-11 border-border/60 bg-surface-2"
            />
            {text.trim() === "" ? (
              <Button 
                variant="ghost" 
                size="icon" 
                className={`absolute right-1 top-1 rounded-full transition-colors ${isRecording ? 'text-red-500' : ''}`}
                onClick={() => setIsRecording(!isRecording)}
              >
                <Mic className="h-5 w-5" />
              </Button>
            ) : (
              <Button 
                variant="primary" 
                size="icon" 
                className="absolute right-1 top-1 rounded-full bg-primary hover:opacity-90 h-9 w-9"
                onClick={handleSend}
              >
                <Send className="h-4 w-4 text-primary-foreground" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
