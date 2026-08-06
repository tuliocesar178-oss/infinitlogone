import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { 
  BarChart3, 
  Package, 
  CheckCircle2, 
  Clock, 
  Truck, 
  AlertTriangle, 
  TrendingUp, 
  Scale, 
  DollarSign, 
  Timer,
  Calendar,
  ChevronRight,
  MapPin
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
  PieChart,
  Pie,
  Cell
} from "recharts";

export const Route = createFileRoute("/_authenticated/client/")({
  component: ClientDashboard,
});

function ClientDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["client-stats"],
    queryFn: async () => {
      // For now, fetching all orders to calculate stats.
      // In a real scenario, we would filter by client_id.
      const { data: orders } = await supabase
        .from("orders")
        .select("*");
      
      if (!orders) return null;

      const total = orders.length;
      const inProgress = orders.filter(o => ["driver_assigned", "en_route_pickup", "at_pickup", "loaded", "picked_up", "out_for_delivery", "in_transit", "near_destination", "at_destination"].includes(o.status)).length;
      const delivered = orders.filter(o => o.status === "delivered" || o.status === "finalized").length;
      const awaiting = orders.filter(o => o.status === "preparing" || o.status === "created" || o.status === "awaiting_driver").length;
      const incidents = orders.filter(o => o.status === "incident").length;

      // Mock data for graphs since real data might be sparse
      const monthlyData = [
        { name: 'Jan', value: 45 },
        { name: 'Fev', value: 52 },
        { name: 'Mar', value: 48 },
        { name: 'Abr', value: 70 },
        { name: 'Mai', value: 61 },
        { name: 'Jun', value: 85 },
      ];

      const stateData = [
        { name: 'SP', value: 40 },
        { name: 'RJ', value: 25 },
        { name: 'MG', value: 20 },
        { name: 'PR', value: 10 },
        { name: 'Outros', value: 5 },
      ];

      return {
        total,
        inProgress,
        delivered,
        awaiting,
        incidents,
        onTimeRate: "94%",
        totalKm: "12,450",
        totalWeight: "85.2 ton",
        totalInvoiced: "R$ 450.000",
        totalFreight: "R$ 62.400",
        avgDeliveryTime: "2.4 dias",
        monthlyData,
        stateData
      };
    }
  });

  const COLORS = ['#0F172A', '#3B82F6', '#64748B', '#94A3B8', '#CBD5E1'];

  return (
    <AppShell 
      title="Portal Executivo do Cliente" 
      subtitle="INFINITLOG — Inteligência Logística em Tempo Real"
    >
      <div className="space-y-8 pb-10">
        {/* KPI Grid */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <StatCard 
            label="Total de Fretes" 
            value={stats?.total ?? 0} 
            icon={Package} 
            trend="+12%" 
          />
          <StatCard 
            label="Em Andamento" 
            value={stats?.inProgress ?? 0} 
            icon={Truck} 
            color="text-blue-600"
          />
          <StatCard 
            label="Entregues" 
            value={stats?.delivered ?? 0} 
            icon={CheckCircle2} 
            color="text-emerald-600"
          />
          <StatCard 
            label="Aguardando" 
            value={stats?.awaiting ?? 0} 
            icon={Clock} 
            color="text-amber-600"
          />
          <StatCard 
            label="Ocorrências" 
            value={stats?.incidents ?? 0} 
            icon={AlertTriangle} 
            color="text-red-600"
          />
          <StatCard 
            label="No Prazo" 
            value={stats?.onTimeRate ?? "0%"} 
            icon={TrendingUp} 
            color="text-emerald-600"
          />
        </div>

        {/* Secondary KPIs */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SecondaryStatCard label="Quilometragem Total" value={stats?.totalKm ?? "0"} icon={MapPin} unit="km" />
          <SecondaryStatCard label="Peso Transportado" value={stats?.totalWeight ?? "0"} icon={Scale} />
          <SecondaryStatCard label="Valor em Notas Fiscais" value={stats?.totalInvoiced ?? "R$ 0"} icon={DollarSign} />
          <SecondaryStatCard label="Tempo Médio Entrega" value={stats?.avgDeliveryTime ?? "0"} icon={Timer} />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Evolução Mensal */}
          <div className="card-soft p-6">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="font-semibold tracking-tight">Evolução Mensal de Fretes</h3>
              <select className="rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none">
                <option>Últimos 6 meses</option>
                <option>Este ano</option>
              </select>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip 
                    cursor={{ fill: '#f1f5f9' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Distribuição por Estado */}
          <div className="card-soft p-6">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="font-semibold tracking-tight">Fretes por Estado</h3>
              <button className="text-xs font-medium text-blue-600 hover:underline">Ver tudo</button>
            </div>
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <div className="h-[250px] w-full sm:w-1/2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats?.stateData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {stats?.stateData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full space-y-3 sm:w-1/2">
                {stats?.stateData.map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="text-muted-foreground">{item.name}</span>
                    </div>
                    <span className="font-medium">{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Orders Table Preview */}
        <div className="card-soft overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/60 p-6">
            <h3 className="font-semibold tracking-tight">Últimas Operações</h3>
            <button className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline">
              Ver lista completa <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-6 py-3">ID / NF</th>
                  <th className="px-6 py-3">Origem / Destino</th>
                  <th className="px-6 py-3">Motorista</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {[1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} className="hover:bg-surface-2/50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-foreground">INF-2024-000{i}</div>
                      <div className="text-[11px] text-muted-foreground">NF: 8723{i}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="truncate max-w-[150px]">São Paulo, SP</div>
                      <div className="truncate max-w-[150px] text-[11px] text-muted-foreground">Rio de Janeiro, RJ</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-slate-200" />
                        <span>João Silva</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800">
                        Entregue
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium">
                      R$ 1.250,00
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

function StatCard({ label, value, icon: Icon, color = "text-foreground", trend }: { label: string; value: string | number; icon: any; color?: string; trend?: string }) {
  return (
    <div className="card-soft p-5 transition-transform hover:scale-[1.02]">
      <div className="flex items-start justify-between">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-surface-2">
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        {trend && (
          <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
            {trend}
          </span>
        )}
      </div>
      <div className="mt-4">
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
      </div>
    </div>
  );
}

function SecondaryStatCard({ label, value, icon: Icon, unit }: { label: string; value: string; icon: any; unit?: string }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border/60 bg-white p-5 shadow-sm">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-50 text-slate-400">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="text-lg font-bold tracking-tight">
          {value} <span className="text-sm font-normal text-muted-foreground">{unit}</span>
        </div>
      </div>
    </div>
  );
}
