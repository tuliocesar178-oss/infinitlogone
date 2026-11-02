import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { areaGateTarget, requireRoles } from "@/lib/roles";
import { DriverShell } from "@/components/driver/shell";

export const Route = createFileRoute("/_authenticated/driver")({
  beforeLoad: async ({ context }) => {
    const user = (context as { user?: { id: string } }).user;
    if (!user) throw redirect({ to: "/auth" });

    const target = areaGateTarget(await requireRoles(user.id), "driver");
    if (target) throw redirect({ to: target });
  },
  head: () => ({ meta: [
      { name: "description", content: 'Motorista — InfinitLog. Informações e acompanhamento na plataforma INFINITLOG VAPT VUPT.' },
      { property: "og:title", content: 'Motorista — InfinitLog' },
      { property: "og:description", content: 'Motorista — InfinitLog. Informações e acompanhamento na plataforma INFINITLOG VAPT VUPT.' },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },{ title: "Motorista — InfinitLog" }, { name: "robots", content: "noindex" }] }),
  component: DriverLayout,
});

function DriverLayout() {
  return (
    <DriverShell>
      <Outlet />
    </DriverShell>
  );
}
