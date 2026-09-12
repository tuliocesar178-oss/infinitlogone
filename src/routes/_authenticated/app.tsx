import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getUserRolesCached, homeForRole, primaryRole } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({ meta: [{ title: "InfinitLog" }, { name: "robots", content: "noindex" }] }),
  component: RoleRouter,
});

function RoleRouter() {
  const navigate = useNavigate();
  const { user } = Route.useRouteContext();

  useEffect(() => {
    let active = true;

    const routeToProfile = async () => {
      // Check if user is a driver awaiting approval
      const [roles, driverResult] = await Promise.all([
        getUserRolesCached(user.id),
        supabase
        .from("drivers")
        .select("approval_status")
        .eq("user_id", user.id)
        .maybeSingle(),
      ]);

      if (!active) return;
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
  }, [navigate, user.id]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
