import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, Send, X, Zap } from "lucide-react";
import { toast } from "sonner";

const TEMPLATES = [
  "Estou a caminho da coleta 🚚",
  "Cheguei no local ✅",
  "Trânsito intenso, pequeno atraso ⏱️",
  "Aguardando liberação / documentos",
  "Carga conferida e carregada",
  "Saindo para entrega",
  "Chegando ao destino em breve",
  "Entrega concluída 📦",
  "Preciso de suporte ⚠️",
];

type Msg = {
  id: string;
  sender_id: string;
  content: string | null;
  created_at: string;
};

export function DriverQuickChat({
  orderId,
  orderCode,
  open,
  onClose,
}: {
  orderId: string;
  orderCode?: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const [userId, setUserId] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) setUserId(data.user.id);
    })();
  }, []);

  const q = useQuery({
    enabled: open && !!orderId,
    queryKey: ["driver-quick-chat", orderId],
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("id, sender_id, content, created_at")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true })
        .limit(200);
      return (data ?? []) as Msg[];
    },
  });

  useEffect(() => {
    if (!open || !orderId) return;
    const ch = supabase
      .channel(`driver-quick-chat-${orderId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `order_id=eq.${orderId}` },
        () => q.refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [open, orderId, q]);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    });
  }, [q.data, open]);

  async function send(content: string) {
    const body = content.trim();
    if (!body || !userId) return;
    setSending(true);
    try {
      const { error } = await supabase.from("messages").insert({
        order_id: orderId,
        sender_id: userId,
        kind: "text",
        content: body,
      });
      if (error) throw error;
      setText("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar");
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  const msgs = q.data ?? [];

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={onClose}>
      <div
        className="flex h-[85vh] w-full flex-col rounded-t-3xl bg-background shadow-2xl sm:mx-auto sm:h-[80vh] sm:max-w-lg sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-brand/10 text-brand">
              <MessageCircle className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">Chat da logística</div>
              {orderCode && (
                <div className="font-mono text-[11px] text-muted-foreground">{orderCode}</div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full border border-border hover:bg-accent"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
          {msgs.length === 0 ? (
            <div className="grid h-full place-items-center text-center text-xs text-muted-foreground">
              Nenhuma mensagem ainda.
              <br />
              Envie uma resposta rápida abaixo.
            </div>
          ) : (
            msgs.map((m) => {
              const mine = m.sender_id === userId;
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                      mine
                        ? "rounded-br-md bg-brand text-brand-foreground"
                        : "rounded-bl-md bg-surface-2 text-foreground"
                    }`}
                  >
                    <div className="whitespace-pre-wrap break-words">{m.content}</div>
                    <div
                      className={`mt-0.5 text-[10px] ${
                        mine ? "text-brand-foreground/70" : "text-muted-foreground"
                      }`}
                    >
                      {new Date(m.created_at).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-border bg-surface/60 px-3 py-2">
          <div className="mb-2 flex items-center gap-1 px-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            <Zap className="h-3 w-3" /> Respostas rápidas
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {TEMPLATES.map((t) => (
              <button
                key={t}
                onClick={() => send(t)}
                disabled={sending}
                className="shrink-0 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium transition hover:border-brand/40 hover:bg-brand/5 disabled:opacity-60"
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-end gap-2 border-t border-border px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(text);
              }
            }}
            rows={1}
            placeholder="Escreva uma mensagem…"
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand"
          />
          <button
            onClick={() => send(text)}
            disabled={sending || !text.trim()}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand text-brand-foreground shadow-sm transition hover:opacity-95 disabled:opacity-50"
            aria-label="Enviar"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
