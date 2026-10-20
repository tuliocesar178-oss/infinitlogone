import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { isStaffRole, requireRoles } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/ops")({
  beforeLoad: async ({ context }) => {
    const user = (context as { user?: { id: string } }).user;
    if (!user) throw redirect({ to: "/auth" });

    const userRoles = await requireRoles(user.id);

    if (!userRoles.some(isStaffRole)) {
      if (userRoles.length === 0) throw redirect({ to: "/app" });
      const target = userRoles.includes("driver") ? "/driver" : "/client";
      throw redirect({ to: target });
    }
  },
  component: () => <Outlet />,
});
