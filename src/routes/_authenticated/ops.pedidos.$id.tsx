import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Send, MapPin, Package, User } from "lucide-react";
import { toast } from "sonner";
import { STATUS_LABEL } from "@/lib/order-status";
import { ShareTracking } from "@/components/share-tracking";
import { FreightProgramPanel } from "@/components/freight-program-panel";

export const Route = createFileRoute("/_authenticated/ops/pedidos/$id")({
  head: () => ({ meta: [{ title: "Pedido — InfinitLog" }, { name: "robots", content: "noindex" }] }),
  component: OrderDetail,
});

function OrderDetail() {
  const { id } = Route.useParams();
  const [tab, setTab] = useState<"op" | "pf">("op");

  const orderQ = useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const eventsQ = useQuery({
    queryKey: ["order-events", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_events")
        .select("*")
        .eq("order_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const order = orderQ.data;

  return (
    <AppShell
      title={order ? order.code : "Pedido"}
      subtitle={order ? STATUS_LABEL[order.status] ?? order.status : ""}
      actions={
        <Link
          to="/ops"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
      }
    >
      {orderQ.isLoading && <div className="card-soft h-64 animate-pulse bg-surface-2" />}
      {order && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Panel title="Cliente" icon={<User className="h-4 w-4" />}>
              <Info k="Cliente" v={order.client_name} />
              <Info k="Contato" v={order.contact_name} />
              <Info k="Telefone" v={order.contact_phone} />
            </Panel>

            <Panel title="Rota" icon={<MapPin className="h-4 w-4" />}>
              <Info k="Origem" v={`${order.origin_address}${order.origin_city ? ` · ${order.origin_city}` : ""}`} />
              <Info k="Destino" v={`${order.destination_address}${order.destination_city ? ` · ${order.destination_city}` : ""}`} />
              <Info
                k="Janela de coleta"
                v={fmtWindow(order.pickup_window_start, order.pickup_window_end)}
              />
              <Info
                k="Janela de entrega"
                v={fmtWindow(order.delivery_window_start, order.delivery_window_end)}
              />
            </Panel>

            <Panel title="Carga" icon={<Package className="h-4 w-4" />}>
              <Info k="Tipo" v={order.cargo_type} />
              <Info k="Peso" v={order.cargo_weight_kg ? `${order.cargo_weight_kg} kg` : null} />
              <Info k="Volumes" v={order.volumes} />
              <Info k="Valor da carga" v={order.cargo_value ? brl(order.cargo_value) : null} />
              <Info k="Valor negociado" v={order.price ? brl(order.price) : null} />
              <Info k="Descrição" v={order.cargo_description} />
              <Info k="Observações" v={order.notes} />
            </Panel>

            <Attachments orderId={id} />

            <Panel title="Linha do tempo">
              <ul className="space-y-3 text-sm">
                {(eventsQ.data ?? []).map((e) => (
                  <li key={e.id} className="flex items-start justify-between gap-3">
                    <span>{STATUS_LABEL[e.to_status ?? ""] ?? e.event_type}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(e.created_at).toLocaleString("pt-BR")}
                    </span>
                  </li>
                ))}
                {(eventsQ.data ?? []).length === 0 && (
                  <li className="text-sm text-muted-foreground">Nenhum evento ainda.</li>
                )}
              </ul>
            </Panel>
          </div>

          <div className="space-y-6">
            <section className="card-soft p-6">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                Compartilhar rastreio
              </h2>
              <div className="mt-3 rounded-xl bg-surface-2 p-3 text-center font-mono text-sm">
                {order.tracking_code}
              </div>
              <div className="mt-4">
                <ShareTracking code={order.tracking_code} phone={order.contact_phone} />
              </div>
              <Link
                to="/rastreio/$code"
                params={{ code: order.tracking_code }}
                target="_blank"
                className="mt-4 block text-center text-xs text-muted-foreground hover:text-foreground"
              >
                Abrir portal público →
              </Link>
            </section>
            <OfferPanel order={order} onChanged={() => { orderQ.refetch(); eventsQ.refetch(); }} />
          </div>
        </div>
      )}
    </AppShell>
  );
}


function OfferPanel({ order, onChanged }: { order: any; onChanged: () => void }) {
  const [sending, setSending] = useState(false);

  async function sendOffers() {
    setSending(true);
    try {
      const { data: drivers, error: dErr } = await supabase
        .from("drivers")
        .select("user_id")
        .eq("status", "available");
      if (dErr) throw dErr;
      if (!drivers?.length) {
        toast.warning("Nenhum motorista disponível no momento.");
        return;
      }
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      const rows = drivers.map((d) => ({
        order_id: order.id,
        driver_id: d.user_id,
        offered_price: order.price ?? 0,
        expires_at: expiresAt,
      }));
      const { error: oErr } = await supabase.from("freight_offers").insert(rows);
      if (oErr) throw oErr;
      const { data: u } = await supabase.auth.getUser();
      await supabase.from("orders").update({ status: "awaiting_driver" }).eq("id", order.id);
      await supabase.from("order_events").insert({
        order_id: order.id,
        event_type: "offers_sent",
        from_status: order.status,
        to_status: "awaiting_driver",
        actor_id: u.user?.id ?? null,
        payload: { drivers: drivers.length },
      });
      toast.success(`Oferta enviada para ${drivers.length} motorista(s).`);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar oferta");
    } finally {
      setSending(false);
    }
  }

  if (order.status !== "preparing" && order.status !== "created") {
    return (
      <section className="card-soft p-6">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Ofertas
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Status atual: <span className="font-medium text-foreground">{STATUS_LABEL[order.status]}</span>
        </p>
      </section>
    );
  }

  return (
    <section className="card-soft p-6">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        Pronto para ofertar?
      </h2>
      <p className="mt-3 text-sm text-muted-foreground">
        Revise os dados. Ao enviar, todos os motoristas disponíveis receberão a oferta simultaneamente.
      </p>
      <button
        onClick={sendOffers}
        disabled={sending}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
      >
        <Send className="h-4 w-4" /> {sending ? "Enviando…" : "Enviar oferta aos motoristas"}
      </button>
    </section>
  );
}

function Attachments({ orderId }: { orderId: string }) {
  const [uploading, setUploading] = useState(false);
  const [kind, setKind] = useState("nota_fiscal");
  const q = useQuery({
    queryKey: ["attachments", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_attachments")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const path = `${orderId}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("order-files").upload(path, file, {
        upsert: false,
        contentType: file.type,
      });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("order_attachments").insert({
        order_id: orderId,
        kind,
        label: file.name,
        file_path: path,
        mime_type: file.type,
        size_bytes: file.size,
        uploaded_by: u.user?.id ?? null,
      });
      if (insErr) throw insErr;
      toast.success("Arquivo enviado");
      q.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar arquivo");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function open(path: string) {
    const { data, error } = await supabase.storage.from("order-files").createSignedUrl(path, 60);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  }

  return (
    <Panel title="Anexos">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="h-10 rounded-xl border border-border bg-surface px-3 text-sm outline-none"
        >
          <option value="nota_fiscal">Nota Fiscal</option>
          <option value="cte">CT-e</option>
          <option value="mdfe">MDF-e</option>
          <option value="foto">Foto</option>
          <option value="pdf">PDF</option>
          <option value="outro">Outro</option>
        </select>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
          <input type="file" hidden onChange={onFile} disabled={uploading} />
          {uploading ? "Enviando…" : "Anexar arquivo"}
        </label>
      </div>
      <ul className="mt-4 divide-y divide-border">
        {(q.data ?? []).map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-3 py-3 text-sm">
            <div className="min-w-0">
              <div className="truncate font-medium">{a.label}</div>
              <div className="text-xs text-muted-foreground">
                {a.kind} · {new Date(a.created_at).toLocaleString("pt-BR")}
              </div>
            </div>
            <button
              onClick={() => open(a.file_path)}
              className="rounded-full border border-border bg-background px-3 py-1.5 text-xs hover:bg-accent"
            >
              Abrir
            </button>
          </li>
        ))}
        {(q.data ?? []).length === 0 && (
          <li className="py-4 text-sm text-muted-foreground">Nenhum anexo ainda.</li>
        )}
      </ul>
    </Panel>
  );
}

function Panel({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card-soft p-6">
      <header className="flex items-center gap-2">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">{title}</h2>
      </header>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Info({ k, v }: { k: string; v: any }) {
  if (v === null || v === undefined || v === "") return null;
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}

function fmtWindow(a: string | null, b: string | null) {
  if (!a && !b) return null;
  const f = (d: string) => new Date(d).toLocaleString("pt-BR");
  if (a && b) return `${f(a)} → ${f(b)}`;
  return f((a ?? b)!);
}

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
