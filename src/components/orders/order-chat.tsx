import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Send } from "lucide-react";
import { toast } from "sonner";

export function OrderChat({ orderId }: { orderId: string }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const msgsQ = useQuery({
    queryKey: ["order-messages", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*,sender:profiles!messages_sender_id_fkey(full_name)")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`msgs-${orderId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `order_id=eq.${orderId}` },
        () => msgsQ.refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [orderId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [msgsQ.data]);

  async function send() {
    if (!text.trim()) return;
    setSending(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { error } = await supabase.from("messages").insert({
        order_id: orderId,
        sender_id: u.user.id,
        kind: "text",
        content: text.trim(),
      });
      if (error) throw error;
      setText("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar");
    } finally {
      setSending(false);
    }
  }

  const msgs = msgsQ.data ?? [];

  return (
    <section className="card-soft flex h-[420px] flex-col p-6">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        Chat do frete
      </h2>
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-auto pr-1">
        {msgs.length === 0 && (
          <div className="text-sm text-muted-foreground">Nenhuma mensagem ainda.</div>
        )}
        {msgs.map((m: any) => (
          <div key={m.id} className="rounded-xl bg-surface-2 p-3 text-sm">
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{m.sender?.full_name ?? "Usuário"}</span>
              <span>{new Date(m.created_at).toLocaleString("pt-BR")}</span>
            </div>
            <div>{m.content}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
          placeholder="Escreva uma mensagem…"
          className="h-11 flex-1 rounded-xl border border-border bg-surface px-3 text-sm outline-none"
        />
        <button
          onClick={send}
          disabled={sending || !text.trim()}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
