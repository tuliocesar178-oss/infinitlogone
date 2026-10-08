import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Send, MapPin, Package, User, XCircle } from "lucide-react";
import { toast } from "sonner";
import { STATUS_LABEL } from "@/lib/order-status";
import { ShareTracking } from "@/components/share-tracking";
import { FreightProgramPanel } from "@/components/freight-program-panel";
import { DispatchPanel } from "@/components/orders/dispatch-panel";
import { NegotiationPanel } from "@/components/orders/negotiation-panel";
import { OrderChat } from "@/components/orders/order-chat";
import { workAddress, workStatusLabel, type Work } from "@/lib/work";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/ops/pedidos/$id")({
  validateSearch: (search: Record<string, unknown>) => z.object({
    tab: z.enum(["op", "pf"]).optional()
  }).parse(search),
  head: () => ({ meta: [{ title: "Pedido — InfinitLog" }, { name: "robots", content: "noindex" }] }),
  component: OrderDetail,
});

const CANCELLABLE_STATUSES = new Set([
  "created",
  "preparing",
  "awaiting_driver",
  "driver_assigned",
  "en_route_pickup",
  "in_transit_to_pickup",
  "at_pickup",
]);

function OrderDetail() {
  const { id } = Route.useParams();
  const search = Route.useSearch() as any;
  const navigate = Route.useNavigate();
  const tab = search.tab || "op";
  const [cancelling, setCancelling] = useState(false);

  const orderQ = useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, chat_rooms!chat_rooms_order_id_fkey(id)")
        .eq("id", id)
        .single();
      if (error) throw error;

      if (!data.work_id) return { ...data, work: null as Work | null };

      const { data: work } = await supabase
        .from("works")
        .select("*")
        .eq("id", data.work_id)
        .maybeSingle();

      return { ...data, work: (work ?? null) as Work | null };
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
  const canCancel = order && CANCELLABLE_STATUSES.has(order.status);

  async function cancelOrder() {
    if (!order) return;
    const reason = window.prompt(
      `Cancelar o pedido ${order.code}?\n\nInforme o motivo do cancelamento (será registrado no histórico):`,
    );
    if (reason === null) return;
    const trimmed = reason.trim();
    if (!trimmed) {
      toast.error("Informe um motivo para cancelar o frete.");
      return;
    }
    setCancelling(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { error: uErr } = await supabase
        .from("orders")
        .update({ status: "cancelled" })
        .eq("id", order.id);
      if (uErr) throw uErr;
      await supabase
        .from("freight_offers")
        .update({ status: "cancelled" })
        .eq("order_id", order.id)
        .in("status", ["pending", "negotiating"]);
      await supabase.from("order_events").insert({
        order_id: order.id,
        event_type: "cancelled",
        from_status: order.status,
        to_status: "cancelled",
        actor_id: u.user?.id ?? null,
        payload: { reason: trimmed },
      });
      toast.success("Frete cancelado.");
      orderQ.refetch();
      eventsQ.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao cancelar frete");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <AppShell
      title={order ? order.code : "Pedido"}
      subtitle={order ? STATUS_LABEL[order.status] ?? order.status : ""}
      actions={
        <div className="flex items-center gap-2">
          {order?.chat_rooms?.id && (
            <Link
              to={"/ops/chat" as any}
              search={{ orderId: order.id } as any}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-600 hover:bg-emerald-500/20"
            >
              <Send className="h-4 w-4" /> Chat da Operação
            </Link>
          )}
          {canCancel && (
            <button
              onClick={cancelOrder}
              disabled={cancelling}
              className="inline-flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-500/20 disabled:opacity-60"
            >
              <XCircle className="h-4 w-4" /> {cancelling ? "Cancelando…" : "Cancelar frete"}
            </button>
          )}
          <Link
            to="/ops"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
        </div>
      }
    >
      {orderQ.isLoading && <div className="card-soft h-64 animate-pulse bg-surface-2" />}
      {order && (
        <>
          <div className="mb-6 inline-flex rounded-2xl bg-surface-2 p-1">
            {[
              { k: "op", l: "Operação" },
              { k: "pf", l: "Programação de Frete" },
            ].map((t) => (
              <button
                key={t.k}
                onClick={() => navigate({ search: { tab: t.k as any } })}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                  tab === t.k
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.l}
              </button>
            ))}
          </div>

          {tab === "op" && (
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                <Panel title="Cliente" icon={<User className="h-4 w-4" />}>
                  <Info k="Cliente" v={order.client_name} />
                  <Info k="Obra" v={order.work?.name} />
                  <Info k="Status da obra" v={workStatusLabel(order.work?.status)} />
                  <Info k="Endereço da obra" v={order.work ? workAddress(order.work) : null} />
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

                <Attachments orderId={id} currentStatus={order.status} />

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
                <DispatchPanel order={order} onSent={() => { orderQ.refetch(); eventsQ.refetch(); }} />
                <NegotiationPanel orderId={id} onChanged={() => { orderQ.refetch(); eventsQ.refetch(); }} />
                {order.chat_rooms?.id && (
                  <OrderChat 
                    roomId={order.chat_rooms.id} 
                    orderId={id} 
                    title={order.code}
                    subtitle={order.client_name || "Operacional"}
                    readOnly
                  />
                )}
                {order.driver_id && <Button asChild variant="outline"><Link to="/ops/chat" search={{ driverId: order.driver_id, orderId: id }}>Conversar com motorista</Link></Button>}
                <OfferPanel order={order} onChanged={() => { orderQ.refetch(); eventsQ.refetch(); }} />

              </div>
            </div>
          )}

          {tab === "pf" && <FreightProgramPanel order={order} />}
        </>
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
        .in("availability", ["disponivel", "em_frete"] as any);
      if (dErr) throw dErr;
      if (!drivers?.length) {
        toast.warning("Nenhum motorista disponível no momento.");
        return;
      }
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      const rows = drivers.map((d) => ({
        order_id: order.id,
        driver_id: d.user_id,
        // Valor ofertado ao motorista (nunca o valor negociado com o cliente)
        offered_price: order.driver_amount ?? order.price ?? 0,
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

function Attachments({ orderId, currentStatus }: { orderId: string; currentStatus: string }) {
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
        event_status: currentStatus,
        metadata: { source: "operations_order_detail" },
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
