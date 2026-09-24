import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Calendar, Download, Eye, FileText, ImageIcon, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { evidenceLabel, isEvidencePhoto, type ClientEvidenceItem } from "@/components/client/tracking-evidence";
import { supabase } from "@/integrations/supabase/client";
import { getClientOrderEvidence } from "@/lib/client-tracking.functions";
import { statusLabel } from "@/lib/order-status";

export const Route = createFileRoute("/_authenticated/client/documentos")({
  head: () => ({
    meta: [
      { title: "Central de documentos — InfinitLog" },
      { name: "description", content: "Consulte fotos, documentos e comprovantes reais dos seus fretes." },
      { property: "og:title", content: "Central de documentos — InfinitLog" },
      { property: "og:description", content: "Consulte fotos, documentos e comprovantes reais dos seus fretes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ClientDocuments,
});

function ClientDocuments() {
  const fetchEvidence = useServerFn(getClientOrderEvidence);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ClientEvidenceItem | null>(null);
  const queryKey = ["client-documents-real"] as const;
  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: async () => fetchEvidence({ data: {} }),
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    const refresh = () => void queryClient.invalidateQueries({ queryKey });
    const channel = supabase
      .channel("client-documents-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "order_attachments" }, refresh)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [queryClient]);

  const orderCodes = useMemo(() => new Map((data?.orders ?? []).map((order) => [order.id, order.code])), [data?.orders]);
  const documents = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return ((data?.evidence ?? []) as ClientEvidenceItem[]).filter((item) => {
      if (!term) return true;
      return [evidenceLabel(item), orderCodes.get(item.order_id), statusLabel(item.event_status)]
        .some((value) => value?.toLocaleLowerCase("pt-BR").includes(term));
    }).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [data?.evidence, orderCodes, search]);

  return (
    <AppShell title="Central de Documentos" subtitle="Arquivos reais vinculados às suas operações">
      <div className="space-y-6 pb-10">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por pedido, etapa ou documento" className="h-11 w-full rounded-md border bg-background pl-10 pr-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </div>

        {isLoading ? <DocumentSkeleton /> : isError ? <DocumentState title="Não foi possível carregar os documentos" text="Tente novamente em alguns instantes." /> : documents.length === 0 ? <DocumentState title="Nenhum documento encontrado" text={search ? "Ajuste os termos da busca." : "Ainda não há evidências enviadas para seus fretes."} /> : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {documents.map((item) => {
              const photo = isEvidencePhoto(item);
              return (
                <article key={item.id} className="overflow-hidden rounded-md border bg-card">
                  <button type="button" onClick={() => setSelected(item)} className="block aspect-video w-full bg-secondary/40 text-left">
                    {photo && item.url ? <img src={item.url} alt={evidenceLabel(item)} className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center"><FileText className="h-10 w-10 text-muted-foreground" /></span>}
                  </button>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate text-sm font-semibold">{evidenceLabel(item)}</h2><p className="mt-1 text-xs text-muted-foreground">Pedido {orderCodes.get(item.order_id) ?? "—"}</p></div>{photo ? <ImageIcon className="h-4 w-4 shrink-0 text-brand" /> : <FileText className="h-4 w-4 shrink-0 text-brand" />}</div>
                    <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground"><Calendar className="h-3.5 w-3.5" />{new Date(item.created_at).toLocaleString("pt-BR")}</div>
                    <p className="mt-2 text-xs text-muted-foreground">{statusLabel(item.event_status)} · {item.uploader_name}</p>
                    <div className="mt-4 flex gap-2"><Button variant="outline" size="sm" className="flex-1" onClick={() => setSelected(item)}><Eye />Visualizar</Button>{item.url && <Button asChild size="sm"><a href={item.url} target="_blank" rel="noopener noreferrer" aria-label={`Baixar ${evidenceLabel(item)}`}><Download /></a></Button>}</div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader><DialogTitle>{selected ? evidenceLabel(selected) : "Documento"}</DialogTitle></DialogHeader>
          {selected?.url && selected.mime_type?.startsWith("image/") && <img src={selected.url} alt={evidenceLabel(selected)} className="max-h-[65vh] w-full rounded-md object-contain" />}
          {selected?.url && selected.mime_type === "application/pdf" && <iframe title={evidenceLabel(selected)} src={selected.url} className="h-[65vh] w-full rounded-md border" />}
          {selected?.url && <Button asChild><a href={selected.url} target="_blank" rel="noopener noreferrer"><Download />Visualizar / baixar</a></Button>}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function DocumentSkeleton() {
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-64 animate-pulse rounded-md border bg-secondary/40" />)}</div>;
}

function DocumentState({ title, text }: { title: string; text: string }) {
  return <div className="rounded-md border border-dashed p-12 text-center"><FileText className="mx-auto h-10 w-10 text-muted-foreground" /><h2 className="mt-4 font-semibold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{text}</p></div>;
}