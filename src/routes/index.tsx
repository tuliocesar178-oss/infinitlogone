import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowRight, MapPin, Package, Search, Truck, Zap, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "InfinitLog Transportes — Logística sob demanda" },
      {
        name: "description",
        content:
          "Peça, acompanhe e receba suas cargas em tempo real. Rastreamento simples, motoristas conectados, entrega sem atrito.",
      },
      { property: "og:title", content: "InfinitLog Transportes" },
      {
        property: "og:description",
        content: "Logística inteligente. Rastreie sua entrega em tempo real.",
      },
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
    navigate({ to: "/rastreio/$code", params: { code: value } });
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Truck className="h-4 w-4" />
            </span>
            InfinitLog
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground sm:flex">
            <a href="#servicos" className="hover:text-foreground">Serviços</a>
            <a href="#quem-somos" className="hover:text-foreground">Quem somos</a>
            <a href="#contato" className="hover:text-foreground">Contato</a>
          </nav>
          <Link
            to="/auth"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Entrar <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      {/* Hero + rastreio */}
      <section className="mx-auto max-w-6xl px-6 pt-16 pb-24 sm:pt-24">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground">
            <Zap className="h-3 w-3" /> Plataforma em tempo real
          </span>
          <h1 className="mt-6 text-5xl font-semibold tracking-tight sm:text-6xl">
            Sua carga, do jeito certo.
            <span className="block text-muted-foreground">Em tempo real.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Peça, despache e acompanhe entregas com a mesma simplicidade
            de pedir um carro. Sem burocracia, sem planilhas.
          </p>
        </div>

        {/* Barra de rastreio */}
        <form
          onSubmit={onTrack}
          className="card-soft mt-10 flex flex-col gap-3 p-3 sm:flex-row sm:items-center"
        >
          <div className="flex flex-1 items-center gap-3 rounded-2xl bg-surface-2 px-5 py-4">
            <Search className="h-5 w-5 text-muted-foreground" />
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Rastreie por código, pedido ou nota fiscal"
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

        {/* Feature cards */}
        <div id="servicos" className="mt-20 grid gap-6 sm:grid-cols-3">
          <FeatureCard
            icon={<Package className="h-5 w-5" />}
            title="Peça em segundos"
            body="Criação de fretes simples, com preço e prazo antes de despachar."
          />
          <FeatureCard
            icon={<MapPin className="h-5 w-5" />}
            title="Rastreie ao vivo"
            body="Mapa em tempo real, previsão de chegada e status automáticos."
          />
          <FeatureCard
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Entrega comprovada"
            body="Foto, assinatura e nota fiscal ao final de cada entrega."
          />
        </div>
      </section>

      {/* Quem somos */}
      <section id="quem-somos" className="border-t border-border/60 bg-surface-2/50">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-24 md:grid-cols-2 md:items-center">
          <div>
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Quem somos
            </span>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight">
              Uma nova logística. Menos fricção, mais movimento.
            </h2>
            <p className="mt-5 text-muted-foreground">
              A InfinitLog conecta clientes, motoristas e operação em um só
              lugar. Cada pedido vira uma jornada acompanhada em tempo real,
              com automação de status e comunicação direta.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              ["+1.5M", "km rodados"],
              ["98%", "no prazo"],
              ["24/7", "acompanhamento"],
              ["<2min", "para despachar"],
            ].map(([n, l]) => (
              <div key={l} className="card-soft p-6">
                <div className="text-3xl font-semibold tracking-tight">{n}</div>
                <div className="mt-1 text-sm text-muted-foreground">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="contato" className="mx-auto max-w-6xl px-6 py-24">
        <div className="card-soft flex flex-col items-start gap-6 p-10 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-3xl font-semibold tracking-tight">
              Pronto para começar?
            </h3>
            <p className="mt-2 text-muted-foreground">
              Crie sua conta ou fale com nosso time comercial.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/auth"
              className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Entrar na plataforma
            </Link>
            <a
              href="mailto:contato@infinitlog.com"
              className="rounded-full border border-border bg-background px-6 py-3 text-sm font-semibold hover:bg-accent"
            >
              Falar com o time
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Truck className="h-3 w-3" />
            </span>
            © {new Date().getFullYear()} InfinitLog Transportes
          </div>
          <div className="flex gap-6">
            <a href="#servicos" className="hover:text-foreground">Serviços</a>
            <a href="#quem-somos" className="hover:text-foreground">Quem somos</a>
            <a href="#contato" className="hover:text-foreground">Contato</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="card-soft p-8">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground">
        {icon}
      </div>
      <h3 className="mt-5 text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
