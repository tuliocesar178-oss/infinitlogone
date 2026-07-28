import { Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { brl, labelOf, PAYMENT_METHODS, PAYMENT_TERMS } from "@/lib/pf";
import { STATUS_LABEL } from "@/lib/order-status";
import {
  nextDriverAction,
  ACTION_LABEL,
  ACTION_TRANSITIONS,
  type DriverAction,
} from "@/lib/order-flow";
import {
  MapPin, Package, CircleDollarSign, Clock, Check, X, Navigation,
  Camera, MessageCircle, Truck, Upload, PenLine, ChevronRight, ChevronUp
} from "lucide-react";
import { RouteMiniMap } from "./route-mini-map";

export type Order = {
  id: string;
  code: string;
  tracking_code: string;
  status: string;
  origin_address: string;
  origin_city: string | null;
  origin_lat: number | null;
  origin_lng: number | null;
  destination_address: string;
  destination_city: string | null;
  destination_lat: number | null;
  destination_lng: number | null;
  cargo_type: string | null;
  cargo_weight_kg: number | null;
  volumes: number | null;
  price: number | null;
  distance_km?: number | null;
  distance_to_destination_km: number | null;
  eta_minutes: number | null;
  pickup_window_start: string | null;
  delivery_window_end: string | null;
};

export function OfferCard({
  offer,
  order,
  program,
  userId,
  onChanged,
}: {
  offer: any;
  order: any;
  program: any;
  userId: string;
  onChanged?: () => void;
}) {
  const qc = useQueryClient();

  async function respond(action: "accept" | "decline") {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");

      if (action === "accept") {
        // Atualizar apenas a oferta; o gatilho no banco cuida do pedido
        const { error: offerError } = await supabase
          .from("freight_offers")
          .update({
            status: "accepted",
            accepted_at: new Date().toISOString(),
            driver_id: userData.user.id
          })
          .eq("id", offer.id);
        
        if (offerError) throw offerError;

        toast.success("Oferta aceita");
        qc.invalidateQueries({ queryKey: ["driver-offers", userId] });
        qc.invalidateQueries({ queryKey: ["driver-active", userId] });
        qc.invalidateQueries({ queryKey: ["driver-freights", userId] });
      } else {
        const { error } = await supabase
          .from("freight_offers")
          .update({ status: "declined" })
          .eq("id", offer.id);
        if (error) throw error;
        toast.success("Oferta recusada");
        qc.invalidateQueries({ queryKey: ["driver-offers", userId] });
      }
      onChanged?.();
    } catch (e) {
      console.error("Erro no aceite:", e);
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  async function negotiate() {
    const raw = window.prompt(`Proposta atual: ${brl(Number(offer.offered_price))}\n\nInforme sua contraproposta (R$):`);
    if (!raw) return;
    const amount = Number(raw.replace(",", "."));
    if (!amount || amount <= 0) return toast.error("Valor inválido");
    const note = window.prompt("Observação (opcional)") ?? "";
    try {
      await supabase.from("freight_offers").update({ status: "negotiating" as any }).eq("id", offer.id);
      await supabase.from("negotiations").insert({
        offer_id: offer.id, proposed_by: userId, amount, note: note || null, status: "proposed",
      });
      await supabase.from("orders").update({ status: "negotiating" as any }).eq("id", offer.order_id);
      toast.success("Proposta enviada à logística");
      qc.invalidateQueries({ queryKey: ["driver-offers", userId] });
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  return (
    <div className="card-soft overflow-hidden">
      <div className="flex items-center justify-between border-b border-border bg-surface-2 px-6 py-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Nova oferta</div>
          <div className="font-mono text-sm font-semibold">{program?.pf_code ?? order?.code}</div>
        </div>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          Oferta ativa
        </span>
      </div>
      <div className="relative border-b border-border/60">
        <RouteMiniMap
          origin={order?.origin_lat && order?.origin_lng ? [order.origin_lng, order.origin_lat] : null}
          destination={order?.destination_lat && order?.destination_lng ? [order.destination_lng, order.destination_lat] : null}
          className="h-32 w-full rounded-none"
        />
        {order?.distance_km != null && (
          <div className="absolute right-2 top-2 rounded-full bg-background/95 px-3 py-1 text-[11px] font-bold shadow-md backdrop-blur">
            {order.distance_km} km
          </div>
        )}
      </div>

      <div className="grid gap-4 p-6 sm:grid-cols-2">
        <I icon={<MapPin className="h-4 w-4 text-emerald-500" />} k="Origem" v={order?.origin_city ?? order?.origin_address} />
        <I icon={<MapPin className="h-4 w-4 text-red-500" />} k="Destino" v={order?.destination_city ?? order?.destination_address} />
        <I icon={<Package className="h-4 w-4" />} k="Carga" v={order?.cargo_type} />
        <I icon={<Truck className="h-4 w-4" />} k="Peso" v={order?.cargo_weight_kg ? `${order.cargo_weight_kg} kg` : null} />
        <I icon={<Clock className="h-4 w-4 text-emerald-600" />} k="Coleta prevista" v={order?.pickup_window_start ? new Date(order.pickup_window_start).toLocaleString("pt-BR") : null} />
        <I icon={<Clock className="h-4 w-4 text-red-600" />} k="Entrega prevista" v={order?.delivery_window_end ? new Date(order.delivery_window_end).toLocaleString("pt-BR") : null} />
        <I k="Forma pgto" v={labelOf(PAYMENT_METHODS, program?.payment_method)} />
        <I k="Prazo" v={labelOf(PAYMENT_TERMS, program?.payment_term)} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border bg-surface-2 px-6 py-4">
        <div className="flex items-center gap-2">
          <CircleDollarSign className="h-5 w-5 text-brand" />
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Valor</div>
            <div className="text-2xl font-bold">{brl(Number(offer.offered_price))}</div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 p-4">
        <button onClick={() => respond("decline")}
          className="flex items-center justify-center gap-1 rounded-xl border border-border bg-background px-3 py-3 text-sm font-semibold hover:bg-accent">
          <X className="h-4 w-4" /> Recusar
        </button>
        <button onClick={negotiate}
          className="flex items-center justify-center gap-1 rounded-xl border border-brand bg-background px-3 py-3 text-sm font-semibold text-brand hover:bg-brand/5">
          <MessageCircle className="h-4 w-4" /> Negociar
        </button>
        <button onClick={() => respond("accept")}
          className="flex items-center justify-center gap-1 rounded-xl bg-brand px-3 py-3 text-sm font-bold text-brand-foreground hover:opacity-90">
          <Check className="h-4 w-4" /> Aceitar
        </button>
      </div>
    </div>
  );
}

export function ActiveOrderPanel({
  order,
  userId,
  onChanged,
}: {
  order: Order;
  userId: string;
  onChanged: () => void;
}) {
  const [step, setStep] = useState<"idle" | "pickup" | "delivery">("idle");
  const [driverPos, setDriverPos] = useState<[number, number] | null>(null);
  const nextAction = useMemo(() => nextDriverAction(order.status as never), [order.status]);

  useEffect(() => {
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setDriverPos([pos.coords.longitude, pos.coords.latitude]),
      (err) => console.error("Geo error:", err),
      { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  async function runAction(action: DriverAction) {
    try {
      const to = ACTION_TRANSITIONS[action].to;
      const from = order.status;
      const updatePayload: any = { 
        status: to as any, 
        updated_at: new Date().toISOString() 
      };
      
      if (action === "start_pickup" || action === "start_delivery") {
        updatePayload.started_trip_at = new Date().toISOString();
      }

      console.log("Updating order:", order.id, updatePayload);
      const { error: updateError } = await supabase.from("orders").update(updatePayload).eq("id", order.id);
      
      if (updateError) {
        console.error("Update error details:", updateError);
        throw new Error(`Erro ao atualizar pedido: ${updateError.message}`);
      }
      
      let lat: number | null = null, lng: number | null = null;
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) => 
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 3000, enableHighAccuracy: true })
        );
        lat = pos.coords.latitude; lng = pos.coords.longitude;
      } catch (geoErr) {
        console.warn("Geo localization failed, continuing without coordinates:", geoErr);
      }
      
      const { error: eventError } = await supabase.from("order_events").insert({
        order_id: order.id, 
        event_type: `driver_${action}`,
        from_status: from as any, 
        to_status: to as any, 
        actor_id: userId,
        payload: { lat, lng },
      });
      
      if (eventError) {
        console.warn("Event insertion failed but order was updated:", eventError);
      }
      
      toast.success(ACTION_LABEL[action]);
      onChanged();
    } catch (e) {
      console.error("Action error:", e);
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  function openSmartNav() {
    // Determina o destino baseado no status atual
    const isHeadingToPickup = ["driver_assigned", "en_route_pickup", "in_transit_to_pickup", "at_pickup"].includes(order.status);
    
    const lat = isHeadingToPickup ? order.origin_lat : order.destination_lat;
    const lng = isHeadingToPickup ? order.origin_lng : order.destination_lng;
    const addr = isHeadingToPickup ? order.origin_address : order.destination_address;

    if (!lat && !lng && !addr) {
      toast.error("Destino não configurado no pedido");
      return;
    }

    const dest = (lat && lng) ? `${lat},${lng}` : encodeURIComponent(addr || "");
    const url = `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
    window.open(url, "_blank");
  }

  return (
    <div className="card-soft overflow-hidden">
      <div className="h-64 w-full">
        <RouteMiniMap
          origin={order.origin_lat && order.origin_lng ? [order.origin_lng, order.origin_lat] : null}
          destination={order.destination_lat && order.destination_lng ? [order.destination_lng, order.destination_lat] : null}
          driver={driverPos}
          className="h-full w-full rounded-none"
        />
      </div>

      <div className="border-b border-border bg-brand p-6 text-brand-foreground">
        <div className="text-[10px] font-semibold uppercase tracking-widest opacity-80">Frete em andamento</div>
        <div className="mt-1 font-mono text-lg font-bold">{order.code}</div>
        <div className="mt-1 text-sm opacity-90">{STATUS_LABEL[order.status] ?? order.status}</div>
      </div>

      <div className="grid gap-4 p-6 sm:grid-cols-2">
        <I icon={<MapPin className="h-4 w-4" />} k="Origem" v={order.origin_city ?? order.origin_address} />
        <I icon={<MapPin className="h-4 w-4" />} k="Destino" v={order.destination_city ?? order.destination_address} />
        <I k="Distância restante" v={order.distance_to_destination_km ? `${order.distance_to_destination_km.toFixed(1)} km` : null} />
        <I k="ETA" v={order.eta_minutes ? `${order.eta_minutes} min` : null} />
      </div>

      {step === "pickup" && (
        <PickupEvidenceForm orderId={order.id} userId={userId} onDone={() => { setStep("idle"); runAction("loaded"); }} onCancel={() => setStep("idle")} />
      )}
      {step === "delivery" && (
        <DeliveryEvidenceForm orderId={order.id} userId={userId} onDone={() => { setStep("idle"); runAction("delivered"); }} onCancel={() => setStep("idle")} />
      )}

      {step === "idle" && nextAction && (
        <div className="space-y-3 border-t border-border p-6">
          {(nextAction === "start_pickup" || nextAction === "arrived_pickup") && (
            <ActionBtn 
              onClick={openSmartNav} 
              icon={<Navigation className="h-6 w-6" />} 
              label="INICIAR NAVEGAÇÃO" 
              className="py-6 text-lg ring-4 ring-brand/20 shadow-xl"
            />
          )}

          {nextAction === "start_pickup" && (
            <ActionBtn onClick={() => runAction("start_pickup")} icon={<Navigation className="h-5 w-5" />} label="INICIAR DESLOCAMENTO" tone="ghost" />
          )}
          {nextAction === "arrived_pickup" && (
            <ActionBtn onClick={() => runAction("arrived_pickup")} icon={<Check className="h-5 w-5" />} label="CHEGUEI NA COLETA" tone="ghost" />
          )}
          {nextAction === "loaded" && (
            <ActionBtn onClick={() => setStep("pickup")} icon={<Camera className="h-5 w-5" />} label="ENVIAR FOTO DA CARGA" />
          )}
          {nextAction === "start_delivery" && (
            <>
              <ActionBtn 
                onClick={openSmartNav} 
                icon={<Navigation className="h-6 w-6" />} 
                label="INICIAR NAVEGAÇÃO" 
                className="py-6 text-lg ring-4 ring-brand/20 shadow-xl"
              />
              <ActionBtn onClick={() => runAction("start_delivery")} icon={<Truck className="h-5 w-5" />} label="INICIAR ENTREGA" tone="ghost" />
            </>
          )}
          {nextAction === "delivered" && (
            <ActionBtn onClick={() => setStep("delivery")} icon={<PenLine className="h-5 w-5" />} label="ENVIAR COMPROVANTES" />
          )}
        </div>
      )}

      {!nextAction && step === "idle" && (
        <div className="border-t border-border p-6 text-center">
          <Link to="/driver/fretes" className="text-sm text-brand hover:underline">
            Ver histórico de fretes →
          </Link>
        </div>
      )}
    </div>
  );
}

function ActionBtn({ 
  onClick, icon, label, tone = "primary", className = "" 
}: { onClick: () => void; icon: React.ReactNode; label: string; tone?: "primary" | "ghost"; className?: string }) {
  return (
    <button onClick={onClick}
      className={`flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-sm font-bold uppercase tracking-widest transition-all active:scale-[0.98] ${
        tone === "primary" ? "bg-brand text-brand-foreground hover:opacity-90 shadow-lg shadow-brand/20" : "border border-border bg-background hover:bg-accent"
      } ${className}`}>
      {icon} {label}
    </button>
  );
}

function PickupEvidenceForm({ orderId, userId, onDone, onCancel }: { orderId: string; userId: string; onDone: () => void; onCancel: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [volumes, setVolumes] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (files.length === 0) return toast.error("Envie ao menos uma foto da carga");
    if (!invoiceFile) return toast.error("Envie a foto da nota fiscal");
    setSaving(true);
    try {
      const uploads: { path: string; kind: string; name: string; type: string; size: number }[] = [];
      for (const f of files) {
        const path = `${orderId}/pickup-cargo-${Date.now()}-${f.name.replace(/[^\w.\-]/g, "_")}`;
        const up = await supabase.storage.from("order-files").upload(path, f, { contentType: f.type });
        if (up.error) throw up.error;
        uploads.push({ path, kind: "foto_carga", name: f.name, type: f.type, size: f.size });
      }
      const invPath = `${orderId}/pickup-nf-${Date.now()}-${invoiceFile.name.replace(/[^\w.\-]/g, "_")}`;
      const up = await supabase.storage.from("order-files").upload(invPath, invoiceFile, { contentType: invoiceFile.type });
      if (up.error) throw up.error;
      uploads.push({ path: invPath, kind: "foto_nf", name: invoiceFile.name, type: invoiceFile.type, size: invoiceFile.size });

      const rows = uploads.map((u) => ({
        order_id: orderId, kind: u.kind, label: u.name, file_path: u.path,
        mime_type: u.type, size_bytes: u.size, uploaded_by: userId,
      }));
      await supabase.from("order_attachments").insert(rows as never);
      const firstCargo = uploads.find((u) => u.kind === "foto_carga");
      await supabase.from("deliveries").upsert({
        order_id: orderId, pickup_photo_url: firstCargo?.path ?? null,
      } as never, { onConflict: "order_id" });
      if (volumes || notes) {
        await supabase.from("orders").update({
          volumes: volumes ? Number(volumes) : null,
          notes: notes || null,
        }).eq("id", orderId);
      }
      toast.success("Evidências de coleta enviadas");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro no upload");
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-4 border-t border-border p-6">
      <h3 className="text-sm font-semibold">Evidências da coleta</h3>
      <FileInput label="Fotos da carga (múltiplas)" multiple onChange={(fs) => setFiles(fs)} count={files.length} />
      <FileInput label="Foto da nota fiscal" onChange={(fs) => setInvoiceFile(fs[0] ?? null)} count={invoiceFile ? 1 : 0} />
      <input value={volumes} onChange={(e) => setVolumes(e.target.value)} type="number"
        placeholder="Quantidade de volumes conferida"
        className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm" />
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
        placeholder="Observações (opcional)"
        className="w-full rounded-xl border border-border bg-surface p-3 text-sm" rows={3} />
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 rounded-xl border border-border bg-background py-3 text-sm hover:bg-accent">Cancelar</button>
        <button onClick={submit} disabled={saving}
          className="flex-1 rounded-xl bg-brand py-3 text-sm font-semibold text-brand-foreground hover:opacity-90 disabled:opacity-60">
          {saving ? "Enviando…" : "Confirmar coleta"}
        </button>
      </div>
    </div>
  );
}

function DeliveryEvidenceForm({ orderId, userId, onDone, onCancel }: { orderId: string; userId: string; onDone: () => void; onCancel: () => void }) {
  const [signedInvoice, setSignedInvoice] = useState<File | null>(null);
  const [deliveryPhotos, setDeliveryPhotos] = useState<File[]>([]);
  const [receiverName, setReceiverName] = useState("");
  const [receiverDoc, setReceiverDoc] = useState("");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canvasRef = (node: HTMLCanvasElement | null) => {
    if (!node) return;
    const ctx = node.getContext("2d");
    if (!ctx) return;
    let drawing = false;
    const draw = (e: PointerEvent) => {
      if (!drawing) return;
      const rect = node.getBoundingClientRect();
      ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
      ctx.stroke();
    };
    node.onpointerdown = (e) => { drawing = true; ctx.beginPath(); ctx.moveTo(e.offsetX, e.offsetY); ctx.lineWidth = 2; ctx.strokeStyle = "#0f172a"; };
    node.onpointermove = draw;
    node.onpointerup = () => { drawing = false; setSignatureData(node.toDataURL("image/png")); };
    node.onpointerleave = () => { drawing = false; };
  };

  async function submit() {
    if (!receiverName.trim()) return toast.error("Informe o nome do recebedor");
    if (!signedInvoice && deliveryPhotos.length === 0) return toast.error("Envie fotos ou canhoto assinado");
    setSaving(true);
    try {
      const uploads: { path: string; kind: string; name: string; type: string; size: number }[] = [];
      if (signedInvoice) {
        const p = `${orderId}/delivery-nf-${Date.now()}-${signedInvoice.name.replace(/[^\w.\-]/g, "_")}`;
        const up = await supabase.storage.from("order-files").upload(p, signedInvoice, { contentType: signedInvoice.type });
        if (up.error) throw up.error;
        uploads.push({ path: p, kind: "canhoto", name: signedInvoice.name, type: signedInvoice.type, size: signedInvoice.size });
      }
      for (const f of deliveryPhotos) {
        const p = `${orderId}/delivery-photo-${Date.now()}-${f.name.replace(/[^\w.\-]/g, "_")}`;
        const up = await supabase.storage.from("order-files").upload(p, f, { contentType: f.type });
        if (up.error) throw up.error;
        uploads.push({ path: p, kind: "foto_entrega", name: f.name, type: f.type, size: f.size });
      }
      let signaturePath: string | null = null;
      if (signatureData) {
        const blob = await (await fetch(signatureData)).blob();
        const p = `${orderId}/signature-${Date.now()}.png`;
        const up = await supabase.storage.from("order-files").upload(p, blob, { contentType: "image/png" });
        if (!up.error) {
          signaturePath = p;
          uploads.push({ path: p, kind: "assinatura", name: "signature.png", type: "image/png", size: blob.size });
        }
      }
      if (uploads.length) {
        await supabase.from("order_attachments").insert(uploads.map((u) => ({
          order_id: orderId, kind: u.kind, label: u.name, file_path: u.path,
          mime_type: u.type, size_bytes: u.size, uploaded_by: userId,
        })) as never);
      }
      await supabase.from("deliveries").upsert({
        order_id: orderId,
        receiver_name: receiverName,
        receiver_document: receiverDoc || null,
        delivered_at: new Date().toISOString(),
        signature_url: signaturePath,
        delivery_photo_url: uploads.find((u) => u.kind === "foto_entrega")?.path ?? null,
        invoice_url: uploads.find((u) => u.kind === "canhoto")?.path ?? null,
      } as never, { onConflict: "order_id" });
      toast.success("Comprovantes enviados");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-4 border-t border-border p-6">
      <h3 className="text-sm font-semibold">Comprovantes de entrega</h3>
      <FileInput label="Canhoto / NF assinada" onChange={(fs) => setSignedInvoice(fs[0] ?? null)} count={signedInvoice ? 1 : 0} />
      <FileInput label="Fotos da entrega" multiple onChange={(fs) => setDeliveryPhotos(fs)} count={deliveryPhotos.length} />
      <input value={receiverName} onChange={(e) => setReceiverName(e.target.value)}
        placeholder="Nome do recebedor" className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm" />
      <input value={receiverDoc} onChange={(e) => setReceiverDoc(e.target.value)}
        placeholder="Documento do recebedor" className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm" />
      <div>
        <div className="mb-1.5 text-xs font-medium uppercase tracking-widest text-muted-foreground">Assinatura</div>
        <canvas ref={canvasRef} width={480} height={160} className="w-full rounded-xl border border-border bg-white touch-none" />
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 rounded-xl border border-border bg-background py-3 text-sm hover:bg-accent">Cancelar</button>
        <button onClick={submit} disabled={saving}
          className="flex-1 rounded-xl bg-brand py-3 text-sm font-semibold text-brand-foreground hover:opacity-90 disabled:opacity-60">
          {saving ? "Enviando…" : "Confirmar entrega"}
        </button>
      </div>
    </div>
  );
}

function FileInput({ label, onChange, multiple, count }: { label: string; onChange: (fs: File[]) => void; multiple?: boolean; count: number }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-surface-2 px-4 py-3 hover:bg-accent">
      <Upload className="h-4 w-4 text-brand" />
      <div className="flex-1">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{count > 0 ? `${count} arquivo(s) selecionado(s)` : "Clique para escolher"}</div>
      </div>
      <input type="file" hidden accept="image/*,application/pdf" capture="environment" multiple={multiple}
        onChange={(e) => onChange(Array.from(e.target.files ?? []))} />
    </label>
  );
}

function I({ k, v, icon }: { k: string; v: unknown; icon?: React.ReactNode }) {
  if (v === null || v === undefined || v === "" || v === "—") return null;
  return (
    <div className="flex items-start gap-3">
      {icon && <div className="mt-0.5 shrink-0 text-muted-foreground">{icon}</div>}
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {k}
        </div>
        <div className="mt-0.5 truncate text-sm font-semibold">{String(v)}</div>
      </div>
    </div>
  );
}
