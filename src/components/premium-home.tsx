import { lazy, Suspense, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  FileText,
  MessageCircle,
  Search,
  MapPin,
  ShieldCheck,
  Truck,
  Users,
} from "lucide-react";
import heroLogo from "@/assets/uploads/9620.png";
const PublicLogisticsMap = lazy(() => import("@/components/public-logistics-map"));
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PremiumHome() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  function onTrack(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = code.trim();

    if (!value || !/^[A-Za-z0-9-]{4,40}$/.test(value)) {
      setError("Digite um código de rastreamento válido.");
      return;
    }

    setError("");
    navigate({
      to: "/rastreio/$code",
      params: { code: value.toUpperCase() },
    });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-background/95">
        <div className="mx-auto grid h-20 max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 sm:flex sm:justify-between sm:px-6">
          <Link to="/" aria-label="InfinitLog — início">
            <Logo size={110} />
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium text-primary lg:flex">
            <a href="#servicos" className="hover:text-brand">Serviços</a>
            <a href="#solucoes" className="hover:text-brand">Soluções</a>
            <a href="#quem-somos" className="hover:text-brand">Quem somos</a>
            <a href="#contato" className="hover:text-brand">Contato</a>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to="/rastreio"
              className="hidden rounded-full border border-brand/40 px-5 py-2.5 text-sm font-semibold text-primary hover:bg-accent sm:inline-flex"
            >
              <Search className="mr-2 h-4 w-4" /> Rastrear
            </Link>
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-3 sm:px-5 py-2.5 text-xs sm:text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Acesso Restrito <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden bg-primary">
          <div className="relative mx-auto grid min-h-[530px] max-w-7xl items-center gap-5 px-5 py-8 lg:grid-cols-[1fr_1fr] lg:py-12">
            <div className="relative z-10 max-w-xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-background px-4 py-2 text-xs font-semibold uppercase tracking-normal text-brand">
                <ShieldCheck className="h-4 w-4" /> Tecnologia & logística
              </span>
              <h1 className="mt-7 text-4xl font-semibold leading-tight text-primary-foreground sm:text-6xl">
                Sua carga em{" "}
                <span className="text-brand">boas mãos.</span>
              </h1>
              <p className="mt-7 max-w-lg text-lg leading-relaxed text-primary-foreground/75">
                Rastreamento, gestão e total visibilidade para você e sua operação.
              </p>

              <form onSubmit={onTrack} className="mt-8 max-w-xl">
                <div className="flex items-center gap-2 rounded-full border border-border bg-background p-2 shadow-elevated">
                  <Search className="ml-4 h-5 w-5 shrink-0 text-muted-foreground" />
                  <Input
                    value={code}
                    onChange={(event) => {
                      setCode(event.target.value);
                      setError("");
                    }}
                    placeholder="Digite o código de rastreamento..."
                    aria-label="Código de rastreamento"
                    className="min-w-0 h-12 border-0 bg-transparent shadow-none focus-visible:ring-0"
                  />
                  <Button type="submit" className="h-12 shrink-0 rounded-full bg-brand px-4 text-brand-foreground hover:bg-brand/90">
                    Rastrear <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
                {error ? (
                  <p className="mt-2 text-sm text-destructive">{error}</p>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Consulte o status de um frete com seu código válido.
                  </p>
                )}
              </form>
            </div>

            {/* Official logo blended into the hero: radial mask fades the image's own navy background edges. */}
            <div className="relative aspect-[1672/940] w-full lg:scale-110">
              <div aria-hidden className="absolute inset-[10%] rounded-full bg-brand/10 blur-3xl" />
              <img
                src={heroLogo}
                alt="Logo oficial INFINITLOG VAPT VUPT"
                width={1672}
                height={940}
                className="relative h-full w-full object-contain [mask-image:radial-gradient(ellipse_60%_55%_at_center,black_55%,transparent_100%)]"
                decoding="async"
                fetchPriority="high"
              />
            </div>
          </div>
        </section>

        <section id="servicos" className="mx-auto max-w-7xl px-6 py-20">
          <div className="grid gap-10">
            <div>
              <span className="text-xs font-semibold uppercase tracking-normal text-brand">Nossos serviços</span>
              <h2 className="mt-4 text-4xl font-semibold tracking-normal text-primary">
                Tudo o que você precisa em um só lugar.
              </h2>
              <p className="mt-5 text-muted-foreground">
                Soluções completas para uma logística mais eficiente, segura e inteligente.
              </p>
            </div>

            <div id="solucoes" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Feature icon={MapPin} title="Rastreamento em tempo real" body="Acompanhe suas cargas do início ao destino." />
              <Feature icon={Truck} title="Gestão de frotas e motoristas" body="Controle sua frota e suas operações." />
              <Feature icon={BarChart3} title="Relatórios personalizados" body="Dados completos para decisões melhores." />
              <Feature icon={FileText} title="Documentos e comprovantes" body="Acesse canhotos, notas e comprovantes." />
              <Feature icon={MessageCircle} title="Comunicação com a equipe" body="Converse com a operação com agilidade." />
            </div>
          </div>
        </section>

        <section id="contato" className="bg-primary text-primary-foreground">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-3 px-4 sm:px-6 py-12 sm:flex-row sm:items-center">
            <div className="flex items-start gap-4">
              <Users className="mt-1 h-8 w-8 text-brand" />
              <div>
                <h2 className="text-2xl font-semibold">Pronto para ter mais controle sobre suas operações?</h2>
                <p className="mt-2 text-primary-foreground/70">
                  Fale com a nossa equipe e descubra como a InfinitLog pode transformar sua logística.
                </p>
              </div>
            </div>
            <Button asChild variant="outline" className="shrink-0 border-primary-foreground/50 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"><Link
              to="/auth"
              className="inline-flex items-center rounded-full border border-primary-foreground/50 px-6 py-3 text-sm font-semibold hover:bg-primary-foreground/10"
            >
              Falar com a equipe <ArrowRight className="ml-2 h-4 w-4" />
            </Link></Button>
          </div>
        </section>
      </main>

      <footer id="quem-somos" className="border-t border-border bg-surface px-6 py-10">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 text-sm text-muted-foreground sm:flex-row sm:items-center">
          <Logo size={34} withWordmark />
          <div>© {new Date().getFullYear()} InfinitLog Transportes. Todos os direitos reservados.</div>
        </div>
      </footer>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="group min-w-0 rounded-xl border border-border bg-card p-5 shadow-card motion-safe:transition-all motion-safe:hover:-translate-y-1 hover:border-brand/30 hover:shadow-elevated">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-brand/10 text-brand">
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="mt-5 font-semibold text-primary">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
      <ArrowRight className="mt-5 h-4 w-4 text-brand transition-transform group-hover:translate-x-1" />
    </div>
  );
}
