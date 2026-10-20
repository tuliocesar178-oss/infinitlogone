import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { requireRoles } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/client")({
  ssr: false,
  beforeLoad: async ({ context }) => {
    const user = (context as { user?: { id: string } }).user;
    if (!user) throw redirect({ to: "/auth" });

    const userRoles = await requireRoles(user.id);

    if (!userRoles.includes("client")) {
      if (userRoles.length === 0) throw redirect({ to: "/app" });
      throw redirect({ to: "/ops/central" });
    }
  },
  component: () => <Outlet />,
});
