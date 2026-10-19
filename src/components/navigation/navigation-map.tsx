import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { NavigationRoute, Position } from '@/lib/navigation/model';
import { drawNavigationRoute, ROUTE_SOURCE, ROUTE_LINE, ROUTE_CASING, ROUTE_COMPLETED_LINE, validPosition } from '@/lib/navigation/map-route';

export interface NavigationMapProps {
  route: NavigationRoute | null;
  position: Position | null;
  target: Position | null;
  heading: number | null;
  follow: boolean;
  centerRequest: number;
  /** Incremented to show the whole remaining route. */
  overviewRequest: number;
  /** Called when the driver pans, zooms or rotates by hand. */
  onUserMove?: () => void;
}

/** Top-down truck in the brand colors; points "up" so rotation equals heading. */
function truckElement(): HTMLDivElement {
  const el = document.createElement('div');
  el.setAttribute('aria-label', 'Seu caminhão');
  el.className = 'text-brand';
  el.innerHTML = `<svg width="26" height="40" viewBox="0 0 26 40" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,.45))" aria-hidden="true">
    <rect x="3" y="12" width="20" height="26" rx="2" fill="hsl(222 60% 18%)" stroke="white" stroke-width="1.5"/>
    <rect x="4" y="2" width="18" height="11" rx="4" fill="currentColor" stroke="white" stroke-width="1.5"/>
    <rect x="7" y="4" width="12" height="3.5" rx="1" fill="white" opacity=".85"/>
  </svg>`;
  return el;
}

export default function NavigationMap(props: NavigationMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const latest = useRef(props); latest.current = props;
  const fitted = useRef<NavigationRoute | null>(null);
  const driverRef = useRef<mapboxgl.Marker | null>(null);
  const targetRef = useRef<mapboxgl.Marker | null>(null);
  const animation = useRef<number | null>(null);
  const lastCenter = useRef(0);
  const lastOverview = useRef(0);
  const [mapError, setMapError] = useState<string | null>(null);
  const colors = useRef<HTMLSpanElement>(null);
  const completedColor = useRef<HTMLSpanElement>(null);

  function mapColor(cssColor: string) {
    // Mapbox's color parser does not support the design system's OKLCH values.
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
    return { top: Math.min(height * .32, (topPanel?.bottom ?? 150) + 20), bottom: Math.min(height * .45, (bottomPanel?.height ?? 120) + 20), left: 35, right: 65 };
  }
  /** Glide the truck to the new fix instead of jumping. */
  function moveTruck(to: Position, heading: number | null) {
    const marker = driverRef.current;
    if (!marker) return;
    if (heading !== null) marker.setRotation(heading);
    const from = marker.getLngLat();
    if (animation.current) cancelAnimationFrame(animation.current);
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 800);
      marker.setLngLat([from.lng + (to[0] - from.lng) * t, from.lat + (to[1] - from.lat) * t]);
      animation.current = t < 1 ? requestAnimationFrame(step) : null;
    };
    animation.current = requestAnimationFrame(step);
  }
  function overview(map: mapboxgl.Map, route: NavigationRoute, position: Position | null) {
    const bounds = new mapboxgl.LngLatBounds();
    route.geometry.coordinates.forEach(coord => bounds.extend([coord[0], coord[1]]));
    if (position) bounds.extend(position);
    map.fitBounds(bounds, { padding: padding(), maxZoom: 16, pitch: 0, bearing: 0, duration: 600 });
  }
  function updateMap(forceFit = false) {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    const { route, position, target, heading, follow, centerRequest, overviewRequest } = latest.current;
    if (route && colors.current && completedColor.current) {
      try {
        drawNavigationRoute(map, route, {
          line: mapColor(getComputedStyle(colors.current).color),
          casing: mapColor(getComputedStyle(colors.current).backgroundColor),
          completed: mapColor(getComputedStyle(completedColor.current).color),
        }, position);
        setMapError(null);
      } catch { setMapError('A geometria da rota é inválida. Recalcule para tentar novamente.'); return; }
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
      if (!driverRef.current) driverRef.current = new mapboxgl.Marker({ element: truckElement(), rotationAlignment: 'map', pitchAlignment: 'map', rotation: heading ?? 0 }).setLngLat(position).addTo(map);
      else moveTruck(position, heading);
    }
    // Camera: overview on a new route or explicit request; follow only while
    // following. When the driver moved the map by hand, keep their view.
    const overviewAsked = overviewRequest !== lastOverview.current; lastOverview.current = overviewRequest;
    const centerAsked = centerRequest !== lastCenter.current; lastCenter.current = centerRequest;
    if (route && (fitted.current !== route || forceFit || overviewAsked)) { overview(map, route, position); fitted.current = route; }
    else if ((follow || centerAsked) && position) {
      map.easeTo({ center: position, zoom: centerAsked ? 17 : Math.max(map.getZoom(), 15), pitch: 55, bearing: heading ?? map.getBearing(), duration: 900, easing: t => t, padding: { ...padding(), top: (container.current?.clientHeight ?? 800) * .45 } });
    } else if (!route && target && forceFit) map.easeTo({ center: target, zoom: 14, duration: 500 });
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
    // style.load can precede isStyleLoaded(); retry at idle only when layers are missing.
    const restore = () => { if (latest.current.route && (!map.getLayer(ROUTE_LINE) || !map.getLayer(ROUTE_CASING) || !map.getLayer(ROUTE_COMPLETED_LINE))) redraw(); };
    const failure = (event: mapboxgl.ErrorEvent) => { setMapError(`Falha ao carregar o mapa: ${event.error.message}`); };
    // Only gestures carry originalEvent; programmatic camera moves do not.
    const manual = (event: object) => { if ('originalEvent' in event && event.originalEvent) latest.current.onUserMove?.(); };
    const resize = () => map.resize();
    map.on('load', redraw); map.on('style.load', redraw); map.on('idle', restore); map.on('error', failure);
    map.on('dragstart', manual); map.on('zoomstart', manual); map.on('rotatestart', manual); map.on('pitchstart', manual);
    const observer = new ResizeObserver(resize); observer.observe(container.current);
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    return () => {
      observer.disconnect();
      if (animation.current) cancelAnimationFrame(animation.current);
      map.off('load', redraw); map.off('style.load', redraw); map.off('idle', restore); map.off('error', failure);
      map.off('dragstart', manual); map.off('zoomstart', manual); map.off('rotatestart', manual); map.off('pitchstart', manual);
      driverRef.current?.remove(); targetRef.current?.remove(); driverRef.current = null; targetRef.current = null;
      map.remove(); mapRef.current = null;
    };
  }, []);
  useEffect(() => { updateRef.current(); }, [props.position, props.target, props.heading, props.follow, props.centerRequest, props.overviewRequest, props.route]);
  return <div className="absolute inset-0 [&_.mapboxgl-ctrl-top-right]:top-[38%]!" aria-label="Mapa de navegação Mapbox"><span ref={colors} className="hidden text-brand bg-background" /><span ref={completedColor} className="hidden text-muted-foreground" /><div ref={container} className="h-full w-full" />{mapError && <div role="alert" className="absolute inset-x-3 top-1/3 z-20 rounded-lg bg-background/95 p-3 text-sm text-destructive">{mapError}</div>}</div>;
}
