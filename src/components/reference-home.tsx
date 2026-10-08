import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowRight, BarChart3, FileText, MapPin, MessageCircle, Search, ShieldCheck, Truck, Zap } from 'lucide-react';
import heroImage from '@/assets/home-logistics-premium.jpg';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const services = [
  { icon: MapPin, title: 'Rastreamento em tempo real', body: 'Acompanhe suas cargas em tempo real, do início ao destino.' },
  { icon: Truck, title: 'Gestão de frotas e motoristas', body: 'Controle sua frota, motoristas e operações de forma centralizada.' },
  { icon: BarChart3, title: 'Relatórios personalizados', body: 'Dados completos para uma melhor tomada de decisão.' },
  { icon: FileText, title: 'Documentos e comprovantes', body: 'Acesse canhotos, notas e comprovantes em um só lugar.' },
  { icon: MessageCircle, title: 'Comunicação com a equipe', body: 'Converse com a equipe de operação e mantenha tudo alinhado.' },
];
const navigation = [{ label: 'Serviços', href: '#servicos' }, { label: 'Soluções', href: '#solucoes' }, { label: 'Quem somos', href: '#quem-somos' }, { label: 'Contato', href: '#contato' }];

export function ReferenceHome() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  function track(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = code.trim();
    if (!/^[A-Za-z0-9-]{4,40}$/.test(value)) {
      setError('Digite um código de rastreamento válido.');
      return;
    }
    setError('');
    void navigate({ to: '/rastreio/$code', params: { code: value.toUpperCase() } });
  }
  return (
    <div className="reference-home min-h-screen bg-background text-foreground">
      <header className="border-b border-border/40 bg-background">
        <div className="home-container flex min-h-20 items-center justify-between gap-4 py-3">
          <Link to="/" aria-label="InfinitLog Transportes — início"><HomeBrand /></Link>
          <nav aria-label="Navegação principal" className="hidden items-center gap-9 text-sm font-medium lg:flex">
            {navigation.map(item => <a key={item.href} href={item.href} className="transition-colors hover:text-brand">{item.label}</a>)}
          </nav>
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" className="hidden rounded-full border-brand/40 px-6 sm:inline-flex"><Link to="/rastreio"><Search className="h-4 w-4" />Rastrear</Link></Button>
            <Button asChild className="rounded-full px-4 text-xs sm:px-6 sm:text-sm"><Link to="/auth">Acesso Restrito<ArrowRight className="h-4 w-4" /></Link></Button>
          </div>
        </div>
      </header>
      <main>
        <section className="home-hero relative isolate overflow-hidden bg-surface-2">
          <img src={heroImage} alt="Caminhão em rodovia com uma ilustração do mapa do Brasil" width={1920} height={768} fetchPriority="high" className="home-hero-image absolute inset-0 -z-10 h-full w-full object-cover" />
          <div className="home-container relative py-12 lg:py-14">
            <div className="home-hero-copy max-w-[490px]">
              <span className="inline-flex items-center gap-2 rounded-full bg-background px-3 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground"><Zap className="h-3.5 w-3.5 text-brand" />Tecnologia & logística</span>
              <h1 className="mt-5 text-[44px] font-bold leading-[1.06] tracking-normal sm:text-[56px] lg:text-[62px]">Sua carga em <span className="block text-brand">boas mãos.</span></h1>
              <p className="mt-5 max-w-[420px] text-lg font-medium leading-relaxed text-muted-foreground">Rastreamento, gestão e total visibilidade para você e sua operação.</p>
              <form onSubmit={track} className="mt-7" noValidate>
                <div className="flex min-h-14 items-center gap-1 rounded-full border border-brand/15 bg-background p-1.5 shadow-home">
                  <Search className="ml-4 h-5 w-5 shrink-0 text-muted-foreground" />
                  <Input value={code} onChange={event => { setCode(event.target.value); setError(''); }} placeholder="Digite o código de rastreamento..." aria-label="Código de rastreamento" aria-invalid={Boolean(error)} aria-describedby={error ? 'tracking-error' : undefined} className="min-w-0 border-0 bg-transparent text-xs shadow-none focus-visible:ring-0 sm:text-sm" />
                  <Button type="submit" className="h-11 shrink-0 rounded-full bg-brand px-4 text-brand-foreground hover:bg-brand/90 sm:px-6">Rastrear<ArrowRight className="h-4 w-4" /></Button>
                </div>
                {error && <p id="tracking-error" role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
              </form>
            </div>
          </div>
          <span className="absolute bottom-3 right-5 rounded bg-background/85 px-2 py-1 text-[10px] text-muted-foreground">Ilustração logística</span>
        </section>
        <section id="servicos" className="bg-surface-2/40 py-8 lg:py-9">
          <div className="home-container grid gap-7 lg:grid-cols-[260px_1fr] lg:gap-6">
            <div id="solucoes" className="pt-1">
              <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase text-brand"><Zap className="h-3 w-3" />Nossos serviços</span>
              <h2 className="mt-3 max-w-sm text-2xl font-semibold leading-tight tracking-normal">Tudo o que você precisa em um só lugar.</h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">Soluções completas para uma logística mais eficiente, segura e inteligente.</p>
              <div className="mt-5 h-0.5 w-9 bg-brand" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {services.map(({ icon: Icon, title, body }) => (
                <article key={title} className="flex min-w-0 flex-col rounded-lg border border-brand/10 bg-card p-4 shadow-card motion-safe:transition-transform motion-safe:hover:-translate-y-1">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-accent text-brand"><Icon className="h-6 w-6" strokeWidth={1.8} /></span>
                  <h3 className="mt-3 text-sm font-medium leading-snug tracking-normal">{title}</h3>
                  <p className="mb-3 mt-2 text-xs leading-relaxed text-muted-foreground">{body}</p>
                  <ArrowRight aria-hidden="true" className="mt-auto h-4 w-4 text-brand" />
                </article>
              ))}
            </div>
          </div>
        </section>
        <section id="contato" className="bg-primary text-primary-foreground">
          <div className="home-container flex flex-col gap-6 py-7 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-6"><ShieldCheck className="hidden h-12 w-12 shrink-0 text-brand sm:block" strokeWidth={1.2} /><div><h2 className="text-lg font-semibold tracking-normal">Pronto para ter mais controle sobre suas operações?</h2><p className="mt-2 text-sm text-primary-foreground/80">Fale com a nossa equipe e descubra como a InfinitLog pode transformar sua logística.</p></div></div>
            <Button asChild variant="outline" className="shrink-0 rounded-full border-primary-foreground/70 bg-transparent px-7 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"><Link to="/auth">Falar com a equipe<ArrowRight className="h-4 w-4" /></Link></Button>
          </div>
        </section>
      </main>
      <footer id="quem-somos" className="bg-background">
        <div className="home-container flex flex-col items-start justify-between gap-6 py-7 md:flex-row md:items-center">
          <Link to="/" aria-label="InfinitLog Transportes"><HomeBrand /></Link>
          <nav aria-label="Navegação do rodapé" className="flex flex-wrap gap-6 text-xs">{navigation.map(item => <a key={item.href} href={item.href} className="hover:text-brand">{item.label}</a>)}</nav>
          <p className="text-xs leading-relaxed text-muted-foreground">© {new Date().getFullYear()} InfinitLog Transportes.<br />Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}

function HomeBrand() {
  return <span className="inline-flex items-center gap-2"><Logo size={40} withWordmark={false} /><span><span className="block text-2xl font-bold leading-none">Infinit<span className="text-brand">Log</span></span><span className="mt-1 block text-[8px] font-semibold tracking-[0.28em]">TRANSPORTES</span></span></span>;
}
