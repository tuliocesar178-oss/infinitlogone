import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { requireRoles } from "@/lib/roles";
import { DriverShell } from "@/components/driver/shell";

export const Route = createFileRoute("/_authenticated/driver")({
  beforeLoad: async ({ context }) => {
    const user = (context as { user?: { id: string } }).user;
    if (!user) throw redirect({ to: "/auth" });

    const userRoles = await requireRoles(user.id);

    if (!userRoles.includes("driver")) {
      // Sem nenhum papel carregado, manda para o roteador de perfil em vez de
      // outra área protegida — evita ciclo de redirecionamentos.
      if (userRoles.length === 0) throw redirect({ to: "/app" });
      const target = userRoles.includes("client") ? "/client" : "/ops/central";
      throw redirect({ to: target });
    }
  },
  head: () => ({ meta: [{ title: "Motorista — InfinitLog" }, { name: "robots", content: "noindex" }] }),
  component: DriverLayout,
});

function DriverLayout() {
  return (
    <DriverShell>
      <Outlet />
    </DriverShell>
  );
}
