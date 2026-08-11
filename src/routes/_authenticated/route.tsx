import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { getUserRolesCached, homeForRole, primaryRole } from "@/lib/roles";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // getSession() lê o token local (instantâneo). Só chamamos a rede se não houver sessão.
    const { data: s } = await supabase.auth.getSession();
    if (s.session?.user) return { user: s.session.user };
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();
  const path = useRouterState({ select: (s) => s.location.pathname });
  
  const { data: role } = useQuery({
    queryKey: ["user-primary-role", user.id],
    queryFn: async () => {
      const roles = await getUserRolesCached(user.id);
      return primaryRole(roles);
    },
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!role) return;

    // Redireciona se o usuário tentar acessar a raiz /app ou se estiver em um local não permitido para o seu papel
    if (path === "/app") {
      window.location.href = homeForRole(role);
      return;
    }

    // Proteção básica de rotas por prefixo
    const isAdminPath = path.startsWith("/ops") || path.startsWith("/admin");
    const isClientPath = path.startsWith("/client");
    const isDriverPath = path.startsWith("/driver");

    if (role === "client" && (isAdminPath || isDriverPath)) {
      window.location.href = "/client";
    } else if (role === "driver" && (isAdminPath || isClientPath)) {
      window.location.href = "/driver";
    }
  }, [role, path]);

  return <Outlet />;
}
