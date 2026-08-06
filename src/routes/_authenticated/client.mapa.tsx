import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Search, 
  MapPin, 
  Truck, 
  Maximize2, 
  Navigation, 
  Clock, 
  ShieldCheck,
  Zap,
  Layers,
  Info
} from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/client/mapa")({
  component: ClientMap,
});

function ClientMap() {
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);

  const { data: activeVehicles } = useQuery({
    queryKey: ["client-active-vehicles"],
    queryFn: async () => {
      // For now, mock data. In production, this would query orders 
      // where status is en_route and join with drivers/tracking points.
      return [
        { id: 1, driver: "João Silva", plate: "ABC-1234", status: "in_transit", lat: -23.5505, lng: -46.6333, speed: "85 km/h", eta: "14:20", remaining: "42 km" },
        { id: 2, driver: "Maria Souza", plate: "DEF-5678", status: "near_destination", lat: -22.9068, lng: -43.1729, speed: "22 km/h", eta: "13:15", remaining: "3.5 km" },
      ];
    }
  });

  return (
    <AppShell 
      title="Mapa Executivo" 
      subtitle="Monitoramento em tempo real de suas entregas e frota ativa"
    >
      <div className="flex flex-col lg:flex-row h-[70vh] gap-6 pb-10">
        {/* Map Container */}
        <div className="flex-1 card-soft overflow-hidden relative border-none">
          <div className="absolute inset-0 bg-slate-100 flex items-center justify-center">
            <div className="text-center">
              <MapPin className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-20" />
              <p className="text-sm text-muted-foreground">O mapa interativo Mapbox será carregado aqui...</p>
            </div>
          </div>
          
          {/* Map UI Overlays */}
          <div className="absolute top-4 left-4 flex flex-col gap-2">
            <button className="h-10 w-10 bg-white shadow-lg rounded-xl flex items-center justify-center hover:bg-slate-50">
              <Layers className="h-5 w-5 text-slate-600" />
            </button>
            <button className="h-10 w-10 bg-white shadow-lg rounded-xl flex items-center justify-center hover:bg-slate-50">
              <Maximize2 className="h-5 w-5 text-slate-600" />
            </button>
          </div>

          <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-white/90 backdrop-blur p-2 rounded-xl shadow-lg border border-white/20">
            <div className="flex items-center gap-2 px-2 border-r border-border/60">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-700">Live</span>
            </div>
            <span className="text-[10px] font-medium text-slate-500 px-1">2 Veículos ativos</span>
          </div>
        </div>

        {/* Sidebar Panel */}
        <div className="w-full lg:w-80 flex flex-col gap-4">
          <div className="card-soft p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input 
                placeholder="Buscar veículo ou placa..."
                className="w-full rounded-lg border border-border bg-slate-50 py-2 pl-9 pr-3 text-xs outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3">
            {activeVehicles?.map((v) => (
              <div 
                key={v.id} 
                className={`card-soft p-4 cursor-pointer transition-all hover:border-primary/40 ${selectedVehicle?.id === v.id ? 'border-primary ring-1 ring-primary/20' : ''}`}
                onClick={() => setSelectedVehicle(v)}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-slate-200 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{v.driver}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{v.plate}</div>
                  </div>
                  <div className={`h-2 w-2 rounded-full ${v.status === 'near_destination' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                </div>
                
                <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border/40 pt-4">
                  <div>
                    <div className="text-[9px] text-muted-foreground uppercase tracking-widest">Velocidade</div>
                    <div className="text-xs font-bold text-slate-700">{v.speed}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-muted-foreground uppercase tracking-widest">ETA</div>
                    <div className="text-xs font-bold text-slate-700">{v.eta}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="card-soft p-4 bg-primary text-primary-foreground border-none">
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5" />
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">Insight IA</div>
                <div className="text-[11px] leading-tight font-medium">92% de chance de manter o prazo na entrega DEF-5678.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
