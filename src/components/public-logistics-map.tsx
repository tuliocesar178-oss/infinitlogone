import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
export default function PublicLogisticsMap() {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const token = import.meta.env.VITE_LOVABLE_CONNECTOR_MAPBOX_PUBLIC_TOKEN;
    if (!token || !container.current) { setFailed(true); return; }
    let disposed = false;
    let cleanup: (() => void) | undefined;
    void Promise.all([import('mapbox-gl'), import('mapbox-gl/dist/mapbox-gl.css')]).then(([module]) => {
      if (disposed || !container.current) return;
      const map = new module.default.Map({ container: container.current, accessToken: token, style: 'mapbox://styles/mapbox/light-v11', center: [-52, -15], zoom: 2.3, interactive: false, attributionControl: true });
      cleanup = () => map.remove();
      map.on('error', () => setFailed(true));
      map.on('load', () => {
        if (disposed) return;
        setFailed(false);
        map.addSource('illustrative-routes', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[-46.63,-23.55],[-44.0,-19.92],[-47.88,-15.79],[-38.5,-12.97]] } } });
        const probe = document.createElement('span'); probe.style.color = `var(--brand)`; document.body.append(probe); const rgb = getComputedStyle(probe).color; probe.remove();
        map.addLayer({ id: 'illustrative-routes', type: 'line', source: 'illustrative-routes', paint: { 'line-color': rgb, 'line-width': 3 } });
        for (const coordinates of [[-46.63,-23.55],[-38.5,-12.97]] as [number,number][]) {
          const marker = document.createElement('div'); marker.className = 'h-4 w-4 rounded-full border-2 border-background bg-brand shadow-card';
          new module.default.Marker({ element: marker }).setLngLat(coordinates).addTo(map);
        }
      });
    }).catch(() => setFailed(true));
    return () => { disposed = true; cleanup?.(); };
  }, []);
  return <div className="relative h-full w-full bg-accent" aria-label="Mapa ilustrativo de rotas logísticas no Brasil">
    <div ref={container} className="absolute inset-0"/>
    {failed && <div className="absolute inset-0 grid place-content-center gap-2 bg-accent text-center text-primary"><MapPin className="mx-auto h-10 w-10 text-brand"/><span>Conexões pelo Brasil</span></div>}
    <span className="absolute bottom-7 left-3 rounded bg-background/95 px-2 py-1 text-[10px] text-muted-foreground">Rotas ilustrativas · sem cargas em rastreamento</span>
  </div>;
}
