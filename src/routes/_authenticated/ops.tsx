import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getUserRolesCached, isStaffRole } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/ops")({
  beforeLoad: async ({ context }) => {
    const user = (context as { user?: { id: string } }).user;
    if (!user) throw redirect({ to: "/auth" });

    const userRoles = await getUserRolesCached(user.id);

    if (!userRoles.includes("admin") && !userRoles.includes("logistics")) {
      const target = userRoles.includes("driver") ? "/driver" : "/client";
      throw redirect({ to: target });
    }
  },
  component: () => <Outlet />,
});
