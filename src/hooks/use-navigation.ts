import { useEffect, useMemo, useRef, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { getNavigationDirections, syncNavigationPosition } from '@/lib/navigation/directions.functions';
import { navigationActive, navigationTarget, routeProgress, type NavigationOrder, type NavigationRoute, type Position } from '@/lib/navigation/model';
import { validPosition } from '@/lib/navigation/map-route';
export function useNavigation(order: NavigationOrder) {
  const directions = useServerFn(getNavigationDirections);
  const sync = useServerFn(syncNavigationPosition);
  const [started, setStarted] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const [routes, setRoutes] = useState<NavigationRoute[]>([]);
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(true);
  const [gpsLost, setGpsLost] = useState(false);
  const [voice, setVoice] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [heading, setHeading] = useState<number | null>(null);
  const [lastFixAt, setLastFixAt] = useState<number | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const fix = useRef<GeolocationPosition | null>(null);
  const lastFetch = useRef(0);
  const fetching = useRef(false);
  const offCount = useRef(0);
  const generation = useRef(0);
  const traveledOffset = useRef(0);
  const routeRef = useRef<NavigationRoute | null>(null);
  const lastSpoken = useRef('');
  const target = navigationTarget(order);
  const targetKey = `${order.id}:${target.kind}:${target.position?.join(',')}`;
  const route = routes[selected] ?? null;
  routeRef.current = route;
  const progress = useMemo(() => route && position ? routeProgress(route, position) : null, [route, position]);
  async function recalculate() {
    if (!fix.current || fetching.current || !navigator.onLine || !target.position) return;
    const revision = generation.current;
    fetching.current = true; lastFetch.current = Date.now(); setBusy(true);
    try {
      const pos: Position = [fix.current.coords.longitude, fix.current.coords.latitude];
      const result = await directions({ data: { orderId: order.id, position: pos } });
      if (revision !== generation.current) return;
      if (routeRef.current) traveledOffset.current += routeProgress(routeRef.current, pos).traveled;
      setRoutes(result.routes); setSelected(0); setError(null); offCount.current = 0;
    } catch (e) { if (revision === generation.current) setError(e instanceof Error ? e.message : 'Falha ao calcular rota.'); }
    finally { fetching.current = false; if (revision === generation.current) setBusy(false); }
  }
  const recalculateRef = useRef(recalculate); recalculateRef.current = recalculate;
  useEffect(() => { generation.current++; setRoutes([]); setSelected(0); setBusy(false); traveledOffset.current = 0; lastFetch.current = 0; }, [targetKey]);
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const refresh = () => setVoiceSupported(speechSynthesis.getVoices().some(v => v.lang.toLowerCase().startsWith('pt')));
    refresh(); speechSynthesis.addEventListener('voiceschanged', refresh);
    return () => speechSynthesis.removeEventListener('voiceschanged', refresh);
  }, []);
  useEffect(() => {
    if (!started || !navigationActive(order.status)) return;
    if (!navigator.geolocation) { setGpsError('Localização não disponível neste dispositivo.'); return; }
    let canceled = false;
    let lastSync = 0;
    let syncing = false;
    const updateNetwork = () => { setOnline(navigator.onLine); if (navigator.onLine && Date.now() - lastFetch.current >= 15000) void recalculateRef.current(); };
    updateNetwork();
    const syncLatest = async () => {
      const value = fix.current;
      if (!value || canceled || !navigator.onLine || syncing || Date.now() - lastSync < 10000 || Date.now() - value.timestamp > 30000) return;
      const pos: Position = [value.coords.longitude, value.coords.latitude];
      const current = routeRef.current;
      const metrics = current ? routeProgress(current, pos) : null;
      syncing = true; lastSync = Date.now();
      try {
        const result = await sync({ data: { orderId: order.id, status: order.status, position: pos, accuracy: value.coords.accuracy, heading: value.coords.heading, speed: value.coords.speed == null ? null : value.coords.speed * 3.6, etaMinutes: metrics ? metrics.seconds / 60 : null, distanceKm: metrics ? metrics.remaining / 1000 : null } });
        if (!canceled) { setSyncError(null); setLastSyncedAt(result.savedAt); }
      } catch (problem) { if (!canceled) setSyncError(problem instanceof Error ? problem.message : 'Falha ao sincronizar a posição. Tentando novamente.'); }
      finally { syncing = false; }
    };
    const watch = navigator.geolocation.watchPosition(value => {
      if (canceled) return;
      const pos: Position = [value.coords.longitude, value.coords.latitude];
      if (!validPosition(pos) || !Number.isFinite(value.coords.accuracy) || Date.now() - value.timestamp > 30000) { setGpsLost(true); setGpsError('GPS sem posição válida recente. Aguardando nova localização.'); return; }
      fix.current = value; setGpsLost(false); setGpsError(null); setLastFixAt(value.timestamp);
      setHeading(value.coords.heading != null && Number.isFinite(value.coords.heading) && value.coords.heading >= 0 && value.coords.heading < 360 && (value.coords.speed ?? 0) > 1 && value.coords.accuracy <= 50 ? value.coords.heading : null);
      setPosition(pos);
      const current = routeRef.current;
      const metrics = current ? routeProgress(current, pos) : null;
      offCount.current = metrics && metrics.offRoute > Math.max(60, value.coords.accuracy * 2) ? offCount.current + 1 : 0;
      if ((!current && Date.now() - lastFetch.current > 15000) || Date.now() - lastFetch.current > 120000 || (offCount.current >= 2 && Date.now() - lastFetch.current > 15000)) void recalculateRef.current();
      void syncLatest();
    }, problem => { if (canceled) return; setGpsLost(true); setGpsError(problem.code === 1 ? 'Permita a localização nas configurações do navegador para navegar.' : 'Sinal GPS indisponível. Aguardando nova posição.'); }, { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 });
    const interval = window.setInterval(() => { if (fix.current && Date.now() - fix.current.timestamp > 30000) setGpsLost(true); void syncLatest(); }, 5000);
    const resume = () => { if (!document.hidden) { updateNetwork(); setGpsLost(!fix.current || Date.now() - fix.current.timestamp > 30000); } };
    window.addEventListener('online', updateNetwork); window.addEventListener('offline', updateNetwork); document.addEventListener('visibilitychange', resume);
    return () => { canceled = true; navigator.geolocation.clearWatch(watch); window.clearInterval(interval); window.removeEventListener('online', updateNetwork); window.removeEventListener('offline', updateNetwork); document.removeEventListener('visibilitychange', resume); };
  }, [started, targetKey, order.status]);
  useEffect(() => {
    if (!voice || !started || !online || gpsLost || !progress || !voiceSupported) return;
    const key = `${targetKey}:${selected}:${progress.stepIndex}:${progress.stepRemaining < 150 ? 'near' : 'far'}`;
    if (lastSpoken.current === key) return;
    lastSpoken.current = key;
    const speech = new SpeechSynthesisUtterance(`${Math.round(progress.stepRemaining)} metros. ${progress.instruction}`);
    speech.lang = 'pt-BR'; const pt = speechSynthesis.getVoices().find(v => v.lang === 'pt-BR'); if (pt) speech.voice = pt;
    speechSynthesis.cancel(); speechSynthesis.speak(speech);
    return () => speechSynthesis.cancel();
  }, [voice, started, online, gpsLost, voiceSupported, progress?.stepIndex, progress && progress.stepRemaining < 150, targetKey, selected]);
  return { started, start: () => { setStarted(true); setError(null); setGpsError(null); }, stop: () => { setStarted(false); generation.current++; setBusy(false); if ('speechSynthesis' in window) speechSynthesis.cancel(); }, position, heading, lastFixAt, lastSyncedAt, gpsError, routes, route, selected, select: setSelected, progress, traveled: traveledOffset.current + (progress?.traveled ?? 0), busy, error, syncError, online, gpsLost, voice, voiceSupported, toggleVoice: () => setVoice(v => !v), recalculate, target };
}