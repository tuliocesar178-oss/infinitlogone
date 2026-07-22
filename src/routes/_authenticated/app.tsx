import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchUserRoles, homeForRole, primaryRole } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({ meta: [{ title: "InfinitLog" }, { name: "robots", content: "noindex" }] }),
  component: RoleRouter,
});

function RoleRouter() {
  const navigate = useNavigate();
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        navigate({ to: "/auth" });
        return;
      }
      const roles = await fetchUserRoles(data.user.id);
      const target = homeForRole(primaryRole(roles));
      navigate({ to: target, replace: true });
    })();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
