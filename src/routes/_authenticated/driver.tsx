import { createFileRoute, Outlet } from "@tanstack/react-router";
import { DriverShell } from "@/components/driver/shell";

export const Route = createFileRoute("/_authenticated/driver")({
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
