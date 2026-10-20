import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { areaGateTarget, requireRoles } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/client")({
  ssr: false,
  beforeLoad: async ({ context }) => {
    const user = (context as { user?: { id: string } }).user;
    if (!user) throw redirect({ to: "/auth" });

    const target = areaGateTarget(await requireRoles(user.id), "client");
    if (target) throw redirect({ to: target });
  },
  component: () => <Outlet />,
});
