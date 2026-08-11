import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { 
  FileText, 
  Download, 
  Search, 
  Calendar, 
  File
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/client/documentos")({
  component: ClientDocuments,
});

function ClientDocuments() {
  const { data: documents, isLoading } = useQuery({
    queryKey: ["client-documents-real"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Buscamos pedidos do cliente que possuem arquivos anexados ou links de documentos
      const { data: orders } = await supabase
        .from("orders")
        .select(`
          id, code, invoice_number, invoice_url, created_at,
          deliveries (
            invoice_url,
            pickup_photo_url,
            delivery_photo_url,
            signature_url
          )
        `)
        .eq("client_id", user.id);

      if (!orders) return [];

      const docs: any[] = [];

      orders.forEach(order => {
        // Nota Fiscal do Pedido
        if (order.invoice_url) {
          docs.push({
            id: `${order.id}-nf`,
            name: `Nota Fiscal - ${order.invoice_number || order.code}`,
            type: 'NF',
            date: order.created_at ? format(new Date(order.created_at), "yyyy-MM-dd") : "-",
            order: order.code,
            size: '—',
            url: order.invoice_url
          });
        }

        // Documentos da Entrega (se houver)
        if (order.deliveries) {
          const del = order.deliveries as any;
          if (del.invoice_url) {
            docs.push({
              id: `${order.id}-del-nf`,
              name: `NF Digitalizada - ${order.code}`,
              type: 'NF',
              date: format(new Date(), "yyyy-MM-dd"), // Placeholder
              order: order.code,
              size: '—',
              url: del.invoice_url
            });
          }
          if (del.signature_url) {
            docs.push({
              id: `${order.id}-sig`,
              name: `Canhoto Assinado - ${order.code}`,
              type: 'Canhoto',
              date: format(new Date(), "yyyy-MM-dd"),
              order: order.code,
              size: '—',
              url: del.signature_url
            });
          }
          if (del.delivery_photo_url) {
            docs.push({
              id: `${order.id}-photo`,
              name: `Comprovante de Entrega - ${order.code}`,
              type: 'Foto',
              date: format(new Date(), "yyyy-MM-dd"),
              order: order.code,
              size: '—',
              url: del.delivery_photo_url
            });
          }
        }
      });

      return docs;
    }
  });

  if (isLoading) return <div className="p-8 text-center">Carregando documentos reais...</div>;

  return (
    <AppShell 
      title="Central de Documentos" 
      subtitle="Documentos reais vinculados às suas operações"
    >
      <div className="space-y-6 pb-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input 
              placeholder="Buscar por Pedido ou Tipo..."
              className="w-full rounded-xl border border-border bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {documents?.map((doc) => (
            <div key={doc.id} className="card-soft flex items-center justify-between p-5 hover:border-primary/40 transition-colors">
              <div className="flex items-center gap-4">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-50 text-slate-400">
                  <FileText className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm">{doc.name}</h4>
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {doc.date}</span>
                    <span className="flex items-center gap-1"><File className="h-3 w-3" /> Pedido: {doc.order}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a 
                  href={doc.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-white text-muted-foreground hover:bg-accent transition-all"
                >
                  <Download className="h-4 w-4" />
                </a>
              </div>
            </div>
          ))}
          {(!documents || documents.length === 0) && (
            <div className="col-span-full py-12 text-center card-soft border-dashed">
              <p className="text-muted-foreground italic">Nenhum documento real anexado às suas ordens de serviço até o momento.</p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
