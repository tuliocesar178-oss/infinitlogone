import { COMMERCIAL_ORDERS } from "@/lib/order-projections";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  FileText, 
  ArrowUpRight, 
  Download, 
  Search,
  CheckCircle2,
  Clock,
  AlertCircle
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/client/financeiro")({
  head: () => ({ meta: [{ title: 'client · financeiro — INFINITLOG' }, { name: "description", content: 'client · financeiro — INFINITLOG. Informações e acompanhamento na plataforma INFINITLOG VAPT VUPT.' }, { property: "og:title", content: 'client · financeiro — INFINITLOG' }, { property: "og:description", content: 'client · financeiro — INFINITLOG. Informações e acompanhamento na plataforma INFINITLOG VAPT VUPT.' }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" } ] }),
  component: ClientFinanceiro,
});

function ClientFinanceiro() {
  const { data: financialData, isLoading } = useQuery({
    queryKey: ["client-financial-real-data"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Buscamos pedidos com valores financeiros reais
      const { data: orders } = await supabase
        .from(COMMERCIAL_ORDERS)
        .select("*")
        .eq("client_id", user.id)
        .not("client_amount", "is", null);

      if (!orders) return null;

      const totalValue = orders.reduce((acc, o) => acc + (o.client_amount || 0), 0);
      const paidValue = orders.filter(o => o.status === 'delivered' || o.status === 'finalized').reduce((acc, o) => acc + (o.client_amount || 0), 0);
      const pendingValue = orders.filter(o => o.status !== 'delivered' && o.status !== 'finalized' && o.status !== 'cancelled').reduce((acc, o) => acc + (o.client_amount || 0), 0);

      const invoices = orders.map(o => ({
        id: o.id,
        doc: o.invoice_number || `PED-${o.code}`,
        value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(o.client_amount || 0),
        status: o.status === 'delivered' || o.status === 'finalized' ? 'pago' : 'pendente',
        date: o.created_at ? format(new Date(o.created_at), "dd/MM/yyyy") : "-",
        due: o.delivery_window_end ? format(new Date(o.delivery_window_end), "dd/MM/yyyy") : "-"
      }));

      return {
        totalPaid: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(paidValue),
        totalPending: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pendingValue),
        totalAtraso: "R$ 0,00", // Logica de atraso dependeria de data de vencimento vs hoje
        invoices
      };
    }
  });

  if (isLoading) return <div className="p-8 text-center">Carregando dados financeiros reais...</div>;

  return (
    <AppShell 
      title="Área Financeira" 
      subtitle="Gestão baseada nos valores reais dos seus fretes"
    >
      <div className="space-y-8 pb-10">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <FinancialStatCard label="Total Pago" value={financialData?.totalPaid || "R$ 0,00"} icon={CheckCircle2} color="text-emerald-500" />
          <FinancialStatCard label="A Pagar (Em trânsito)" value={financialData?.totalPending || "R$ 0,00"} icon={Clock} color="text-amber-500" />
          <FinancialStatCard label="Em Atraso" value={financialData?.totalAtraso || "R$ 0,00"} icon={AlertCircle} color="text-red-500" />
        </div>

        <div className="card-soft overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b border-border/60">
            <h3 className="font-semibold tracking-tight">Faturas baseadas em Pedidos</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-6 py-4">Documento / NF</th>
                  <th className="px-6 py-4">Emissão</th>
                  <th className="px-6 py-4">Previsão</th>
                  <th className="px-6 py-4">Valor do Frete</th>
                  <th className="px-6 py-4">Status Operacional</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-sm">
                {financialData?.invoices?.map((inv) => (
                  <tr key={inv.id} className="hover:bg-surface-2/30">
                    <td className="px-6 py-4 font-medium">{inv.doc}</td>
                    <td className="px-6 py-4 text-muted-foreground">{inv.date}</td>
                    <td className="px-6 py-4 text-muted-foreground">{inv.due}</td>
                    <td className="px-6 py-4 font-semibold">{inv.value}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        inv.status === 'pago' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1">
                        <Download className="h-4 w-4" /> Detalhes
                      </button>
                    </td>
                  </tr>
                ))}
                {(!financialData?.invoices || financialData.invoices.length === 0) && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground italic">Nenhum dado financeiro encontrado para suas operações.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function FinancialStatCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: any; color: string }) {
  return (
    <div className="card-soft p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-surface-2">
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-bold tracking-tight mt-1">{value}</div>
    </div>
  );
}
