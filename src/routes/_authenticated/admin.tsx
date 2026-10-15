import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Activity, DollarSign, MapPin, Package, TruckIcon, Users } from "lucide-react";


export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Administração — InfinitLog" }, { name: "description", content: "Administração e personalização da página inicial da InfinitLog." }, { property: "og:title", content: "Administração — InfinitLog" }, { property: "og:description", content: "Configurações administrativas da InfinitLog Transportes." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: AdminDashboard,
});

function AdminDashboard() {
  return (
    <AppShell title="Painel do Administrador" subtitle="Visão completa da operação em tempo real.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={<Package />} label="Pedidos hoje" value="0" />
        <Kpi icon={<TruckIcon />} label="Motoristas online" value="0" />
        <Kpi icon={<Activity />} label="Em viagem" value="0" />
        <Kpi icon={<DollarSign />} label="Receita" value="R$ 0" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Panel title="Mapa em tempo real" icon={<MapPin className="h-4 w-4" />} className="lg:col-span-2">
          <div className="grid h-72 place-items-center rounded-2xl bg-surface-2 text-sm text-muted-foreground">
            Mapa Mapbox disponível na próxima fase.
          </div>
        </Panel>
        <Panel title="Últimas atividades" icon={<Activity className="h-4 w-4" />}>
          <p className="text-sm text-muted-foreground">Nenhuma atividade ainda.</p>
        </Panel>
      </div>

      <div className="mt-8">
        
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <Panel title="Cadastros" icon={<Users className="h-4 w-4" />}>
          <ul className="space-y-2 text-sm">
            {["Equipe", "Motoristas", "Clientes", "Veículos", "Pedidos"].map((i) => (
              <li key={i} className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3">
                <span>{i}</span>
                <span className="text-xs text-muted-foreground">em breve</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Financeiro" icon={<DollarSign className="h-4 w-4" />}>
          <p className="text-sm text-muted-foreground">
            Dashboard financeiro com receita, despesas e lucro será liberado em breve.
          </p>
        </Panel>
      </div>
    </AppShell>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="card-soft p-6">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-surface-2 text-muted-foreground">
        {icon}
      </div>
      <div className="mt-4 text-3xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

function Panel({
  title,
  icon,
  children,
  className = "",
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`card-soft p-6 ${className}`}>
      <header className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-surface-2 text-muted-foreground">
          {icon}
        </span>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          {title}
        </h2>
      </header>
      <div className="mt-4">{children}</div>
    </section>
  );
}
