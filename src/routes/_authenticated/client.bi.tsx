import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { 
  BarChart3, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight, 
  Package, 
  Clock, 
  Truck, 
  AlertTriangle,
  Zap,
  Target
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell
} from "recharts";

export const Route = createFileRoute("/_authenticated/client/bi")({
  component: ClientBI,
});

function ClientBI() {
  const { data: biData } = useQuery({
    queryKey: ["client-bi-data"],
    queryFn: async () => {
      // Mock data for BI
      const monthlyFreight = [
        { month: 'Jan', freight: 42, lastYear: 38 },
        { month: 'Fev', freight: 58, lastYear: 45 },
        { month: 'Mar', freight: 45, lastYear: 50 },
        { month: 'Abr', freight: 72, lastYear: 55 },
        { month: 'Mai', freight: 65, lastYear: 60 },
        { month: 'Jun', freight: 88, lastYear: 68 },
      ];

      const deliveryEfficiency = [
        { day: '01', rate: 92 },
        { day: '05', rate: 95 },
        { day: '10', rate: 88 },
        { day: '15', rate: 96 },
        { day: '20', rate: 94 },
        { day: '25', rate: 98 },
        { day: '30', rate: 95 },
      ];

      return {
        monthlyFreight,
        deliveryEfficiency,
        kpis: [
          { label: "SLA Global", value: "96.4%", trend: "+2.1%", positive: true },
          { label: "OTIF", value: "92.8%", trend: "+1.5%", positive: true },
          { label: "Lead Time Médio", value: "2.4 dias", trend: "-0.2d", positive: true },
          { label: "Ocorrências", value: "0.8%", trend: "-0.3%", positive: true },
        ]
      };
    }
  });

  return (
    <AppShell 
      title="BI Logístico" 
      subtitle="Indicadores estratégicos e análise avançada da sua operação"
    >
      <div className="space-y-8 pb-10">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {biData?.kpis.map((kpi) => (
            <div key={kpi.label} className="card-soft p-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{kpi.label}</span>
                <span className={`flex items-center gap-0.5 text-xs font-bold ${kpi.positive ? 'text-emerald-600' : 'text-red-600'}`}>
                  {kpi.positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {kpi.trend}
                </span>
              </div>
              <div className="mt-2 text-3xl font-bold tracking-tight">{kpi.value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="card-soft p-6">
            <h3 className="mb-6 font-semibold tracking-tight">Crescimento Mensal (Ano x Anterior)</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={biData?.monthlyFreight}>
                  <defs>
                    <linearGradient id="colorFreight" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Area type="monotone" dataKey="freight" stroke="#3B82F6" fillOpacity={1} fill="url(#colorFreight)" strokeWidth={3} />
                  <Area type="monotone" dataKey="lastYear" stroke="#94A3B8" fillOpacity={0} strokeDasharray="5 5" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card-soft p-6">
            <h3 className="mb-6 font-semibold tracking-tight">Eficiência de Entrega (%)</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={biData?.deliveryEfficiency}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} domain={[80, 100]} />
                  <Tooltip />
                  <Line type="stepAfter" dataKey="rate" stroke="#10B981" strokeWidth={3} dot={{ r: 4, fill: '#10B981' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="card-soft p-8 bg-slate-900 text-white border-none">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
              <Zap className="h-5 w-5" />
            </div>
            <h3 className="text-xl font-semibold">Resumo Executivo da Operação</h3>
          </div>
          <p className="text-slate-400 leading-relaxed max-w-3xl">
            Sua operação logística apresentou um crescimento de 18% em volume neste semestre, mantendo um SLA superior à média do mercado. 
            A rota São Paulo → Rio de Janeiro continua sendo a mais eficiente, enquanto as entregas em Minas Gerais tiveram uma redução de 12% no lead time 
            após a implementação do rastreamento automático.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
