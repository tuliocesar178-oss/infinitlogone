import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getUserRolesCached,
  homeForRole,
  primaryRole,
  SessionExpiredError,
  type AppRole,
} from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({ meta: [
      { name: "description", content: 'InfinitLog. Informações e acompanhamento na plataforma INFINITLOG VAPT VUPT.' },
      { property: "og:title", content: 'InfinitLog' },
      { property: "og:description", content: 'InfinitLog. Informações e acompanhamento na plataforma INFINITLOG VAPT VUPT.' },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },{ title: "InfinitLog" }, { name: "robots", content: "noindex" }] }),
  component: RoleRouter,
});

function RoleRouter() {
  const navigate = useNavigate();
  const { user } = Route.useRouteContext();
  const [problem, setProblem] = useState<"error" | "no-role" | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;

    const routeToProfile = async () => {
      let roles: AppRole[];
      let driverResult: { data: { approval_status: string } | null };
      try {
        [roles, driverResult] = await Promise.all([
          getUserRolesCached(user.id),
          supabase
            .from("drivers")
            .select("approval_status")
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);
      } catch (e) {
        if (!active) return;
        // Sessão recusada e não renovável: volta para o login.
        if (e instanceof SessionExpiredError) {
          navigate({ to: "/auth", replace: true });
          return;
        }
        setProblem("error");
        return;
      }

      if (!active) return;
      // Conta sem nenhum papel: não navegar para área protegida (ciclo de redirects).
      if (roles.length === 0) {
        setProblem("no-role");
        return;
      }
      const driver = driverResult.data;
      if (roles.includes("driver") && driver && driver.approval_status !== "active") {
        navigate({ to: "/aguardando-aprovacao", replace: true });
        return;
      }
      const target = homeForRole(primaryRole(roles));
      navigate({ to: target, replace: true });
    };

    void routeToProfile();
    return () => {
      active = false;
    };
  }, [navigate, user.id, attempt]);

  if (problem) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <h1 className="text-lg font-semibold">
            {problem === "no-role" ? "Conta sem perfil de acesso" : "Não foi possível carregar seu perfil"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {problem === "no-role"
              ? "Sua conta ainda não tem um perfil liberado. Fale com a equipe InfinitLog ou entre com outra conta."
              : "Verifique sua conexão com a internet e tente novamente."}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {problem === "error" && (
              <button
                onClick={() => {
                  setProblem(null);
                  setAttempt((a) => a + 1);
                }}
                className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Tentar novamente
              </button>
            )}
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/auth", replace: true });
              }}
              className="inline-flex items-center justify-center rounded-full border border-input bg-background px-5 py-2.5 text-sm font-medium hover:bg-accent"
            >
              Sair
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
