import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { useState } from "react";
import { 
  Search, 
  Filter, 
  ChevronRight, 
  FileText, 
  Download,
  Calendar,
  MapPin,
  Truck,
  User,
  Package
} from "lucide-react";
import { statusLabel, statusBadgeClass } from "@/lib/order-status";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/client/fretes")({
  component: ClientOrdersList,
});

function ClientOrdersList() {
  const [search, setSearch] = useState("");
  
  const { data: orders, isLoading } = useQuery({
    queryKey: ["client-orders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select(`
          *,
          driver:profiles!orders_driver_id_fkey(full_name),
          vehicle:vehicles(plate, model)
        `)
        .order("created_at", { ascending: false });
      return data || [];
    }
  });

  const filteredOrders = orders?.filter(o => 
    o.code?.toLowerCase().includes(search.toLowerCase()) ||
    o.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
    o.origin_city?.toLowerCase().includes(search.toLowerCase()) ||
    o.destination_city?.toLowerCase().includes(search.toLowerCase())
  );


  return (
    <AppShell 
      title="Meus Fretes" 
      subtitle="Acompanhe o histórico e o status em tempo real de suas cargas"
      actions={
        <div className="flex items-center gap-3">
          <button className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent">
            <Download className="h-4 w-4" /> Exportar
          </button>
        </div>
      }
    >
      <div className="space-y-6 pb-10">
        {/* Filters Bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por Pedido, NF ou Cidade..."
              className="w-full rounded-xl border border-border bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-medium hover:bg-accent">
              <Filter className="h-4 w-4" /> Filtros Avançados
            </button>
          </div>
        </div>

        {/* Orders Table */}
        <div className="card-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-6 py-4">Ordem de Serviço</th>
                  <th className="px-6 py-4">Documentos</th>
                  <th className="px-6 py-4">Trajeto</th>
                  <th className="px-6 py-4">Operacional</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-muted-foreground">Carregando fretes...</td>
                  </tr>
                ) : filteredOrders?.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-muted-foreground">Nenhum frete encontrado.</td>
                  </tr>
                ) : (
                  filteredOrders?.map((order) => (
                    <tr key={order.id} className="group hover:bg-surface-2/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-foreground">{order.code}</div>
                        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">

                          <Calendar className="h-3 w-3" />
                          {order.created_at && format(new Date(order.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          {order.invoice_number && (
                            <div className="flex items-center gap-1.5 font-medium">
                              <FileText className="h-3.5 w-3.5 text-blue-500" />
                              NF: {order.invoice_number}
                            </div>
                          )}
                          <div className="text-[11px] text-muted-foreground">CT-e: —</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium">{order.origin_city}</span>
                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium">{order.destination_city}</span>
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {order.distance_km || 0} km · {order.cargo_weight_kg || 0} kg
                          </div>

                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{(order.driver as any)?.full_name || "A definir"}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <Truck className="h-3.5 w-3.5" />
                            <span>{(order.vehicle as any)?.plate || "—"}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${statusBadgeClass(order.status)}`}>
                          {statusLabel(order.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-white text-muted-foreground hover:bg-primary hover:text-white hover:border-primary transition-all shadow-sm">
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
