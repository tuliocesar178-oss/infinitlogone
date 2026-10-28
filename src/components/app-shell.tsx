import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  DollarSign,
  FileText,
  Download,
  LayoutGrid,
  LogOut,
  MapPin,
  Package,
  PanelLeft,
  Settings,
  Truck,
  Users,
  Wallet,
  Target,
  Zap,
  HelpCircle,
  UserRound,
  MessageSquare,
  Tv,
} from "lucide-react";

import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { NotificationSettings } from "@/components/notification-settings";

type NavItem = {
  label: string;
  to?: string;
  icon: React.ComponentType<{ className?: string }>;
  match?: (path: string) => boolean;
};

export const NAV_GROUPS: Record<string, { label: string; items: NavItem[] }[]> = {
  admin: [
    {
      label: "Operacional",
      items: [
        { label: "Painéis Operacionais", to: "/painel-operacao", icon: Tv, match: (p) => p.startsWith("/painel-operacao") },
        { label: "Torre de Controle", to: "/ops/central", icon: LayoutGrid, match: (p) => p.startsWith("/ops/central") },
        { label: "Dashboard", to: "/ops", icon: BarChart3, match: (p) => p === "/ops" },
        { label: "Fretes", to: "/ops/pedidos", icon: Package, match: (p) => p.startsWith("/ops/pedidos") },
        { label: "Obras", to: "/ops/obras", icon: Target, match: (p) => p.startsWith("/ops/obras") },
        { label: "Clientes", to: "/ops/clientes", icon: Users, match: (p) => p.startsWith("/ops/clientes") },
        { label: "Motoristas", to: "/ops/motoristas", icon: Truck, match: (p) => p.startsWith("/ops/motoristas") && !p.startsWith("/ops/motoristas/aprovacoes") },
        { label: "Solicitações de cadastro", to: "/ops/motoristas/aprovacoes", icon: Users, match: (p) => p.startsWith("/ops/motoristas/aprovacoes") },
        { label: "Equipe", to: "/ops/equipe", icon: Users, match: (p) => p.startsWith("/ops/equipe") },
        { label: "Veículos", to: "/ops/veiculos", icon: Truck, match: (p) => p.startsWith("/ops/veiculos") },
        { label: "Rastreamento", to: "/ops/rastreamento", icon: MapPin, match: (p) => p.startsWith("/ops/rastreamento") },
        { label: "Ocorrências", to: "/ops/ocorrencias", icon: AlertTriangle, match: (p) => p === "/ops/ocorrencias" },
        { label: "Chat da Operação", to: "/ops/chat", icon: MessageSquare, match: (p) => p.startsWith("/ops/chat") },
      ],
    },
    {
      label: "Gestão",
      items: [
        { label: "Relatórios", to: "/relatorios", icon: BarChart3, match: (p) => p === "/relatorios" },
        { label: "Faturamento", to: "/ops/faturamento", icon: DollarSign, match: (p) => p.startsWith("/ops/faturamento") },
        { label: "Financeiro", to: "/ops/financeiro", icon: Wallet, match: (p) => p.startsWith("/ops/financeiro") },
        { label: "Configurações", to: "/ops/central", icon: Settings, match: (p) => p === "/ops/configuracoes" },
        { label: "Personalização do Site", to: "/admin", icon: Settings, match: (p) => p === "/admin" },
      ],
    },
  ],
  logistics: [
    {
      label: "Operacional",
      items: [
        { label: "Painéis Operacionais", to: "/painel-operacao", icon: Tv, match: (p) => p.startsWith("/painel-operacao") },
        { label: "Torre de Controle", to: "/ops/central", icon: LayoutGrid, match: (p) => p.startsWith("/ops/central") },
        { label: "Dashboard", to: "/ops", icon: BarChart3, match: (p) => p === "/ops" },
        { label: "Fretes", to: "/ops/pedidos", icon: Package, match: (p) => p.startsWith("/ops/pedidos") },
        { label: "Obras", to: "/ops/obras", icon: Target, match: (p) => p.startsWith("/ops/obras") },
        { label: "Clientes", to: "/ops/clientes", icon: Users, match: (p) => p.startsWith("/ops/clientes") },
        { label: "Motoristas", to: "/ops/motoristas", icon: Truck, match: (p) => p.startsWith("/ops/motoristas") },
        { label: "Veículos", to: "/ops/veiculos", icon: Truck, match: (p) => p.startsWith("/ops/veiculos") },
        { label: "Rastreamento", to: "/ops/rastreamento", icon: MapPin, match: (p) => p.startsWith("/ops/rastreamento") },
        { label: "Ocorrências", to: "/ops/ocorrencias", icon: AlertTriangle, match: (p) => p === "/ops/ocorrencias" },
        { label: "Chat da Operação", to: "/ops/chat", icon: MessageSquare, match: (p) => p.startsWith("/ops/chat") },
      ],
    },
  ],
  financeiro: [
    {
      label: "Financeiro",
      items: [
        { label: "Torre de Controle", to: "/ops/central", icon: LayoutGrid, match: (p) => p.startsWith("/ops/central") },
        { label: "Financeiro", to: "/ops/financeiro", icon: Wallet, match: (p) => p.startsWith("/ops/financeiro") },
        { label: "Faturamento", to: "/ops/faturamento", icon: DollarSign, match: (p) => p.startsWith("/ops/faturamento") },
        { label: "Fretes", to: "/ops/pedidos", icon: Package, match: (p) => p.startsWith("/ops/pedidos") },
        { label: "Motoristas", to: "/ops/motoristas", icon: Truck, match: (p) => p.startsWith("/ops/motoristas") },
        { label: "Chat da Operação", to: "/ops/chat", icon: MessageSquare, match: (p) => p.startsWith("/ops/chat") },
      ],
    },
  ],
  client: [
    {
      label: "Portal do Cliente",
      items: [
        { label: "Rastreamento", to: "/client", icon: MapPin, match: (p) => p === "/client" || p === "/client/" },
        { label: "Histórico de Fretes", to: "/client/fretes", icon: Package, match: (p) => p.startsWith("/client/fretes") },
        { label: "Documentos", to: "/client/documentos", icon: FileText, match: (p) => p.startsWith("/client/documentos") },
        { label: "Relatórios", to: "/relatorios", icon: BarChart3, match: (p) => p === "/relatorios" },
        { label: "Financeiro", to: "/client/financeiro", icon: DollarSign, match: (p) => p === "/client/financeiro" },
        { label: "Perfil", to: "/client/perfil", icon: UserRound, match: (p) => p === "/client/perfil" },
      ],
    },
  ],
};


export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: me } = useQuery({
    queryKey: ["me-shell"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      return {
        email: user.email ?? "",
        name: profile?.full_name ?? user.email?.split("@")[0] ?? "Usuário",
        role: (roles?.[0]?.role as any) ?? "user",
      };
    },
  });

  useEffect(() => {
    setMobileOpen(false);
  }, [path]);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const roleLabel: Record<string, string> = {
    admin: "Administrador",
    logistics: "Logística",
    driver: "Motorista",
    client: "Cliente",
    user: "Usuário",
  };


  const initials = (me?.name ?? "?")
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-surface-2 text-foreground">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-200 ${
          collapsed ? "w-[76px]" : "w-64"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
      >
        <div className={`flex items-center justify-center border-b border-sidebar-border/60 px-3 ${collapsed ? "h-16" : "h-24"}`}>
          <Link to="/" aria-label="INFINITLOG VAPT VUPT" className="flex w-full justify-center">
            <Logo size={collapsed ? 60 : 180} withWordmark />
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {(NAV_GROUPS[me?.role || "user"] || NAV_GROUPS.admin).map((group) => (
            <div key={group.label} className="mb-6">
              {!collapsed && (
                <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-sidebar-foreground/40">
                  {group.label}
                </div>
              )}
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const active = item.match ? item.match(path) : false;
                  const Icon = item.icon;
                  const inner = (
                    <span
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/75 hover:bg-white/5 hover:text-sidebar-foreground"
                      } ${collapsed ? "justify-center" : ""}`}
                    >
                      <Icon className="h-[18px] w-[18px] shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </span>
                  );
                  return (
                    <li key={item.label}>
                      {item.to ? (
                        <Link to={item.to}>{inner}</Link>
                      ) : (
                        <button
                          type="button"
                          className="w-full text-left opacity-60"
                          title="Em breve"
                        >
                          {inner}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-sidebar-border/60 p-3">
          <button
            onClick={signOut}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/75 hover:bg-white/5 hover:text-sidebar-foreground ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <LogOut className="h-[18px] w-[18px]" />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main */}
      <div className={`${collapsed ? "lg:pl-[76px]" : "lg:pl-64"} transition-all duration-200`}>
        <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur">
          <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMobileOpen(true)}
                className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-accent lg:hidden"
                aria-label="Abrir menu"
              >
                <PanelLeft className="h-5 w-5" />
              </button>
              <button
                onClick={() => setCollapsed((v) => !v)}
                className="hidden h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-accent lg:grid"
                aria-label="Alternar menu"
              >
                <PanelLeft className="h-5 w-5" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <NotificationSettingsDialog />
              <div className="flex items-center gap-3 rounded-full py-1 pl-1 pr-3 hover:bg-accent">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-brand text-[13px] font-semibold text-brand-foreground">
                  {initials || "?"}
                </span>
                <div className="hidden text-left leading-tight sm:block">
                  <div className="max-w-[140px] truncate text-sm font-semibold">
                    {me?.name ?? "—"}
                  </div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {roleLabel[me?.role ?? "user"]}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="px-4 py-8 sm:px-8 sm:py-10">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
              )}
            </div>
            {actions && <div className="shrink-0">{actions}</div>}
          </div>
          <div className="mt-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

function NotificationSettingsDialog() {
  const [open, setOpen] = useState(false);
  return <>
    <Button variant="ghost" size="icon" aria-label="Notificações no celular" onClick={() => setOpen(true)}><Bell className="h-5 w-5" /></Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogTitle>Preferências do dispositivo</DialogTitle><NotificationSettings /></DialogContent></Dialog>
  </>;
}
