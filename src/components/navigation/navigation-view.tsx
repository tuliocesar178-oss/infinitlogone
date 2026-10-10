import { lazy, Suspense, useState } from 'react';
import { ClientOnly, Link } from '@tanstack/react-router';
import { Navigation, Route, Volume2, VolumeX, LocateFixed, X, RefreshCw, ExternalLink, ArrowUp, MapPin } from 'lucide-react';
import { useNavigation } from '@/hooks/use-navigation';
import type { NavigationOrder } from '@/lib/navigation/model';
import { navigationActive } from '@/lib/navigation/model';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { NavLauncherModal } from '@/components/driver/nav-launcher-modal';
import { cn } from '@/lib/utils';
const NavigationMap = lazy(() => import('./navigation-map'));
export interface NavigationViewProps { order: NavigationOrder; }
export function NavigationView({ order }: NavigationViewProps) {
  const nav = useNavigation(order);
  const [external, setExternal] = useState(false);
  const [follow, setFollow] = useState(true);
  const [centerRequest, setCenterRequest] = useState(0);
  const p = nav.progress;
  const target = { lat: nav.target.position?.[1] ?? null, lng: nav.target.position?.[0] ?? null, label: nav.target.address, orderId: order.id };
  const minutes = p ? Math.ceil(p.seconds / 60) : null;
  return <section className="fixed inset-0 z-50 overflow-hidden bg-background text-foreground" aria-label="Navegação do frete">
    <ClientOnly fallback={<div className="grid h-full place-items-center">Carregando mapa…</div>}><Suspense fallback={<div className="grid h-full place-items-center">Carregando mapa…</div>}><NavigationMap route={nav.route} position={nav.position} target={nav.target.position} follow={follow} centerRequest={centerRequest} /></Suspense></ClientOnly>
    <div className="absolute inset-x-3 top-3 z-10 mx-auto max-w-xl space-y-2 pt-[env(safe-area-inset-top)]">
      <div className="flex items-center gap-2"><Button asChild size="icon" variant="secondary" aria-label="Encerrar navegação"><Link to="/driver" onClick={nav.stop}><X /></Link></Button><div className="min-w-0 flex-1 rounded-lg bg-background/95 px-3 py-2 shadow-lg"><div className="text-xs text-muted-foreground">{nav.started ? 'Navegação INFINITLOG' : 'Destino atual'} · {nav.target.kind}</div><div className="truncate text-sm font-semibold">{nav.target.address}</div></div><Button variant="secondary" size="icon" disabled={!nav.voiceSupported} onClick={nav.toggleVoice} aria-label={nav.voice ? 'Desativar voz' : 'Ativar voz'}>{nav.voice ? <Volume2 /> : <VolumeX />}</Button></div>
      {nav.started && <div className="flex gap-3 rounded-lg bg-primary p-4 text-primary-foreground shadow-lg"><ArrowUp className="h-8 w-8 shrink-0" /><div><div className="text-lg font-semibold">{nav.busy ? 'Calculando rota…' : p ? `${Math.round(p.stepRemaining)} m` : 'Aguardando GPS'}</div><div className="text-sm">{p?.instruction ?? 'Obtendo sua posição atual'}</div></div></div>}
      {(!nav.online || nav.gpsLost || nav.error || nav.syncError) && <div role="alert" className="rounded-lg border border-border bg-background p-3 text-sm">{!nav.online ? 'Sem internet. Rota salva nesta tela; novas rotas e sincronização aguardam conexão.' : nav.error ?? nav.syncError ?? 'GPS sem atualização recente. Estimativas podem estar desatualizadas.'}</div>}
    </div>
    <div className="absolute right-3 top-1/2 z-10 flex flex-col gap-2"><Button variant="secondary" size="icon" onClick={() => { setFollow(true); setCenterRequest(n => n + 1); }} aria-label="Centralizar na minha posição"><LocateFixed /></Button><Button variant="secondary" size="icon" onClick={() => { setFollow(false); setCenterRequest(n => n + 1); }} aria-label="Visualizar rota completa"><Route /></Button></div>
    <div className="absolute inset-x-0 bottom-0 z-10 border-t border-border bg-background/95 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-4 shadow-lg">
      <div className="mx-auto max-w-xl space-y-3">
        {p && <><div className="flex flex-wrap items-baseline justify-between gap-2"><strong className="text-2xl">{(p.remaining / 1000).toFixed(1)} km · {minutes} min</strong><span className="text-sm text-muted-foreground">Chegada {new Date(Date.now() + p.seconds * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span></div><Progress value={p.percent} aria-label="Progresso da rota atual" /><div className="flex justify-between text-xs text-muted-foreground"><span>{(nav.traveled / 1000).toFixed(1)} km percorridos</span><span>{Math.round(p.percent)}% da rota atual</span></div></>}
        {p?.arrival && <div className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-primary" />Próximo à {nav.target.kind.toLowerCase()}.<Button asChild variant="link"><Link to="/driver">Confirmar no frete</Link></Button></div>}
        {nav.routes.length > 1 && <div className="flex gap-2 overflow-x-auto" aria-label="Alternativas de rota">{nav.routes.map((route, index) => <Button key={`${route.distance}:${index}`} size="sm" variant={index === nav.selected ? 'default' : 'outline'} onClick={() => nav.select(index)}>Rota {index + 1} · {Math.ceil(route.duration / 60)} min</Button>)}</div>}
        {!navigationActive(order.status) ? <p role="status">Frete encerrado. Navegação indisponível.</p> : !nav.started ? <Button className="w-full" disabled={!nav.target.position} onClick={nav.start}><Navigation />Iniciar navegação</Button> : <div className="flex gap-2"><Button className="flex-1" variant="outline" onClick={nav.recalculate} disabled={nav.busy || !nav.online || !nav.position}><RefreshCw className={cn('h-4 w-4', nav.busy && 'animate-spin')} />Recalcular</Button><Button variant="outline" onClick={nav.stop}><X />Encerrar</Button></div>}
        {!nav.target.position && <p role="alert" className="text-sm">Coordenadas não cadastradas. Contate a equipe ou use o endereço em outro aplicativo.</p>}
        <Button variant="secondary" className="w-full" onClick={() => setExternal(true)}><ExternalLink />Abrir em outro aplicativo</Button>
        <p className="text-xs text-muted-foreground">GPS e voz podem pausar com a tela bloqueada ou ao sair do aplicativo. Rotas Mapbox não garantem restrições para veículos pesados.</p>
      </div>
    </div>
    <NavLauncherModal open={external} target={target} onClose={() => setExternal(false)} onInternal={() => { if (!nav.started) nav.start(); }} origin={nav.position ? { lat: nav.position[1], lng: nav.position[0] } : undefined} />
  </section>;
}
