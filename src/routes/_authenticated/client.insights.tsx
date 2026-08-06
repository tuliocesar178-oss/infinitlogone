import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { 
  BarChart3, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight, 
  Zap,
  Target,
  BrainCircuit,
  Lightbulb,
  Info
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/client/insights")({
  component: ClientInsights,
});

function ClientInsights() {
  const { data: insights } = useQuery({
    queryKey: ["client-ai-insights"],
    queryFn: async () => {
      return [
        {
          id: 1,
          title: "Aumento de Demanda",
          description: "O volume de embarques aumentou 18% em comparação ao mês anterior. Recomendamos revisar o planejamento de coleta.",
          type: "trend",
          impact: "high",
          icon: TrendingUp,
          color: "text-blue-500",
          bgColor: "bg-blue-50"
        },
        {
          id: 2,
          title: "Otimização de Rota",
          description: "A rota Belo Horizonte → Araxá apresentou o melhor desempenho histórico. Considere priorizar esta rota para cargas urgentes.",
          type: "insight",
          impact: "medium",
          icon: Lightbulb,
          color: "text-amber-500",
          bgColor: "bg-amber-50"
        },
        {
          id: 3,
          title: "Redução de Atrasos",
          description: "Os atrasos foram reduzidos em 22% após a mudança no horário de saída da unidade SP.",
          type: "performance",
          impact: "positive",
          icon: Zap,
          color: "text-emerald-500",
          bgColor: "bg-emerald-50"
        },
        {
          id: 4,
          title: "Destaque de Motorista",
          description: "O motorista João Silva apresentou 100% de pontualidade nas últimas 15 viagens para o seu contrato.",
          type: "driver",
          impact: "low",
          icon: Target,
          color: "text-purple-500",
          bgColor: "bg-purple-50"
        }
      ];
    }
  });

  return (
    <AppShell 
      title="Insights da IA" 
      subtitle="Análise inteligente e recomendações automáticas para sua operação"
    >
      <div className="space-y-6 pb-10">
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-900 text-white mb-8">
          <BrainCircuit className="h-6 w-6 text-blue-400" />
          <div>
            <div className="font-semibold">Inteligência Logística Ativa</div>
            <div className="text-xs text-slate-400">Nossa IA analisa padrões em tempo real para otimizar sua cadeia de suprimentos.</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {insights?.map((item) => (
            <div key={item.id} className="card-soft p-6 flex items-start gap-4">
              <div className={`p-3 rounded-xl ${item.bgColor} ${item.color}`}>
                <item.icon className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-semibold">{item.title}</h4>
                  <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${item.bgColor} ${item.color}`}>
                    {item.impact}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 p-8 border-2 border-dashed border-border rounded-3xl flex flex-col items-center text-center">
          <div className="h-16 w-16 bg-surface-2 rounded-full grid place-items-center mb-4">
            <Info className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Simulações Futuras</h3>
          <p className="text-muted-foreground max-w-md">
            Estamos processando dados para liberar o painel de Previsões e Gêmeo Digital. 
            Em breve você poderá simular cenários e antecipar riscos operacionais.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
