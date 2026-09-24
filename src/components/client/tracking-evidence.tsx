import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Camera, CheckCircle2, Circle, Clock3, Download, FileText, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getClientOrderEvidence } from "@/lib/client-tracking.functions";
import { statusLabel } from "@/lib/order-status";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface ClientEvidenceItem {
  id: string;
  order_id: string;
  event_id: string | null;
  event_status: string | null;
  kind: string;
  label: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  latitude: number | null;
  longitude: number | null;
  uploader_name: string;
  url: string | null;
}

interface TrackingEvent {
  id: string;
  event_type: string;
  to_status: string | null;
  payload: unknown;
  created_at: string;
}

const STAGES = [
  { key: "preparing", statuses: ["planning", "created", "preparing", "awaiting_driver"], label: "Solicitação recebida", description: "A operação foi cadastrada e preparada pela InfinitLog." },
  { key: "driver_assigned", statuses: ["negotiating", "driver_assigned"], label: "Motorista aceitou", description: "Motorista e veículo foram confirmados para o frete." },
  { key: "en_route_pickup", statuses: ["en_route_pickup", "in_transit_to_pickup", "near_pickup", "arriving_pickup"], label: "Veículo deslocando", description: "O veículo está a caminho do local de coleta." },
  { key: "at_pickup", statuses: ["at_pickup"], label: "Chegada ao local de coleta", description: "A chegada à coleta foi registrada." },
  { key: "loading", statuses: ["loading"], label: "Coleta iniciada", description: "O carregamento está em andamento." },
  { key: "loaded", statuses: ["loaded", "picked_up"], label: "Carga carregada", description: "O motorista confirmou o carregamento e a conferência." },
  { key: "in_transit", statuses: ["out_for_delivery", "in_transit"], label: "Em viagem", description: "O veículo saiu para entrega com rastreamento ativo." },
  { key: "near_destination", statuses: ["near_destination", "arriving_destination"], label: "Próximo ao destino", description: "O veículo está se aproximando do destino." },
  { key: "at_destination", statuses: ["at_destination"], label: "Chegada ao destino", description: "A chegada ao local de entrega foi registrada." },
  { key: "unloading", statuses: ["unloading"], label: "Descarga iniciada", description: "A descarga da mercadoria está em andamento." },
  { key: "delivered", statuses: ["delivered"], label: "Carga entregue", description: "A entrega foi confirmada pelo motorista." },
  { key: "finalized", statuses: ["finalized"], label: "Finalizado", description: "A operação foi concluída." },
] as const;

const KIND_LABELS: Record<string, string> = {
  foto_carga: "Fotos do carregamento",
  foto_entrega: "Fotos da entrega",
  canhoto: "Canhoto assinado",
  assinatura: "Assinatura",
  foto_nf: "Nota fiscal",
  nota_fiscal: "Nota fiscal",
  cte: "CT-e",
  mdfe: "MDF-e",
};

export function isEvidencePhoto(item: Pick<ClientEvidenceItem, "mime_type" | "kind">) {
  return Boolean(item.mime_type?.startsWith("image/")) && !["canhoto", "assinatura", "foto_nf", "nota_fiscal"].includes(item.kind);
}

export function evidenceLabel(item: Pick<ClientEvidenceItem, "kind" | "label">) {
  return KIND_LABELS[item.kind] ?? item.label ?? "Documento da operação";
}

export function TrackingEvidence({ orderId, currentStatus }: { orderId: string; currentStatus: string }) {
  const fetchEvidence = useServerFn(getClientOrderEvidence);
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<ClientEvidenceItem | null>(null);
  const queryKey = ["client-order-evidence", orderId] as const;
  const query = useQuery({
    queryKey,
    queryFn: async () => fetchEvidence({ data: { orderId } }),
    staleTime: 5 * 60_000,
    refetchInterval: 15_000,
  });

  useEffect(() => {
    const refresh = () => void queryClient.invalidateQueries({ queryKey });
    const channel = supabase
      .channel(`client-evidence-${orderId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_attachments", filter: `order_id=eq.${orderId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_events", filter: `order_id=eq.${orderId}` }, refresh)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [orderId, queryClient]);

  const evidence = (query.data?.evidence ?? []) as ClientEvidenceItem[];
  const events = (query.data?.events ?? []) as TrackingEvent[];
  const photos = evidence.filter(isEvidencePhoto);
  const documents = evidence.filter((item) => !isEvidencePhoto(item));
  const currentIndex = STAGES.findIndex((stage) => stage.statuses.some((status) => status === currentStatus));
  const eventByStatus = useMemo(() => {
    const map = new Map<string, TrackingEvent>();
    events.forEach((event) => { if (event.to_status) map.set(event.to_status, event); });
    return map;
  }, [events]);

  return (
    <>
      <section className="card-soft p-5 sm:p-6" aria-labelledby="evidence-summary-heading">
        <div className="flex items-center gap-2"><Camera className="h-5 w-5 text-brand" /><h2 id="evidence-summary-heading" className="text-sm font-bold uppercase">Evidências da operação</h2></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Summary icon={<Camera />} label="Fotos" value={photos.length} />
          <Summary icon={<FileText />} label="Documentos" value={documents.length} />
          <Summary icon={<CheckCircle2 />} label="Comprovante" value={evidence.some((item) => ["canhoto", "assinatura"].includes(item.kind)) ? "Disponível" : "Pendente"} />
        </div>
      </section>

      <section className="card-soft p-5 sm:p-6" aria-labelledby="operation-timeline-heading">
        <div className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-brand" /><h2 id="operation-timeline-heading" className="text-sm font-bold uppercase">Acompanhamento da operação</h2></div>
        <ol className="mt-6 space-y-0">
          {STAGES.map((stage, index) => {
            const done = index < currentIndex || (index === currentIndex && ["delivered", "finalized"].includes(currentStatus));
            const current = index === currentIndex && !done;
            const event = [...stage.statuses].reverse().map((status) => eventByStatus.get(status)).find(Boolean);
            const stageEvidence = evidence.filter((item) => item.event_status && stage.statuses.some((status) => status === item.event_status));
            return <TimelineStage key={stage.key} stage={stage} done={done} current={current} event={event} evidence={stageEvidence} onOpen={setSelected} />;
          })}
        </ol>
      </section>

      {evidence.length > 0 && (
        <section className="card-soft p-5 sm:p-6" aria-labelledby="proofs-heading">
          <div className="flex items-center gap-2"><FileText className="h-5 w-5 text-brand" /><h2 id="proofs-heading" className="text-sm font-bold uppercase">Comprovantes da operação</h2></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {evidence.map((item) => <EvidenceTile key={item.id} item={item} onOpen={() => setSelected(item)} />)}
          </div>
        </section>
      )}

      <EvidenceViewer item={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function TimelineStage({ stage, done, current, event, evidence, onOpen }: { stage: typeof STAGES[number]; done: boolean; current: boolean; event?: TrackingEvent; evidence: ClientEvidenceItem[]; onOpen: (item: ClientEvidenceItem) => void }) {
  const photos = evidence.filter(isEvidencePhoto).length;
  const documents = evidence.length - photos;
  return (
    <li className="relative grid grid-cols-[28px_minmax(0,1fr)] gap-3 pb-7 last:pb-0">
      <div className="relative flex justify-center">
        {done ? <CheckCircle2 className="z-10 h-6 w-6 bg-card text-success" /> : current ? <span className="z-10 grid h-6 w-6 place-items-center rounded-full border-2 border-brand bg-card"><span className="h-2 w-2 rounded-full bg-brand" /></span> : <Circle className="z-10 h-6 w-6 bg-card text-muted-foreground/40" />}
        <span className="absolute bottom-[-28px] top-6 w-px bg-border last:hidden" />
      </div>
      <div className={current ? "rounded-md border border-brand/40 bg-brand/5 p-4" : "pt-0.5"}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div><h3 className={done || current ? "text-sm font-bold uppercase" : "text-sm font-bold uppercase text-muted-foreground"}>{stage.label}</h3><p className="mt-1 text-sm text-muted-foreground">{stage.description}</p></div>
          {event && <time className="text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString("pt-BR")}</time>}
        </div>
        {evidence.length > 0 && <div className="mt-3 flex flex-wrap items-center gap-3"><span className="text-xs font-semibold text-muted-foreground">{photos > 0 ? `${photos} foto(s)` : ""}{photos > 0 && documents > 0 ? " · " : ""}{documents > 0 ? `${documents} documento(s)` : ""}</span><Button variant="outline" size="sm" onClick={() => onOpen(evidence[0])}>Ver evidências</Button></div>}
      </div>
    </li>
  );
}

function Summary({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return <div className="rounded-md border bg-secondary/30 p-4"><div className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground"><span className="[&_svg]:h-4 [&_svg]:w-4">{icon}</span>{label}</div><p className="mt-2 text-xl font-bold tabular-nums">{value}</p></div>;
}

function EvidenceTile({ item, onOpen }: { item: ClientEvidenceItem; onOpen: () => void }) {
  const photo = isEvidencePhoto(item);
  return <Button variant="outline" className="h-auto justify-start overflow-hidden p-0 text-left" onClick={onOpen}><div className="grid h-20 w-24 shrink-0 place-items-center bg-secondary/50">{photo && item.url ? <img src={item.url} alt={evidenceLabel(item)} className="h-full w-full object-cover" /> : <FileText className="h-6 w-6 text-muted-foreground" />}</div><div className="min-w-0 p-3"><p className="truncate font-semibold">{evidenceLabel(item)}</p><p className="mt-1 text-xs font-normal text-muted-foreground">{new Date(item.created_at).toLocaleString("pt-BR")}</p></div></Button>;
}

function EvidenceViewer({ item, onClose }: { item: ClientEvidenceItem | null; onClose: () => void }) {
  return <Dialog open={Boolean(item)} onOpenChange={(open) => !open && onClose()}><DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>{item ? evidenceLabel(item) : "Evidência"}</DialogTitle></DialogHeader>{item && <div className="space-y-4">{item.url && item.mime_type?.startsWith("image/") ? <img src={item.url} alt={evidenceLabel(item)} className="max-h-[60vh] w-full rounded-md object-contain" /> : item.url && item.mime_type === "application/pdf" ? <iframe title={evidenceLabel(item)} src={item.url} className="h-[60vh] w-full rounded-md border" /> : <div className="grid min-h-52 place-items-center rounded-md border bg-secondary/30"><FileText className="h-10 w-10 text-muted-foreground" /></div>}<div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2"><p>Enviado por: <span className="font-medium text-foreground">{item.uploader_name}</span></p><p>Data e hora: <span className="font-medium text-foreground">{new Date(item.created_at).toLocaleString("pt-BR")}</span></p>{item.latitude != null && item.longitude != null && <p className="flex items-center gap-1"><MapPin className="h-4 w-4" /> Local do registro disponível</p>}<p>Etapa: <span className="font-medium text-foreground">{statusLabel(item.event_status)}</span></p></div>{item.url && <Button asChild><a href={item.url} target="_blank" rel="noopener noreferrer"><Download />Visualizar / baixar</a></Button>}</div>}</DialogContent></Dialog>;
}