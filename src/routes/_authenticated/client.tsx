import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/client")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    
    const userRoles = roles?.map(r => r.role) || [];

    if (!userRoles.includes("client")) {
      throw redirect({ to: "/ops/central" });
    }

    // Se o cliente tentar acessar o /client raiz, redireciona para a tela de rastreamento (index do portal)
    // que agora será a nossa tela principal de rastreio.
    if (location.pathname === "/client" || location.pathname === "/client/") {
      // Deixamos o fluxo seguir pois o client.index.tsx será a nossa nova tela de rastreamento principal.
    }
  },
  component: () => <Outlet />,
});

import { Outlet } from "@tanstack/react-router";
