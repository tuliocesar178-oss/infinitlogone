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

export const Route = createFileRoute("/_authenticated/client/documentos")({
  component: ClientDocuments,
});

function ClientDocuments() {
  const { data: documents, isLoading } = useQuery({
    queryKey: ["client-documents"],
    queryFn: async () => {
      // Mock documents for now. In a real scenario, we'd join order_attachments with orders filtered by client_id.
      return [
        { id: '1', name: 'Nota Fiscal - NF87231', type: 'NF', date: '2024-03-20', order: 'INF-2024-0001', size: '1.2 MB' },
        { id: '2', name: 'CT-e - 55432', type: 'CTE', date: '2024-03-20', order: 'INF-2024-0001', size: '450 KB' },
        { id: '3', name: 'Canhoto Assinado - INF-0001', type: 'Canhoto', date: '2024-03-21', order: 'INF-2024-0001', size: '2.1 MB' },
        { id: '4', name: 'Nota Fiscal - NF87232', type: 'NF', date: '2024-03-18', order: 'INF-2024-0002', size: '1.1 MB' },
        { id: '5', name: 'Comprovante de Entrega', type: 'Foto', date: '2024-03-19', order: 'INF-2024-0002', size: '3.4 MB' },
      ];
    }
  });

  return (
    <AppShell 
      title="Central de Documentos" 
      subtitle="Consulte e baixe todos os documentos fiscais e comprovantes de suas operações"
    >
      <div className="space-y-6 pb-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input 
              placeholder="Buscar por Pedido, NF ou Tipo..."
              className="w-full rounded-xl border border-border bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex gap-2">
            <select className="rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-medium outline-none">
              <option>Todos os tipos</option>
              <option>Nota Fiscal</option>
              <option>CT-e</option>
              <option>Canhoto</option>
              <option>Fotos</option>
            </select>
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
                    <span className="flex items-center gap-1"><File className="h-3 w-3" /> {doc.size}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-white text-muted-foreground hover:bg-accent transition-all">
                  <Download className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
