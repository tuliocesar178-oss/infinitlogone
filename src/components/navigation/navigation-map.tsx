import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { NavigationRoute, Position } from '@/lib/navigation/model';
import { drawNavigationRoute, ROUTE_SOURCE, ROUTE_LINE, ROUTE_CASING, validPosition } from '@/lib/navigation/map-route';
export interface NavigationMapProps { route: NavigationRoute | null; position: Position | null; target: Position | null; heading: number | null; follow: boolean; centerRequest: number; }
export default function NavigationMap(props: NavigationMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const latest = useRef(props); latest.current = props;
  const fitted = useRef<NavigationRoute | null>(null);
  const driverRef = useRef<mapboxgl.Marker | null>(null);
  const targetRef = useRef<mapboxgl.Marker | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const colors = useRef<HTMLSpanElement>(null);
  function mapColor(cssColor: string) {
    // Mapbox's color parser does not support the design system's OKLCH values.
    // Let the browser resolve them to sRGB instead of passing unsupported CSS.
    const canvas = document.createElement('canvas'); canvas.width = 1; canvas.height = 1;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Conversão de cor indisponível.');
    context.fillStyle = cssColor; context.fillRect(0, 0, 1, 1);
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
    return `rgb(${r}, ${g}, ${b})`;
  }
  function padding() {
    const height = container.current?.clientHeight ?? 800;
    const topPanel = document.querySelector('[data-navigation-top]')?.getBoundingClientRect();
    const bottomPanel = document.querySelector('[data-navigation-bottom]')?.getBoundingClientRect();
    return { top: Math.min(height * .32, (topPanel?.bottom ?? 150) + 20), bottom: Math.min(height * .42, (bottomPanel?.height ?? 280) + 20), left: 35, right: 65 };
  }
  function updateMap(forceFit = false) {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    const { route, position, target, heading, follow } = latest.current;
    if (route && colors.current) {
      try { drawNavigationRoute(map, route, { line: mapColor(getComputedStyle(colors.current).color), casing: mapColor(getComputedStyle(colors.current).backgroundColor) }); setMapError(null); }
      catch { setMapError('A geometria da rota é inválida. Recalcule para tentar novamente.'); return; }
    } else {
      const source = map.getSource(ROUTE_SOURCE) as mapboxgl.GeoJSONSource | undefined;
      source?.setData({ type: 'FeatureCollection', features: [] });
      fitted.current = null;
    }
    if (target && validPosition(target)) {
      if (!targetRef.current) { const el = document.createElement('div'); el.className = 'h-5 w-5 rounded-full border-4 border-background bg-destructive shadow-lg'; targetRef.current = new mapboxgl.Marker({ element: el }).setLngLat(target).addTo(map); }
      else targetRef.current.setLngLat(target);
    } else { targetRef.current?.remove(); targetRef.current = null; }
    if (position && validPosition(position)) {
      if (!driverRef.current) { const el = document.createElement('div'); el.className = 'h-6 w-6 rounded-full border-4 border-background bg-brand shadow-lg'; driverRef.current = new mapboxgl.Marker({ element: el }).setLngLat(position).addTo(map); }
      else driverRef.current.setLngLat(position);
    }
    // A new route always gets an overview before subsequent GPS fixes follow it.
    if (route && (fitted.current !== route || forceFit || !follow)) {
      const bounds = new mapboxgl.LngLatBounds();
      route.geometry.coordinates.forEach(coord => bounds.extend([coord[0], coord[1]]));
      if (position) bounds.extend(position);
      map.fitBounds(bounds, { padding: padding(), maxZoom: 16, duration: 500 }); fitted.current = route;
    } else if (follow && position) {
      map.easeTo({ center: position, zoom: 16, bearing: heading ?? map.getBearing(), duration: 500, padding: padding() });
    } else if (!route && target) map.easeTo({ center: target, zoom: 14, duration: 500 });
  }
  const updateRef = useRef(updateMap); updateRef.current = updateMap;
  useEffect(() => {
    const token = import.meta.env.VITE_LOVABLE_CONNECTOR_MAPBOX_PUBLIC_TOKEN;
    if (!container.current || !token) { setMapError('Mapa indisponível: conexão Mapbox não configurada.'); return; }
    let map: mapboxgl.Map;
    try { map = new mapboxgl.Map({ container: container.current, accessToken: token, style: 'mapbox://styles/mapbox/streets-v12', ...(latest.current.target || latest.current.position ? { center: latest.current.target ?? latest.current.position ?? undefined, zoom: 14 } : {}) }); }
    catch { setMapError('Não foi possível iniciar o mapa. Verifique o suporte gráfico do navegador.'); return; }
    mapRef.current = map;
    const redraw = () => { fitted.current = null; updateRef.current(true); };
    // style.load can precede isStyleLoaded() becoming true. Retry at idle,
    // but only when missing layers so setData never creates a render loop.
    const restore = () => { if (latest.current.route && (!map.getLayer(ROUTE_LINE) || !map.getLayer(ROUTE_CASING))) redraw(); };
    const failure = (event: mapboxgl.ErrorEvent) => { setMapError(`Falha ao carregar o mapa: ${event.error.message}`); };
    const resize = () => { map.resize(); updateRef.current(true); };
    map.on('load', redraw); map.on('style.load', redraw); map.on('idle', restore); map.on('error', failure);
    const observer = new ResizeObserver(resize); observer.observe(container.current);
    map.addControl(new mapboxgl.NavigationControl(), 'bottom-left');
    return () => { observer.disconnect(); map.off('load', redraw); map.off('style.load', redraw); map.off('idle', restore); map.off('error', failure); driverRef.current?.remove(); targetRef.current?.remove(); driverRef.current = null; targetRef.current = null; map.remove(); mapRef.current = null; };
  }, []);
  useEffect(() => { updateRef.current(); }, [props.position, props.target, props.heading, props.follow, props.centerRequest, props.route]);
  return <div className="absolute inset-0 [&_.mapboxgl-ctrl-bottom-left]:bottom-[320px]" aria-label="Mapa de navegação Mapbox"><span ref={colors} className="hidden text-brand bg-background" /><div ref={container} className="h-full w-full" />{mapError && <div role="alert" className="absolute inset-x-3 top-1/3 z-20 rounded-lg bg-background p-3 text-sm text-destructive">{mapError}</div>}</div>;
}
