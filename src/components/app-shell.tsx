import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Logo } from "@/components/logo";

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

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-6">
          <Link to="/" aria-label="InfinitLog">
            <Logo size={32} />
          </Link>
          <button
            onClick={signOut}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm hover:bg-accent"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
            {subtitle && (
              <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
        <div className="mt-10">{children}</div>
      </main>
    </div>
  );
}
