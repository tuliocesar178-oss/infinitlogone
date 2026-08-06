import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/ops")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    
    const userRoles = roles?.map(r => r.role) || [];

    if (!userRoles.includes("admin") && !userRoles.includes("logistics")) {
      const target = userRoles.includes("driver") ? "/driver" : "/client";
      throw redirect({ to: target });
    }
  },
  component: () => <Outlet />,
});
