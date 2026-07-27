import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/logo";
import { applyTheme, readTheme } from "@/lib/driver-prefs";
import {
  Bell,
  CircleDollarSign,
  Home,
  LogOut,
  Package,
  UserRound,
  Wallet,
} from "lucide-react";

type Tab = { to: string; label: string; icon: React.ComponentType<{ className?: string }>; exact?: boolean };
const TABS: Tab[] = [
  { to: "/driver", label: "Início", icon: Home, exact: true },
  { to: "/driver/ofertas", label: "Ofertas", icon: Package },
  { to: "/driver/fretes", label: "Rotas", icon: Wallet },
  { to: "/driver/faturamento", label: "Ganhos", icon: CircleDollarSign },
  { to: "/driver/perfil", label: "Perfil", icon: UserRound },
];

export function DriverShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [pendingOffers, setPendingOffers] = useState(0);

  useEffect(() => {
    applyTheme(readTheme());
    const onChange = () => applyTheme(readTheme());
    window.addEventListener("driver-theme-changed", onChange);
    return () => window.removeEventListener("driver-theme-changed", onChange);
  }, []);

  const { data: me } = useQuery({
    queryKey: ["driver-me"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return null;
      const [{ data: profile }, { data: driver }] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, avatar_url")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("drivers")
          .select("photo_url, availability, rating")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      return {
        id: user.id,
        email: user.email ?? "",
        name: profile?.full_name ?? user.email?.split("@")[0] ?? "Motorista",
        avatar: driver?.photo_url ?? profile?.avatar_url ?? null,
        availability: driver?.availability ?? "offline",
        rating: driver?.rating ?? null,
      };
    },
  });

  useEffect(() => {
    if (!me?.id) return;
    async function loadCount() {
      const { count } = await supabase
        .from("freight_offers")
        .select("id", { count: "exact", head: true })
        .eq("driver_id", me!.id)
        .eq("status", "pending");
      setPendingOffers(count ?? 0);
    }
    loadCount();
    const ch = supabase
      .channel(`driver-shell-${me.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "freight_offers", filter: `driver_id=eq.${me.id}` },
        loadCount,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [me?.id]);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const initials = (me?.name ?? "?")
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const availabilityLabel: Record<string, string> = {
    available: "Disponível",
    disponivel: "Disponível",
    em_frete: "Em frete",
    folga: "Em folga",
    ferias: "Férias",
    bloqueado: "Bloqueado",
    offline: "Offline",
  };
  const availabilityDot: Record<string, string> = {
    available: "bg-emerald-500",
    disponivel: "bg-emerald-500",
    em_frete: "bg-brand",
    folga: "bg-amber-500",
    ferias: "bg-amber-500",
    bloqueado: "bg-red-500",
    offline: "bg-muted-foreground/60",
  };

  return (
    <div className="min-h-screen bg-surface-2 text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between gap-3 px-4">
          <Link to="/driver" className="flex items-center gap-2">
            <Logo size={28} withWordmark={false} />
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight">InfinitLog</div>
              <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                <span className={`h-1.5 w-1.5 rounded-full ${availabilityDot[(me?.availability as any) ?? "offline"]}`} />
                {availabilityLabel[(me?.availability as any) ?? "offline"]}
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-1">
            <button
              className="relative grid h-10 w-10 place-items-center rounded-full text-muted-foreground hover:bg-accent"
              aria-label="Notificações"
              onClick={() => navigate({ to: "/driver/perfil" })}
            >
              <Bell className="h-5 w-5" />
              {pendingOffers > 0 && (
                <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-brand-foreground">
                  {pendingOffers}
                </span>
              )}
            </button>
            <button
              onClick={signOut}
              className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground hover:bg-accent"
              aria-label="Sair"
            >
              <LogOut className="h-5 w-5" />
            </button>
            <Link
              to="/driver/perfil"
              className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-brand text-[13px] font-semibold text-brand-foreground"
            >
              {me?.avatar ? (
                <img src={me.avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <span>{initials || "?"}</span>
              )}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-28 pt-6">
        {(title || actions) && (
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              {title && (
                <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
              )}
              {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
            </div>
            {actions && <div className="shrink-0">{actions}</div>}
          </div>
        )}
        {children}
      </main>

      {/* Bottom tab bar — Uber Driver style */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-stretch justify-between">
          {TABS.map((t) => {
            const active = t.exact ? path === t.to : path.startsWith(t.to);
            const Icon = t.icon;
            const showBadge = t.to === "/driver/ofertas" && pendingOffers > 0;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition ${
                  active ? "text-brand" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="relative">
                  <Icon className="h-5 w-5" />
                  {showBadge && (
                    <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-brand-foreground">
                      {pendingOffers}
                    </span>
                  )}
                </span>
                {t.label}
                {active && <span className="absolute inset-x-6 bottom-0 h-0.5 rounded-t-full bg-brand" />}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
