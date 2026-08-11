import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getUserRolesCached } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/client")({
  ssr: false,
  beforeLoad: async ({ context }) => {
    const user = (context as { user?: { id: string } }).user;
    if (!user) throw redirect({ to: "/auth" });

    const userRoles = await getUserRolesCached(user.id);

    if (!userRoles.includes("client")) {
      throw redirect({ to: "/ops/central" });
    }
  },
  component: () => <Outlet />,
});
