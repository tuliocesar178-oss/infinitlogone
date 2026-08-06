import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  FileText, 
  CreditCard, 
  DollarSign, 
  ArrowUpRight, 
  Download, 
  Search,
  CheckCircle2,
  Clock,
  AlertCircle
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/client/financeiro")({
  component: ClientFinanceiro,
});

function ClientFinanceiro() {
  const { data: invoices } = useQuery({
    queryKey: ["client-financial-data"],
    queryFn: async () => {
      return [
        { id: 1, doc: "FAT-2024-001", value: "R$ 12.450,00", status: "pago", date: "15/05/2024", due: "20/05/2024" },
        { id: 2, doc: "FAT-2024-002", value: "R$ 8.920,00", status: "pendente", date: "01/06/2024", due: "10/06/2024" },
        { id: 3, doc: "FAT-2024-003", value: "R$ 15.100,00", status: "atrasado", date: "20/04/2024", due: "30/04/2024" },
      ];
    }
  });

  return (
    <AppShell 
      title="Área Financeira" 
      subtitle="Gestão de faturas, boletos e histórico de pagamentos"
    >
      <div className="space-y-8 pb-10">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <FinancialStatCard label="Total Pago" value="R$ 142.500" icon={CheckCircle2} color="text-emerald-500" />
          <FinancialStatCard label="A Pagar" value="R$ 8.920" icon={Clock} color="text-amber-500" />
          <FinancialStatCard label="Em Atraso" value="R$ 15.100" icon={AlertCircle} color="text-red-500" />
        </div>

        <div className="card-soft overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b border-border/60">
            <h3 className="font-semibold tracking-tight">Faturas e Boletos</h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input 
                  placeholder="Buscar fatura..."
                  className="rounded-lg border border-border bg-white py-1.5 pl-9 pr-3 text-xs outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-6 py-4">Documento</th>
                  <th className="px-6 py-4">Emissão</th>
                  <th className="px-6 py-4">Vencimento</th>
                  <th className="px-6 py-4">Valor</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-sm">
                {invoices?.map((inv) => (
                  <tr key={inv.id} className="hover:bg-surface-2/30">
                    <td className="px-6 py-4 font-medium">{inv.doc}</td>
                    <td className="px-6 py-4 text-muted-foreground">{inv.date}</td>
                    <td className="px-6 py-4 text-muted-foreground">{inv.due}</td>
                    <td className="px-6 py-4 font-semibold">{inv.value}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        inv.status === 'pago' ? 'bg-emerald-100 text-emerald-800' : 
                        inv.status === 'pendente' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1">
                        <Download className="h-4 w-4" /> PDF
                      </button>
                    </td>
                  </tr>
                ))}
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
