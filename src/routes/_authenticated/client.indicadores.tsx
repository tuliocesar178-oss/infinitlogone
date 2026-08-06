import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { 
  BarChart3, 
  ArrowUpRight, 
  ArrowDownRight, 
  TrendingUp,
  Clock,
  Target,
  Zap,
  AlertTriangle,
  Package,
  CheckCircle2,
  Calendar,
  Filter,
  Download,
  Search
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line
} from "recharts";

export const Route = createFileRoute("/_authenticated/client/indicadores")({
  component: ClientIndicators,
});

function ClientIndicators() {
  const { data: indicators } = useQuery({
    queryKey: ["client-indicators"],
    queryFn: async () => {
      return {
        sla: "96.4%",
        otif: "92.8%",
        avgLeadTime: "2.4 dias",
        performanceHistory: [
          { month: 'Jan', sla: 94, otif: 89 },
          { month: 'Fev', sla: 95, otif: 91 },
          { month: 'Mar', sla: 96, otif: 90 },
          { month: 'Abr', sla: 94, otif: 92 },
          { month: 'Mai', sla: 97, otif: 93 },
          { month: 'Jun', sla: 98, otif: 94 },
        ]
      };
    }
  });

  return (
    <AppShell 
      title="Central de Indicadores" 
      subtitle="Métricas de performance e qualidade da sua operação logística"
    >
      <div className="space-y-8 pb-10">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <IndicatorCard 
            label="SLA Geral" 
            value={indicators?.sla ?? "0%"} 
            description="Acordo de nível de serviço"
            icon={Target}
            color="bg-blue-500"
          />
          <IndicatorCard 
            label="OTIF" 
            value={indicators?.otif ?? "0%"} 
            description="On Time In Full"
            icon={CheckCircle2}
            color="bg-emerald-500"
          />
          <IndicatorCard 
            label="Tempo Médio" 
            value={indicators?.avgLeadTime ?? "—"} 
            description="Lead time de entrega"
            icon={Clock}
            color="bg-amber-500"
          />
        </div>

        <div className="card-soft p-6">
          <h3 className="mb-6 font-semibold tracking-tight">Evolução SLA vs OTIF (%)</h3>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={indicators?.performanceHistory}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} domain={[80, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="sla" name="SLA" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="otif" name="OTIF" stroke="#10B981" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function IndicatorCard({ label, value, description, icon: Icon, color }: { label: string; value: string; description: string; icon: any; color: string }) {
  return (
    <div className="card-soft p-6">
      <div className="flex items-center gap-4">
        <div className={`grid h-12 w-12 place-items-center rounded-2xl ${color} text-white`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <div className="text-sm font-medium text-muted-foreground">{label}</div>
          <div className="text-2xl font-bold tracking-tight">{value}</div>
          <div className="text-[11px] text-muted-foreground mt-1 uppercase tracking-wider">{description}</div>
        </div>
      </div>
    </div>
  );
}
