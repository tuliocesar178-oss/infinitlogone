import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/client")({
  ssr: false,
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });

    const { data: roles, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    
    const userRoles = roles?.map(r => r.role) || [];
    console.log("Checking client access for user:", user.id, "Roles:", userRoles);

    if (!userRoles.includes("client")) {
      console.warn("User does not have client role. Redirecting to ops...");
      throw redirect({ to: "/ops/central" });
    }
  },
  component: ClientLayout,
});

function ClientLayout() {
  return (
    <Outlet />
  );
}

