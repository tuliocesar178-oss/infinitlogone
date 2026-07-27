import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  MapPin,
  Navigation,
  Package,
  Send,
  Truck,
  Zap,
} from "lucide-react";
import { DASHBOARD_CARDS, type DashboardCardKey } from "@/lib/order-status";

const ICONS: Record<DashboardCardKey, React.ComponentType<{ className?: string }>> = {
  planning: Package,
  preparing: Package,
  awaiting_driver: Clock,
  offer_sent: Send,
  negotiation: MessageSquare,
  en_route_pickup: Navigation,
  at_pickup: Truck,
  in_transit: Zap,
  near_destination: MapPin,
  delivered_today: CheckCircle2,
  incident: AlertTriangle,
};

const TINT_CLASSES: Record<string, { bg: string; fg: string }> = {
  slate: { bg: "bg-slate-100", fg: "text-slate-600" },
  sky: { bg: "bg-sky-100", fg: "text-sky-600" },
  amber: { bg: "bg-amber-100", fg: "text-amber-700" },
  violet: { bg: "bg-violet-100", fg: "text-violet-600" },
  blue: { bg: "bg-blue-100", fg: "text-blue-600" },
  indigo: { bg: "bg-indigo-100", fg: "text-indigo-600" },
  cyan: { bg: "bg-cyan-100", fg: "text-cyan-600" },
  teal: { bg: "bg-teal-100", fg: "text-teal-600" },
  emerald: { bg: "bg-emerald-100", fg: "text-emerald-600" },
  red: { bg: "bg-red-100", fg: "text-red-600" },
};
const DEFAULT_TINT = { bg: "bg-muted", fg: "text-muted-foreground" };

export function StatusCards({ counts }: { counts: Record<DashboardCardKey, number> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
      {DASHBOARD_CARDS.map((card) => {
        const Icon = ICONS[card.key];
        const tint = TINT_CLASSES[card.tint] ?? DEFAULT_TINT;
        const value = counts[card.key] ?? 0;
        return (
          <Link
            key={card.key}
            to="/ops/pedidos"
            search={{ card: card.key }}
            className="card-soft group flex items-center gap-4 p-5 transition hover:shadow-md hover:-translate-y-0.5"
          >
            <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${tint.bg} ${tint.fg}`}>
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                {card.short}
              </div>
              <div className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">{value}</div>
            </div>
            <span className="text-xs text-muted-foreground opacity-0 transition group-hover:opacity-100">
              Ver →
            </span>
          </Link>
        );
      })}
    </div>
  );
}
