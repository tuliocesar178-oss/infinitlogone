import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { areaGateTarget, requireRoles } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/client")({
  head: () => ({ meta: [{ title: 'client — INFINITLOG' }, { name: "description", content: 'client — INFINITLOG. Informações e acompanhamento na plataforma INFINITLOG VAPT VUPT.' }, { property: "og:title", content: 'client — INFINITLOG' }, { property: "og:description", content: 'client — INFINITLOG. Informações e acompanhamento na plataforma INFINITLOG VAPT VUPT.' }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" } ] }),
  ssr: false,
  beforeLoad: async ({ context }) => {
    const user = (context as { user?: { id: string } }).user;
    if (!user) throw redirect({ to: "/auth" });

    const target = areaGateTarget(await requireRoles(user.id), "client");
    if (target) throw redirect({ to: target });
  },
  component: () => <Outlet />,
});
