import { HeartPulse } from "lucide-react";

export type HealthLevel = "excelente" | "boa" | "atencao" | "critica";

export function computeHealth(input: {
  activeOrders: number;
  lateOrders: number;
  incidents: number;
  gpsOffline: number;
  driversStopped: number;
}): { score: number; level: HealthLevel } {
  let score = 100;
  score -= input.lateOrders * 8;
  score -= input.incidents * 10;
  score -= input.gpsOffline * 4;
  score -= input.driversStopped * 3;
  score = Math.max(0, Math.min(100, score));
  const level: HealthLevel =
    score >= 90 ? "excelente" : score >= 75 ? "boa" : score >= 55 ? "atencao" : "critica";
  return { score, level };
}

const META: Record<HealthLevel, { label: string; dot: string; text: string; bg: string }> = {
  excelente: { label: "Excelente", dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50" },
  boa: { label: "Boa", dot: "bg-sky-500", text: "text-sky-700", bg: "bg-sky-50" },
  atencao: { label: "Atenção", dot: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50" },
  critica: { label: "Crítica", dot: "bg-rose-500", text: "text-rose-700", bg: "bg-rose-50" },
};

export function HealthIndicator({ score, level }: { score: number; level: HealthLevel }) {
  const m = META[level];
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${m.bg} ${m.text}`}
      title={`Saúde da operação: ${m.label} (${score}/100)`}
    >
      <span className={`h-2 w-2 rounded-full ${m.dot} animate-pulse`} />
      <HeartPulse className="h-3.5 w-3.5" />
      <span>Operação {m.label}</span>
      <span className="text-[10px] font-normal opacity-70">· {score}/100</span>
    </div>
  );
}
