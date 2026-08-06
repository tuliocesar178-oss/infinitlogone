import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { DriverShell } from "@/components/driver/shell";

export const Route = createFileRoute("/_authenticated/driver")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    
    const userRoles = roles?.map(r => r.role) || [];

    if (!userRoles.includes("driver")) {
      const target = userRoles.includes("client") ? "/client" : "/ops/central";
      throw redirect({ to: target });
    }
  },
  head: () => ({ meta: [{ title: "Motorista — InfinitLog" }, { name: "robots", content: "noindex" }] }),
  component: DriverLayout,
});

function DriverLayout() {
  return (
    <DriverShell>
      <Outlet />
    </DriverShell>
  );
}
