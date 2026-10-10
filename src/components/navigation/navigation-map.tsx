import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { NavigationRoute, Position } from '@/lib/navigation/model';
export interface NavigationMapProps { route: NavigationRoute | null; position: Position | null; target: Position | null; follow: boolean; centerRequest: number; }
export default function NavigationMap({ route, position, target, follow, centerRequest }: NavigationMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const driverRef = useRef<mapboxgl.Marker | null>(null);
  const targetRef = useRef<mapboxgl.Marker | null>(null);
  useEffect(() => {
    const token = import.meta.env.VITE_LOVABLE_CONNECTOR_MAPBOX_PUBLIC_TOKEN;
    if (!container.current || !token) return;
    const map = new mapboxgl.Map({ container: container.current, accessToken: token, style: 'mapbox://styles/mapbox/streets-v12', center: target ?? position ?? [0,0], zoom: 14 });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl(), 'bottom-left');
    return () => { driverRef.current?.remove(); targetRef.current?.remove(); map.remove(); mapRef.current = null; };
  }, []);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !route) return;
    const draw = () => {
      if (mapRef.current !== map) return;
      const data: GeoJSON.Feature = { type: 'Feature', properties: {}, geometry: route.geometry };
      const source = map.getSource('navigation-route') as mapboxgl.GeoJSONSource | undefined;
      if (source) source.setData(data);
      else {
        map.addSource('navigation-route', { type: 'geojson', data });
        const resolved = document.createElement('span'); resolved.className = 'text-primary'; document.body.appendChild(resolved);
        const primary = getComputedStyle(resolved).color; resolved.remove();
        map.addLayer({ id: 'navigation-route', type: 'line', source: 'navigation-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': primary, 'line-width': 6 } });
      }
    };
    if (map.isStyleLoaded()) draw(); else map.once('load', draw);
    return () => { map.off('load', draw); };
  }, [route]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (target) { if (!targetRef.current) { const el = document.createElement('div'); el.className = 'h-5 w-5 rounded-full border-4 border-background bg-destructive shadow-lg'; targetRef.current = new mapboxgl.Marker({ element: el }).addTo(map); } targetRef.current.setLngLat(target); }
    if (position) { if (!driverRef.current) { const el = document.createElement('div'); el.className = 'h-6 w-6 rounded-full border-4 border-background bg-primary shadow-lg'; driverRef.current = new mapboxgl.Marker({ element: el }).addTo(map); } driverRef.current.setLngLat(position); }
    if (follow && position) map.easeTo({ center: position, zoom: 16, duration: 500, padding: { top: 170, bottom: 310, left: 40, right: 40 } });
    else if (route) { const bounds = new mapboxgl.LngLatBounds(); route.geometry.coordinates.forEach(coord => bounds.extend([coord[0], coord[1]])); map.fitBounds(bounds, { padding: { top: 180, bottom: 330, left: 55, right: 55 }, maxZoom: 16 }); }
  }, [position, target, follow, centerRequest, route]);
  return <div ref={container} className="absolute inset-0" aria-label="Mapa de navegação Mapbox" />;
}
