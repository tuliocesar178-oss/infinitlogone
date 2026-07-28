import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowRight, MapPin, Phone, Search, ShieldCheck, Zap } from "lucide-react";
import { Logo, logoUrl } from "@/components/logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "InfinitLog Transportes — Gestão logística sob controle" },
      {
        name: "description",
        content:
          "Transportadora especializada em cargas com rastreamento em tempo real, comprovantes digitais e atendimento direto pela nossa equipe.",
      },
      { property: "og:title", content: "InfinitLog Transportes" },
      {
        property: "og:description",
        content: "Fale com a nossa equipe, feche seu frete e acompanhe sua carga em tempo real.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");

  function onTrack(e: FormEvent) {
    e.preventDefault();
    const value = code.trim();
    if (!value) return;
    navigate({ 
      to: "/rastreio/$code", 
      params: { code: value.toUpperCase() } 
    });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/" aria-label="InfinitLog — início">
            <Logo size={34} />
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground sm:flex">
            <a href="#servicos" className="hover:text-foreground">Serviços</a>
            <a href="#quem-somos" className="hover:text-foreground">Quem somos</a>
            <a href="#contato" className="hover:text-foreground">Contato</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              to="/rastreio"
              className="hidden rounded-full border border-border bg-background px-4 py-2 text-sm hover:bg-accent sm:inline-flex"
            >
              Rastrear
            </Link>
            <Link
              to="/auth"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Acesso Restrito <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 pt-16 pb-24 sm:pt-24">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground">
            <Zap className="h-3 w-3" /> Tecnologia & Operação Logística
          </span>
          <h1 className="mt-6 text-5xl font-semibold tracking-tight sm:text-6xl">
            Sua carga em movimento.
            <span className="block text-muted-foreground">Visibilidade total.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Acompanhe suas operações em tempo real com o novo Portal do Cliente Corporativo.
            KPIs, mapas, documentos e rastreamento avançado em uma única plataforma.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Portal do Cliente <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/rastreio"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-6 py-3 text-sm font-semibold hover:bg-accent"
            >
              <Search className="h-4 w-4" /> Rastreio Rápido
            </Link>
          </div>
        </div>

        <form
          onSubmit={onTrack}
          className="card-soft mt-10 flex flex-col gap-3 p-3 sm:flex-row sm:items-center"
        >
          <div className="flex flex-1 items-center gap-3 rounded-2xl bg-surface-2 px-5 py-4">
            <Search className="h-5 w-5 text-muted-foreground" />
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Digite seu código de rastreio..."
              className="w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
              aria-label="Código de rastreio"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-7 py-4 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Rastrear <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <div id="servicos" className="mt-20 grid gap-6 sm:grid-cols-3">
          <FeatureCard
            icon={<BarChart3 className="h-5 w-5" />}
            title="BI Logístico"
            body="Dashboards modernos com KPIs de performance, prazos e custos para sua gestão."
          />
          <FeatureCard
            icon={<MapPin className="h-5 w-5" />}
            title="Torre de Controle"
            body="Visualize sua frota e cargas no mapa com atualização em tempo real via Mapbox."
          />
          <FeatureCard
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Central de Documentos"
            body="Acesse notas fiscais, CT-es e canhotos digitais de forma organizada e rápida."
          />
        </div>
      </section>

      <section id="quem-somos" className="border-t border-border/60 bg-surface-2/50">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-24 md:grid-cols-2 md:items-center">
          <div>
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              InfinitLog BI
            </span>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight">
              Transparência total para o seu negócio.
            </h2>
            <p className="mt-5 text-muted-foreground">
              O Portal do Cliente Corporativo transforma dados em decisões. 
              Acompanhe o tempo médio de entrega, quilometragem percorrida e 
              tenha todos os comprovantes à disposição com um clique.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              ["Realtime", "Monitoramento"],
              ["100%", "Digital"],
              ["PowerBI", "Dashboard"],
              ["Mobile", "Ready"],
            ].map(([n, l]) => (
              <div key={l} className="card-soft p-6">
                <div className="text-2xl font-semibold tracking-tight">{n}</div>
                <div className="mt-1 text-sm text-muted-foreground">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60 bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-6 py-12 text-sm text-muted-foreground sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Logo size={24} withWordmark={true} />
            <span className="ml-4 border-l border-border pl-4">© {new Date().getFullYear()} InfinitLog</span>
          </div>
          <div className="flex gap-8">
            <Link to="/auth" className="hover:text-foreground">Acesso Cliente</Link>
            <Link to="/cadastro-motorista" className="hover:text-foreground">Seja um Parceiro</Link>
            <Link to="/rastreio" className="hover:text-foreground">Rastreio</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="card-soft p-8 hover:border-primary/50 transition-colors">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground">
        {icon}
      </div>
      <h3 className="mt-5 text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

import { BarChart3 } from "lucide-react";

