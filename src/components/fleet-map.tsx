import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { fleetColor } from "@/lib/vehicles";

const TOKEN = import.meta.env.VITE_LOVABLE_CONNECTOR_MAPBOX_PUBLIC_TOKEN as string | undefined;
if (TOKEN) mapboxgl.accessToken = TOKEN;

export type FleetVehicle = {
  id: string;
  plate: string;
  model?: string | null;
  status: string;
  lat: number;
  lng: number;
  speed?: number | null;
  driverName?: string | null;
  driverPhone?: string | null;
  photoUrl?: string | null;
  order?: {
    id: string;
    tracking_code: string;
    client_name?: string | null;
    origin_city?: string | null;
    destination_city?: string | null;
    status: string;
    eta_minutes?: number | null;
    distance_km?: number | null;
    initial_distance_km?: number | null;
    cargo?: string | null;
    weight?: number | null;
    volumes?: number | null;
    last_ping_at?: string | null;
  } | null;
};

export function FleetMap({
  vehicles,
  className,
  onSelect,
}: {
  vehicles: FleetVehicle[];
  className?: string;
  onSelect?: (v: FleetVehicle) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const readyRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || !TOKEN) return;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-51.9253, -14.235],
      zoom: 3.5,
      attributionControl: false,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => {
      readyRef.current = true;
      renderMarkers();
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
      readyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function renderMarkers() {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const seen = new Set<string>();
    for (const v of vehicles) {
      if (!Number.isFinite(v.lat) || !Number.isFinite(v.lng)) continue;
      seen.add(v.id);
      let m = markersRef.current.get(v.id);
      const color = fleetColor(v.status);
      if (!m) {
        const el = document.createElement("button");
        el.type = "button";
        el.style.cssText = `width:26px;height:26px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3);cursor:pointer;display:grid;place-items:center;color:white;font-size:12px;font-weight:700`;
        el.textContent = "🚚";
        el.title = `${v.plate} — ${v.status}`;
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onSelect?.(v);
        });
        m = new mapboxgl.Marker({ element: el }).setLngLat([v.lng, v.lat]).addTo(map);
        markersRef.current.set(v.id, m);
      } else {
        m.setLngLat([v.lng, v.lat]);
        const el = m.getElement() as HTMLElement;
        el.style.background = color;
      }
    }
    // remove stale
    for (const [id, m] of markersRef.current.entries()) {
      if (!seen.has(id)) {
        m.remove();
        markersRef.current.delete(id);
      }
    }
    // fit bounds first time we get points
    const pts = vehicles
      .filter((v) => Number.isFinite(v.lat) && Number.isFinite(v.lng))
      .map((v) => [v.lng, v.lat] as [number, number]);
    if (pts.length >= 2) {
      const bounds = pts.reduce(
        (b, p) => b.extend(p as mapboxgl.LngLatLike),
        new mapboxgl.LngLatBounds(pts[0], pts[0]),
      );
      map.fitBounds(bounds, { padding: 80, maxZoom: 11, duration: 600 });
    } else if (pts.length === 1) {
      map.easeTo({ center: pts[0], zoom: 11, duration: 600 });
    }
  }

  useEffect(() => {
    renderMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicles]);

  if (!TOKEN) {
    return (
      <div className={className}>
        <div className="grid h-full min-h-[320px] place-items-center rounded-2xl bg-surface-2 text-sm text-muted-foreground">
          Mapbox não configurado.
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className={className} />;
}
