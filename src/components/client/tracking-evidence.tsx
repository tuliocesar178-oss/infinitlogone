import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, CheckCircle2, Download, FileText, ImageIcon, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DeliveryEvidence = {
  delivered_at: string | null;
  receiver_name: string | null;
  delivery_photo_url: string | null;
  pickup_photo_url: string | null;
  signature_url: string | null;
  invoice_url: string | null;
};

type OrderAttachment = {
  id: string;
  file_path: string;
  kind: string;
  label: string | null;
  mime_type: string | null;
  created_at: string;
};

type EvidenceItem = {
  id: string;
  url: string;
  label: string;
  kind: "photo" | "document";
  createdAt: string | null;
};

function isImage(url: string, mimeType?: string | null) {
  return mimeType?.startsWith("image/") || /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(url);
}

function formatDateTime(value: string | null) {
  return value ? new Date(value).toLocaleString("pt-BR") : "Data não informada";
}

function evidenceLabel(kind: string, label: string | null) {
  return label || ({
    nota_fiscal: "Nota fiscal",
    cte: "CT-e",
    mdfe: "MDF-e",
    manifesto: "Manifesto",
    foto: "Foto da operação",
    video: "Vídeo da operação",
  }[kind] ?? "Documento da operação");
}

export function TrackingEvidence({ orderId }: { orderId: string }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<EvidenceItem | null>(null);

  const evidenceQuery = useQuery({
    queryKey: ["tracking-evidence", orderId],
    queryFn: async () => {
      const [{ data: delivery, error: deliveryError }, { data: attachments, error: attachmentsError }] =
        await Promise.all([
          supabase
            .from("deliveries")
            .select("delivered_at, receiver_name, delivery_photo_url, pickup_photo_url, signature_url, invoice_url")
            .eq("order_id", orderId)
            .maybeSingle(),
          supabase
            .from("order_attachments")
            .select("id, file_path, kind, label, mime_type, created_at")
            .eq("order_id", orderId)
            .order("created_at", { ascending: false }),
        ]);

      if (deliveryError) throw deliveryError;
      if (attachmentsError) throw attachmentsError;

      return {
        delivery: (delivery ?? null) as DeliveryEvidence | null,
        attachments: (attachments ?? []) as OrderAttachment[],
      };
    },
    refetchInterval: 15_000,
  });

  useEffect(() => {
    const refresh = () =>
      void queryClient.invalidateQueries({ queryKey: ["tracking-evidence", orderId] });

    const channel = supabase
      .channel(`tracking-evidence-${orderId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "deliveries", filter: `order_id=eq.${orderId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_attachments", filter: `order_id=eq.${orderId}` }, refresh)
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orderId, queryClient]);

  const items = useMemo(() => {
    const delivery = evidenceQuery.data?.delivery;
    const result: EvidenceItem[] = [];

    if (delivery?.pickup_photo_url) {
      result.push({
        id: `${orderId}-pickup`,
        url: delivery.pickup_photo_url,
        label: "Foto da coleta",
        kind: "photo",
        createdAt: delivery.delivered_at,
      });
    }

    if (delivery?.delivery_photo_url) {
      result.push({
        id: `${orderId}-delivery`,
        url: delivery.delivery_photo_url,
        label: "Foto da entrega",
        kind: "photo",
        createdAt: delivery.delivered_at,
      });
    }

    if (delivery?.signature_url) {
      result.push({
        id: `${orderId}-signature`,
        url: delivery.signature_url,
        label: "Canhoto assinado",
        kind: isImage(delivery.signature_url) ? "photo" : "document",
        createdAt: delivery.delivered_at,
      });
    }

    if (delivery?.invoice_url) {
      result.push({
        id: `${orderId}-invoice`,
        url: delivery.invoice_url,
        label: "Nota fiscal",
        kind: isImage(delivery.invoice_url) ? "photo" : "document",
        createdAt: delivery.delivered_at,
      });
    }

    for (const attachment of evidenceQuery.data?.attachments ?? []) {
      if (!attachment.file_path.startsWith("http")) continue;

      result.push({
        id: attachment.id,
        url: attachment.file_path,
        label: evidenceLabel(attachment.kind, attachment.label),
        kind: isImage(attachment.file_path, attachment.mime_type) ? "photo" : "document",
        createdAt: attachment.created_at,
      });
    }

    return result;
  }, [evidenceQuery.data, orderId]);

  const photos = items.filter((item) => item.kind === "photo");
  const documents = items.filter((item) => item.kind === "document");
  const delivery = evidenceQuery.data?.delivery;

  if (evidenceQuery.isLoading || !items.length) return null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-widest">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            Evidências da operação
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Arquivos reais vinculados a este frete.
          </p>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <EvidenceSummary icon={<Camera className="h-4 w-4" />} label="Fotos" value={photos.length} />
            <EvidenceSummary icon={<FileText className="h-4 w-4" />} label="Documentos" value={documents.length} />
            <EvidenceSummary
              icon={<CheckCircle2 className="h-4 w-4" />}
              label="Comprovante"
              value={delivery?.signature_url ? "Disponível" : "—"}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((item) => (
              <EvidenceCard key={item.id} item={item} onOpen={() => setSelected(item)} />
            ))}
          </div>

          {delivery?.delivered_at && (
            <p className="text-xs text-muted-foreground">
              Última evidência de entrega registrada em {formatDateTime(delivery.delivered_at)}
              {delivery.receiver_name ? ` · Recebido por ${delivery.receiver_name}` : ""}.
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selected?.label}</DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              {isImage(selected.url) ? (
                <img
                  src={selected.url}
                  alt={selected.label}
                  className="max-h-[65vh] w-full rounded-lg object-contain"
                />
              ) : (
                <div className="grid min-h-64 place-items-center rounded-lg border bg-muted/30">
                  <div className="text-center">
                    <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      Este arquivo será aberto em uma nova aba.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Enviado em {formatDateTime(selected.createdAt)}
                </p>
                <Button asChild variant="outline">
                  <a href={selected.url} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4" />
                    Visualizar / baixar
                  </a>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function EvidenceSummary({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function EvidenceCard({
  item,
  onOpen,
}: {
  item: EvidenceItem;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group overflow-hidden rounded-lg border bg-card text-left transition hover:border-primary/50"
    >
      <div className="relative grid aspect-video place-items-center bg-muted/30">
        {item.kind === "photo" ? (
          <img
            src={item.url}
            alt={item.label}
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <FileText className="h-8 w-8 text-muted-foreground" />
        )}
        <span className="absolute bottom-2 left-2 rounded-full bg-background/90 px-2 py-1 text-[10px] font-medium">
          {item.kind === "photo" ? "Foto" : "Documento"}
        </span>
      </div>
      <div className="flex items-center gap-2 p-3 text-sm font-medium">
        {item.kind === "photo" ? (
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
        ) : (
          <FileText className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="truncate">{item.label}</span>
      </div>
    </button>
  );
}