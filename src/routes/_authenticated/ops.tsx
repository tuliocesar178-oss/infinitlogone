import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { areaGateTarget, requireRoles } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/ops")({
  head: () => ({ meta: [{ title: 'ops — INFINITLOG' }, { name: "description", content: 'ops — INFINITLOG. Informações e acompanhamento na plataforma INFINITLOG VAPT VUPT.' }, { property: "og:title", content: 'ops — INFINITLOG' }, { property: "og:description", content: 'ops — INFINITLOG. Informações e acompanhamento na plataforma INFINITLOG VAPT VUPT.' }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" } ] }),
  beforeLoad: async ({ context }) => {
    const user = (context as { user?: { id: string } }).user;
    if (!user) throw redirect({ to: "/auth" });

    const target = areaGateTarget(await requireRoles(user.id), "ops");
    if (target) throw redirect({ to: target });
  },
  component: () => <Outlet />,
});
