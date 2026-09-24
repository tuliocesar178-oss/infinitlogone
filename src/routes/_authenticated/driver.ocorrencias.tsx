import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Paperclip, Plus, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/driver/ocorrencias")({
  head: () => ({ meta: [{ title: "Ocorrências — Motorista" }, { name: "robots", content: "noindex" }] }),
  component: DriverIncidents,
});

const TYPES = [
  { value: "traffic", label: "Trânsito intenso" },
  { value: "breakdown", label: "Pane / avaria do veículo" },
  { value: "accident", label: "Acidente" },
  { value: "cargo_issue", label: "Problema com a carga" },
  { value: "pickup_delay", label: "Atraso na coleta" },
  { value: "delivery_refused", label: "Entrega recusada" },
  { value: "route_blocked", label: "Rota bloqueada" },
  { value: "other", label: "Outro" },
];

const SEVERITY = [
  { value: "low", label: "Baixa", cls: "bg-emerald-100 text-emerald-800" },
  { value: "medium", label: "Média", cls: "bg-amber-100 text-amber-800" },
  { value: "high", label: "Alta", cls: "bg-red-100 text-red-700" },
];

function DriverIncidents() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState("");
  const [open, setOpen] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [type, setType] = useState("traffic");
  const [severity, setSeverity] = useState("medium");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) setUserId(data.user.id);
    })();
  }, []);

  const orders = useQuery({
    enabled: !!userId,
    queryKey: ["driver-active-orders", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, code, origin_city, destination_city, status")
        .eq("driver_id", userId)
        .not("status", "in", "(delivered,cancelled)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const list = useQuery({
    enabled: !!userId,
    queryKey: ["driver-incidents", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("incidents")
        .select("*")
        .eq("reported_by", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (!data?.length) return [];
      const ids = Array.from(new Set(data.map((i) => i.order_id)));
      const { data: os } = await supabase.from("orders").select("id, code, origin_city, destination_city").in("id", ids);
      return data.map((i) => ({ ...i, order: os?.find((o) => o.id === i.order_id) }));
    },
  });

  async function submit() {
    if (!orderId) {
      toast.error("Selecione o frete.");
      return;
    }
    setBusy(true);
    try {
      const { data: incident, error } = await supabase.from("incidents").insert({
        order_id: orderId,
        reported_by: userId,
        type,
        severity,
        description: description.trim() || null,
      }).select("id").single();
      if (error) throw error;
      if (photos.length > 0) {
        const position = await getOptionalPosition();
        const uploaded: Array<{ path: string; file: File }> = [];
        for (const file of photos) {
          const path = `${orderId}/incident-${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
          const upload = await supabase.storage.from("order-files").upload(path, file, { contentType: file.type });
          if (upload.error) throw upload.error;
          uploaded.push({ path, file });
        }
        const { error: attachmentError } = await supabase.from("order_attachments").insert(uploaded.map(({ path, file }) => ({
          order_id: orderId,
          kind: "incidente",
          label: file.name,
          file_path: path,
          mime_type: file.type,
          size_bytes: file.size,
          uploaded_by: userId,
          event_status: "incident",
          latitude: position?.latitude ?? null,
          longitude: position?.longitude ?? null,
          metadata: { source: "driver_incident", incident_id: incident.id, incident_type: type, severity },
        })));
        if (attachmentError) throw attachmentError;
      }
      toast.success("Ocorrência registrada. A logística foi notificada.");
      setOpen(false);
      setDescription("");
      setOrderId("");
      setPhotos([]);
      qc.invalidateQueries({ queryKey: ["driver-incidents", userId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao registrar");
    } finally {
      setBusy(false);
    }
  }

  const items = list.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/driver" className="grid h-9 w-9 place-items-center rounded-full border border-border bg-surface hover:bg-accent">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">Ocorrências</h1>
          <p className="text-sm text-muted-foreground">Registre problemas para a logística acompanhar em tempo real.</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-2xl bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Nova
        </button>
      </div>

      {items.length === 0 ? (
        <div className="card-soft grid place-items-center p-12 text-center text-sm text-muted-foreground">
          Você ainda não registrou ocorrências.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((i: any) => {
            const sev = SEVERITY.find((s) => s.value === i.severity) ?? SEVERITY[1];
            const typ = TYPES.find((t) => t.value === i.type)?.label ?? i.type;
            return (
              <li key={i.id} className="card-soft p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <AlertTriangle className="h-4 w-4 text-amber-600" /> {typ}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {i.order?.code ?? ""} · {i.order?.origin_city ?? "—"} → {i.order?.destination_city ?? "—"}
                    </div>
                    {i.description && <p className="mt-2 whitespace-pre-wrap text-sm">{i.description}</p>}
                  </div>
                  <div className="text-right">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${sev.cls}`}>
                      {sev.label}
                    </span>
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {new Date(i.created_at).toLocaleString("pt-BR")}
                    </div>
                    {i.resolved_at && (
                      <div className="mt-1 text-[10px] font-semibold text-emerald-700">Resolvida</div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-lg space-y-4 rounded-t-3xl bg-background p-5 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h2 className="text-lg font-semibold">Registrar ocorrência</h2>
              <p className="text-xs text-muted-foreground">A logística é notificada imediatamente.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Frete</label>
              <select
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm"
              >
                <option value="">Selecione…</option>
                {(orders.data ?? []).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.code} — {o.origin_city ?? "—"} → {o.destination_city ?? "—"}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Fotos da ocorrência (opcional)</label>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-surface px-4 py-3 hover:bg-accent">
                <Paperclip className="h-4 w-4 text-brand" />
                <span className="flex-1 text-sm">{photos.length > 0 ? `${photos.length} foto(s) selecionada(s)` : "Adicionar fotos"}</span>
                <input type="file" hidden accept="image/*" capture="environment" multiple onChange={(event) => setPhotos(Array.from(event.target.files ?? []))} />
              </label>
              {photos.length > 0 && <button type="button" onClick={() => setPhotos([])} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" />Remover fotos</button>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Tipo</label>
              <div className="flex flex-wrap gap-1.5">
                {TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setType(t.value)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset ${
                      type === t.value
                        ? "bg-brand text-brand-foreground ring-brand"
                        : "bg-surface text-muted-foreground ring-border"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Severidade</label>
              <div className="flex gap-1.5">
                {SEVERITY.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setSeverity(s.value)}
                    className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold ring-1 ring-inset ${
                      severity === s.value ? `${s.cls} ring-current` : "bg-surface text-muted-foreground ring-border"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Descrição</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="O que aconteceu?"
                className="w-full resize-none rounded-xl border border-border bg-surface px-3 py-2 text-sm"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 rounded-2xl border border-border bg-background py-3 text-sm font-semibold hover:bg-accent"
              >
                Cancelar
              </button>
              <button
                onClick={submit}
                disabled={busy}
                className="flex-1 rounded-2xl bg-brand py-3 text-sm font-bold text-brand-foreground disabled:opacity-50"
              >
                {busy ? "Enviando…" : "Registrar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getOptionalPosition(): Promise<{ latitude: number; longitude: number } | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 5_000, maximumAge: 30_000 },
    );
  });
}
