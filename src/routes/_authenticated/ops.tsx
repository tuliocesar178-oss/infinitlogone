import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { MessageSquare, Package, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ops")({
  head: () => ({ meta: [{ title: "Logística — InfinitLog" }, { name: "robots", content: "noindex" }] }),
  component: OpsDashboard,
});

function OpsDashboard() {
  return (
    <AppShell
      title="Central de Logística"
      subtitle="Cadastre pedidos, envie ofertas e acompanhe entregas."
      actions={
        <button className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
          <Plus className="h-4 w-4" /> Novo pedido
        </button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card-soft p-6 lg:col-span-2">
          <header className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Pedidos ativos
            </h2>
          </header>
          <div className="mt-6 grid place-items-center rounded-2xl bg-surface-2 py-16 text-sm text-muted-foreground">
            Nenhum pedido ativo no momento.
          </div>
        </section>
        <section className="card-soft p-6">
          <header className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Conversas
            </h2>
          </header>
          <p className="mt-4 text-sm text-muted-foreground">Sem mensagens.</p>
        </section>
      </div>
    </AppShell>
  );
}
