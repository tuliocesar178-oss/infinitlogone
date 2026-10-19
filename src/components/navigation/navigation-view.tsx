import { lazy, Suspense, useState } from 'react';
import { ClientOnly, Link } from '@tanstack/react-router';
import { ArrowLeft, ArrowUp, ExternalLink, LocateFixed, Navigation, RotateCcw, Square, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { NavLauncherModal } from '@/components/driver/nav-launcher-modal';
import { useNavigation } from '@/hooks/use-navigation';
import { navigationActive, type NavigationOrder } from '@/lib/navigation/model';

// Isolate the browser-only map import from SSR and use the same authenticated
// navigation lifecycle for route calculation, progress and telemetry.
const NavigationMap = lazy(() => import('./navigation-map'));
export interface NavigationViewProps { order: NavigationOrder; }
const meters = (value: number) => value >= 1000 ? `${(value / 1000).toFixed(1)} km` : `${Math.round(value)} m`;
const time = (value: number | string) => new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export function NavigationView({ order }: NavigationViewProps) {
  const nav = useNavigation(order);
  const [externalOpen, setExternalOpen] = useState(false);
  const [follow, setFollow] = useState(true);
  const [centerRequest, setCenterRequest] = useState(0);
  const active = navigationActive(order.status);
  const target = nav.target.position;
  const canStart = active && target !== null;
  const progress = nav.progress;
  const mapFallback = <div className="absolute inset-0 grid place-items-center bg-muted text-muted-foreground" role="status">Carregando mapa…</div>;
  return <main className="fixed inset-0 z-50 overflow-hidden bg-background" aria-label="Navegação do frete">
    <ClientOnly fallback={mapFallback}><Suspense fallback={mapFallback}><NavigationMap route={nav.route} position={nav.position} target={target} heading={nav.heading} follow={follow && nav.started && !nav.gpsLost} centerRequest={centerRequest} /></Suspense></ClientOnly>
    <section data-navigation-top className="absolute inset-x-3 top-3 z-10 mx-auto flex max-w-2xl items-start gap-3 rounded-lg border border-border bg-background/95 p-3 shadow-lg">
      <Button asChild size="icon" variant="ghost"><Link to="/driver/fretes" aria-label="Voltar aos fretes"><ArrowLeft /></Link></Button>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground">{nav.target.kind}{progress ? ` · ${meters(progress.stepRemaining)} até a manobra` : ''}</p>
        <h1 className="flex items-center gap-2 text-base font-semibold"><ArrowUp className="h-5 w-5 shrink-0" />{progress?.instruction ?? (nav.started ? 'Aguardando localização' : 'Iniciar navegação')}</h1>
        <p className="break-words text-xs text-muted-foreground">{nav.target.address}</p>
      </div>
      <Button size="icon" variant="ghost" disabled={!nav.voiceSupported} onClick={nav.toggleVoice} aria-label={nav.voice ? 'Desativar instruções por voz' : 'Ativar instruções por voz'} title={nav.voiceSupported ? 'Instruções por voz' : 'Voz em português indisponível neste navegador'}>{nav.voice ? <Volume2 /> : <VolumeX />}</Button>
    </section>
    <section data-navigation-bottom className="absolute inset-x-3 bottom-3 z-10 mx-auto max-w-2xl space-y-3 rounded-lg border border-border bg-background/95 p-3 shadow-lg">
      {!active && <p role="alert" className="text-sm text-destructive">Este frete não está em uma etapa disponível para navegação.</p>}
      {!target && <p role="alert" className="text-sm text-destructive">Coordenadas da {nav.target.kind.toLowerCase()} não cadastradas. Contate a equipe.</p>}
      {nav.started && !nav.position && !nav.gpsError && <p role="status" className="text-sm text-muted-foreground">Aguardando sinal do GPS…</p>}
      {nav.gpsError && <p role="alert" className="text-sm text-destructive">{nav.gpsError}</p>}
      {nav.gpsLost && !nav.gpsError && <p role="alert" className="text-sm text-destructive">GPS sem posição recente. Aguardando nova localização.</p>}
      {!nav.online && <p role="alert" className="text-sm text-destructive">Sem conexão. A última rota permanece disponível; envio da posição pausado.</p>}
      {nav.error && <p role="alert" className="break-words text-sm text-destructive">{nav.error}</p>}
      {nav.syncError && <p role="alert" className="break-words text-sm text-destructive">{nav.syncError}</p>}
      {nav.busy && <p role="status" className="text-sm text-muted-foreground">Calculando rota rodoviária…</p>}
      {progress && progress.remaining <= 300 && <p role="status" className="rounded-md border border-brand/20 bg-brand/5 px-3 py-2 text-sm font-medium text-brand">Você está chegando à {nav.target.kind.toLowerCase()}.</p>}
      {nav.routes.length > 1 && <div className="space-y-2"><p className="text-xs font-medium text-muted-foreground">Rotas alternativas</p><div className="flex flex-wrap gap-2">{nav.routes.map((route, index) => <Button key={`${index}-${route.distance}`} size="sm" variant={nav.selected === index ? 'default' : 'outline'} aria-pressed={nav.selected === index} onClick={() => nav.select(index)}>Opção {index + 1} · {meters(route.distance)} · {Math.max(1, Math.round(route.duration / 60))} min</Button>)}</div></div>}
      <dl className="grid grid-cols-3 gap-2 text-sm">
        <div><dt className="text-xs text-muted-foreground">Distância restante</dt><dd className="font-semibold">{progress ? meters(progress.remaining) : '—'}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Tempo estimado</dt><dd className="font-semibold">{progress ? `${Math.max(1, Math.round(progress.seconds / 60))} min` : '—'}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Chegada prevista</dt><dd className="font-semibold">{progress ? new Date(Date.now() + progress.seconds * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'}</dd></div>
      </dl>
      <Progress value={progress?.percent ?? 0} aria-label="Progresso da rota" />
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span>Último GPS: {nav.lastFixAt ? time(nav.lastFixAt) : '—'}</span><span>Recebido pela INFINITLOG: {nav.lastSyncedAt ? time(nav.lastSyncedAt) : '—'}</span></div>
      <div className="grid grid-cols-2 gap-2">
        {nav.started ? <Button onClick={nav.stop}><Square />Encerrar</Button> : <Button disabled={!canStart} onClick={nav.start}><Navigation />Iniciar navegação</Button>}
        <Button variant="outline" disabled={!nav.started || !nav.position || nav.busy || !nav.online} onClick={() => void nav.recalculate()}><RotateCcw />Recalcular</Button>
        <Button variant="outline" className="h-auto min-h-9 whitespace-normal" disabled={!target && !nav.target.address} onClick={() => setExternalOpen(true)}><ExternalLink /><span>Abrir em outro aplicativo</span></Button>
        <Button variant="outline" disabled={!nav.position} onClick={() => { setFollow(true); setCenterRequest(value => value + 1); }}><LocateFixed />Centralizar</Button>
      </div>
    </section>
    <NavLauncherModal open={externalOpen} onClose={() => setExternalOpen(false)} onInternal={canStart ? nav.start : undefined} target={{ lat: target?.[1] ?? null, lng: target?.[0] ?? null, label: nav.target.address, orderId: order.id }} origin={nav.position ? { lat: nav.position[1], lng: nav.position[0] } : undefined} />
  </main>;
}
