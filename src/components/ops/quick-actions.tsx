import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Package,
  Plus,
  Truck,
  UserPlus,
  Users,
} from "lucide-react";
import type { ComponentType } from "react";

type Action = { label: string; to?: string; icon: ComponentType<{ className?: string }>; tint: string };

const ACTIONS: Action[] = [
  { label: "Nova Entrega", to: "/ops/pedidos/novo", icon: Plus, tint: "bg-brand text-brand-foreground" },
  { label: "Nova Coleta", to: "/ops/pedidos/novo", icon: Package, tint: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200" },
  { label: "Cadastrar Motorista", to: "/ops/motoristas", icon: UserPlus, tint: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200" },
  { label: "Cadastrar Cliente", to: "/ops/equipe", icon: Users, tint: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200" },
  { label: "Cadastrar Veículo", to: "/ops/veiculos/novo", icon: Truck, tint: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200" },
  { label: "Nova Ocorrência", icon: AlertTriangle, tint: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200" },
];

export function QuickActions() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {ACTIONS.map((a) => {
        const Icon = a.icon;
        const inner = (
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition hover:opacity-90 ${a.tint}`}>
            <Icon className="h-3.5 w-3.5" />
            {a.label}
          </span>
        );
        return a.to ? (
          <Link key={a.label} to={a.to}>
            {inner}
          </Link>
        ) : (
          <button key={a.label} type="button" title="Em breve" className="opacity-70">
            {inner}
          </button>
        );
      })}
    </div>
  );
}
