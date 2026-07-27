import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const TOKEN = import.meta.env.VITE_LOVABLE_CONNECTOR_MAPBOX_PUBLIC_TOKEN as string | undefined;
if (TOKEN) mapboxgl.accessToken = TOKEN;

type LngLat = [number, number];

export function RouteMiniMap({
  origin,
  destination,
  driver,
  className,
}: {
  origin?: LngLat | null;
  destination?: LngLat | null;
  driver?: LngLat | null;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!ref.current || !TOKEN) return;
    if (mapRef.current) return;
    mapRef.current = new mapboxgl.Map({
      container: ref.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: origin ?? destination ?? [-46.63, -23.55],
      zoom: 4,
      interactive: false,
      attributionControl: false,
    });
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const draw = async () => {
      // Clear old markers
      (map as any)._markers?.forEach((m: mapboxgl.Marker) => m.remove());
      (map as any)._markers = [];
      const markers: mapboxgl.Marker[] = [];
      const bounds = new mapboxgl.LngLatBounds();

      if (origin) {
        const m = new mapboxgl.Marker({ color: "#10b981" }).setLngLat(origin).addTo(map);
        markers.push(m);
        bounds.extend(origin);
      }
      if (destination) {
        const m = new mapboxgl.Marker({ color: "#ef4444" }).setLngLat(destination).addTo(map);
        markers.push(m);
        bounds.extend(destination);
      }
      if (driver) {
        const el = document.createElement("div");
        el.style.cssText = "width:14px;height:14px;border-radius:9999px;background:#2563eb;border:2px solid white;box-shadow:0 0 0 2px #2563eb55;";
        const m = new mapboxgl.Marker({ element: el }).setLngLat(driver).addTo(map);
        markers.push(m);
        bounds.extend(driver);
      }
      (map as any)._markers = markers;

      // Draw route line
      if (map.getLayer("route")) map.removeLayer("route");
      if (map.getSource("route")) map.removeSource("route");
      if (origin && destination) {
        try {
          const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${origin.join(",")};${destination.join(",")}?geometries=geojson&overview=simplified&access_token=${TOKEN}`;
          const r = await fetch(url);
          const j = await r.json();
          const geom = j?.routes?.[0]?.geometry;
          if (geom) {
            if (!map.isStyleLoaded()) await new Promise((res) => map.once("load", res));
            map.addSource("route", { type: "geojson", data: { type: "Feature", properties: {}, geometry: geom } });
            map.addLayer({
              id: "route",
              type: "line",
              source: "route",
              layout: { "line-cap": "round", "line-join": "round" },
              paint: { "line-color": "#2563eb", "line-width": 3 },
            });
          }
        } catch {}
      }
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 30, maxZoom: 12, duration: 400 });
      }
    };
    if (map.isStyleLoaded()) draw();
    else map.once("load", draw);
  }, [origin?.[0], origin?.[1], destination?.[0], destination?.[1], driver?.[0], driver?.[1]]);

  if (!TOKEN) {
    return (
      <div className={`grid place-items-center rounded-xl bg-surface-2 text-xs text-muted-foreground ${className ?? "h-32"}`}>
        Mapa indisponível
      </div>
    );
  }
  return <div ref={ref} className={`overflow-hidden rounded-xl ${className ?? "h-32"}`} />;
}
