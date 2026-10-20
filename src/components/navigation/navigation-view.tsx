import { lazy, Suspense, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { StageAction } from './stage-action';
import { NavigationSheet } from './navigation-sheet';
import { ClientOnly, Link } from '@tanstack/react-router';
import { AlertTriangle, ArrowLeft, ArrowUp, ArrowUpLeft, ArrowUpRight, CornerUpLeft, CornerUpRight, ExternalLink, LocateFixed, Maximize2, Navigation, RotateCcw, Square, Undo2, Volume2, VolumeX, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { NavLauncherModal } from '@/components/driver/nav-launcher-modal';
import { useNavigation } from '@/hooks/use-navigation';
import { STATUS_LABEL } from '@/lib/order-status';
import { navigationActive, type NavigationOrder } from '@/lib/navigation/model';
import { IncidentWorkspace } from '@/components/incidents/workspace';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';

// Isolate the browser-only map import from SSR and use the same authenticated
// navigation lifecycle for route calculation, progress and telemetry.
const NavigationMap = lazy(() => import('./navigation-map'));
export interface NavigationViewProps { order: NavigationOrder; }
const meters = (value: number) => value >= 1000 ? `${(value / 1000).toFixed(1)} km` : `${Math.round(value)} m`;
const time = (value: number | string) => new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const MANEUVER_ICON: Record<string, LucideIcon> = { left: CornerUpLeft, 'sharp left': CornerUpLeft, right: CornerUpRight, 'sharp right': CornerUpRight, 'slight left': ArrowUpLeft, 'slight right': ArrowUpRight, uturn: Undo2 };

export function NavigationView({ order }: NavigationViewProps) {
  const nav = useNavigation(order);
  const [externalOpen, setExternalOpen] = useState(false);
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [follow, setFollow] = useState(true);
  const [centerRequest, setCenterRequest] = useState(0);
  const [overviewRequest, setOverviewRequest] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => { void supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null)); }, []);
  const active = navigationActive(order.status);
  const target = nav.target.position;
  const canStart = active && target !== null;
  const progress = nav.progress;
  const Turn = (progress?.modifier && MANEUVER_ICON[progress.modifier]) || ArrowUp;
  const center = () => { setFollow(true); setCenterRequest(value => value + 1); };
  const minutes = progress ? `${Math.max(1, Math.round(progress.seconds / 60))} min` : '—';
  const arrival = progress ? new Date(Date.now() + progress.seconds * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';
  const mapFallback = <div className="absolute inset-0 grid place-items-center bg-muted text-muted-foreground" role="status">Carregando mapa…</div>;
  const summary = <dl className="grid grid-cols-3 gap-2 text-sm">
    <div><dt className="text-xs text-muted-foreground">Distância restante</dt><dd className="font-semibold">{progress ? meters(progress.remaining) : '—'}</dd></div>
    <div><dt className="text-xs text-muted-foreground">Tempo estimado</dt><dd className="font-semibold">{minutes}</dd></div>
    <div><dt className="text-xs text-muted-foreground">Chegada prevista</dt><dd className="font-semibold">{arrival}</dd></div>
  </dl>;
  const alerts = <>
    {!active && <p role="alert" className="text-sm text-destructive">Este frete não está em uma etapa disponível para navegação.</p>}
    {!target && <p role="alert" className="text-sm text-destructive">Coordenadas da {nav.target.kind.toLowerCase()} não cadastradas. Contate a equipe.</p>}
    {nav.started && !nav.position && !nav.gpsError && <p role="status" className="text-sm text-muted-foreground">Aguardando sinal do GPS…</p>}
    {nav.gpsError && <p role="alert" className="text-sm text-destructive">{nav.gpsError}</p>}
    {nav.gpsLost && !nav.gpsError && <p role="alert" className="text-sm text-destructive">GPS sem posição recente. Aguardando nova localização.</p>}
    {!nav.online && <p role="alert" className="text-sm text-destructive">Sem conexão. A última rota permanece disponível; envio da posição pausado.</p>}
    {nav.error && <p role="alert" className="break-words text-sm text-destructive">{nav.error}</p>}
    {nav.syncError && <p role="alert" className="break-words text-sm text-destructive">{nav.syncError}</p>}
    {nav.busy && <p role="status" className="text-sm text-muted-foreground">Calculando rota rodoviária…</p>}
  </>;
  const startStop = nav.started ? <Button onClick={nav.stop}><Square />Encerrar</Button> : <Button disabled={!canStart} onClick={nav.start}><Navigation />Iniciar navegação</Button>;
  return <main className="fixed inset-0 z-50 overflow-hidden bg-background" aria-label="Navegação do frete">
    <ClientOnly fallback={mapFallback}><Suspense fallback={mapFallback}><NavigationMap route={nav.route} position={nav.position} target={target} heading={nav.heading} follow={follow && nav.started && !nav.gpsLost} centerRequest={centerRequest} overviewRequest={overviewRequest} onUserMove={() => setFollow(false)} /></Suspense></ClientOnly>
    <section data-navigation-top className="absolute inset-x-3 z-10 mx-auto flex max-w-2xl items-start gap-3 rounded-xl border border-border bg-background/95 p-3 shadow-lg" style={{ top: 'max(0.75rem, env(safe-area-inset-top))' }}>
      <Button asChild size="icon" variant="ghost"><Link to="/driver/fretes" aria-label="Voltar aos fretes"><ArrowLeft /></Link></Button>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground" aria-hidden="true"><Turn className="h-6 w-6" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-lg font-bold leading-tight">{progress ? meters(progress.stepRemaining) : nav.target.kind}</p>
        <h1 className="text-sm font-semibold leading-snug">{progress?.instruction ?? (nav.started ? 'Aguardando localização' : 'Iniciar navegação')}</h1>
        <p className="truncate text-xs text-muted-foreground">{progress?.street || nav.target.address}</p>
      </div>
      <Button size="icon" variant="ghost" disabled={!nav.voiceSupported} onClick={nav.toggleVoice} aria-label={nav.voice ? 'Desativar instruções por voz' : 'Ativar instruções por voz'} title={nav.voiceSupported ? 'Instruções por voz' : 'Voz em português indisponível neste navegador'}>{nav.voice ? <Volume2 /> : <VolumeX />}</Button>
      <Button size="icon" variant="outline" aria-label="Registrar ocorrência da viagem" title="Ocorrência da viagem" onClick={() => setIncidentOpen(true)}><AlertTriangle /></Button>
    </section>
    {nav.started && !follow && nav.position && <Button className="absolute left-1/2 top-[40%] z-10 -translate-x-1/2 shadow-lg" onClick={center}><LocateFixed />Voltar à navegação</Button>}
    <NavigationSheet
      storageKey={`nav-sheet:${order.id}`}
      minimized={<p className="pb-1 text-center text-sm font-medium">{progress ? `${meters(progress.remaining)} · ${minutes} · chegada ${arrival}` : (nav.started ? 'Navegação ativa' : 'Toque na alça para ver o frete')}</p>}
      compact={<div className="space-y-3 pb-1">{alerts}{summary}<StageAction order={order} userId={userId} remaining={progress?.remaining ?? null} position={nav.position} /></div>}
      expanded={<div className="space-y-3 pb-1">
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{order.code ?? 'Frete'}</p><span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{STATUS_LABEL[order.status] ?? order.status}</span></div>
        {alerts}
        {summary}
        {nav.routes.length > 1 && <div className="space-y-2"><p className="text-xs font-medium text-muted-foreground">Rotas alternativas</p><div className="flex flex-wrap gap-2">{nav.routes.map((route, index) => <Button key={`${index}-${route.distance}`} size="sm" variant={nav.selected === index ? 'default' : 'outline'} aria-pressed={nav.selected === index} onClick={() => nav.select(index)}>Opção {index + 1} · {meters(route.distance)} · {Math.max(1, Math.round(route.duration / 60))} min</Button>)}</div></div>}
        <Progress value={progress?.percent ?? 0} aria-label="Progresso da rota" />
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span>Último GPS: {nav.lastFixAt ? time(nav.lastFixAt) : '—'}</span><span>Recebido pela INFINITLOG: {nav.lastSyncedAt ? time(nav.lastSyncedAt) : '—'}</span></div>
        <StageAction order={order} userId={userId} remaining={progress?.remaining ?? null} position={nav.position} />
        <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
          {startStop}
          <Button variant="outline" disabled={!nav.started || !nav.position || nav.busy || !nav.online} onClick={() => void nav.recalculate()}><RotateCcw />Recalcular</Button>
          <Button variant="outline" className="h-auto min-h-9 whitespace-normal" disabled={!target && !nav.target.address} onClick={() => setExternalOpen(true)}><ExternalLink /><span>Abrir em outro aplicativo</span></Button>
          <Button variant="outline" disabled={!nav.position} onClick={center}><LocateFixed />Centralizar</Button>
          <Button variant="outline" className="min-[380px]:col-span-2" disabled={!nav.route} onClick={() => { setFollow(false); setOverviewRequest(value => value + 1); }}><Maximize2 />Ver rota inteira</Button>
        </div>
      </div>}
    />
    <NavLauncherModal open={externalOpen} onClose={() => setExternalOpen(false)} onInternal={canStart ? nav.start : undefined} target={{ lat: target?.[1] ?? null, lng: target?.[0] ?? null, label: nav.target.address, orderId: order.id }} origin={nav.position ? { lat: nav.position[1], lng: nav.position[0] } : undefined} />
    <Dialog open={incidentOpen} onOpenChange={setIncidentOpen}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogTitle>Ocorrência da viagem</DialogTitle><DialogDescription>{order.code ?? 'Frete da navegação'}</DialogDescription><IncidentWorkspace driver reportOnly orderId={order.id} onClose={() => setIncidentOpen(false)} /></DialogContent></Dialog>
  </main>;
}
