import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { TRACK_KIND, type TrackKind } from "@/lib/tracking-center";
import { Layers, Maximize2, Crosshair, Route as RouteIcon, Satellite, TrafficCone } from "lucide-react";

const TOKEN = import.meta.env.VITE_LOVABLE_CONNECTOR_MAPBOX_PUBLIC_TOKEN as string | undefined;
if (TOKEN) mapboxgl.accessToken = TOKEN;

export type MapUnit = {
  id: string;
  lat: number;
  lng: number;
  kind: TrackKind;
  title: string;
  subtitle?: string;
  heading?: number | null;
};

export type MapPin = { lng: number; lat: number; color: string; label: string };

const BRAZIL_CENTER: [number, number] = [-51.9253, -14.235];
const STYLES = {
  streets: "mapbox://styles/mapbox/streets-v12",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
} as const;

export function TrackingMap({
  units,
  pins = [],
  planned,
  traveled,
  selectedId,
  onSelect,
  focusToken,
  fitToken,
  className,
}: {
  units: MapUnit[];
  pins?: MapPin[];
  planned?: GeoJSON.Geometry | null;
  traveled?: [number, number][] | null;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  focusToken?: number;
  fitToken?: number;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const pinMarkers = useRef<mapboxgl.Marker[]>([]);
  const ready = useRef(false);
  const [style, setStyle] = useState<keyof typeof STYLES>("streets");
  const [traffic, setTraffic] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !TOKEN || mapRef.current) return;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: STYLES.streets,
      center: BRAZIL_CENTER,
      zoom: 3.4,
      attributionControl: false,
    });
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), "top-right");
    map.addControl(new mapboxgl.FullscreenControl(), "top-right");
    map.addControl(new mapboxgl.ScaleControl({ unit: "metric" }), "bottom-left");
    map.on("style.load", () => {
      ready.current = true;
      drawLines();
      applyTraffic();
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markers.current.clear();
      ready.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    ready.current = false;
    mapRef.current.setStyle(STYLES[style]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style]);

  function applyTraffic() {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    const id = "traffic-layer";
    if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource("mapbox-traffic")) map.removeSource("mapbox-traffic");
    if (!traffic) return;
    map.addSource("mapbox-traffic", { type: "vector", url: "mapbox://mapbox.mapbox-traffic-v1" });
    map.addLayer({
      id,
      type: "line",
      source: "mapbox-traffic",
      "source-layer": "traffic",
      paint: {
        "line-width": 2,
        "line-color": [
          "match",
          ["get", "congestion"],
          "low", "#22c55e",
          "moderate", "#eab308",
          "heavy", "#f97316",
          "severe", "#ef4444",
          "#94a3b8",
        ],
      },
    });
  }

  useEffect(applyTraffic, [traffic]);

  function setLine(id: string, coords: [number, number][] | null, color: string, dashed: boolean) {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    const data: GeoJSON.Feature = {
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: coords ?? [] },
    };
    const src = map.getSource(id) as mapboxgl.GeoJSONSource | undefined;
    if (src) {
      src.setData(data);
      return;
    }
    map.addSource(id, { type: "geojson", data });
    map.addLayer({
      id,
      type: "line",
      source: id,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": color,
        "line-width": 5,
        "line-opacity": 0.85,
        ...(dashed ? { "line-dasharray": [1.5, 1.5] } : {}),
      },
    });
  }

  function drawLines() {
    const plannedCoords =
      planned && planned.type === "LineString" ? (planned.coordinates as [number, number][]) : null;
    setLine("planned-route", plannedCoords, "#2563eb", true);
    setLine("traveled-route", traveled ?? null, "#22c55e", false);
  }

  useEffect(drawLines, [planned, traveled]);

  // markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();
    for (const u of units) {
      if (!Number.isFinite(u.lat) || !Number.isFinite(u.lng)) continue;
      seen.add(u.id);
      const color = TRACK_KIND[u.kind].color;
      let m = markers.current.get(u.id);
      if (!m) {
        const el = document.createElement("button");
        el.type = "button";
        el.className = "tracking-marker";
        el.innerHTML = `<span>🚚</span>`;
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onSelect?.(u.id);
        });
        m = new mapboxgl.Marker({ element: el }).setLngLat([u.lng, u.lat]).addTo(map);
        markers.current.set(u.id, m);
      } else {
        m.setLngLat([u.lng, u.lat]);
      }
      const el = m.getElement();
      el.title = `${u.title}${u.subtitle ? ` — ${u.subtitle}` : ""}`;
      el.style.cssText = `width:30px;height:30px;border-radius:9999px;display:grid;place-items:center;font-size:13px;cursor:pointer;background:${color};border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.35);transition:transform .15s;${
        selectedId === u.id ? "transform:scale(1.35);outline:3px solid rgba(37,99,235,.45);" : ""
      }`;
    }
    for (const [id, m] of markers.current.entries()) {
      if (!seen.has(id)) {
        m.remove();
        markers.current.delete(id);
      }
    }
  }, [units, selectedId, onSelect]);

  // static pins (origem/destino/paradas)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    pinMarkers.current.forEach((m) => m.remove());
    pinMarkers.current = pins.map((p) =>
      new mapboxgl.Marker({ color: p.color })
        .setLngLat([p.lng, p.lat])
        .setPopup(new mapboxgl.Popup({ offset: 18 }).setText(p.label))
        .addTo(map),
    );
  }, [pins]);

  // focus selected
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const u = units.find((x) => x.id === selectedId);
    if (u) map.flyTo({ center: [u.lng, u.lat], zoom: 12, duration: 900 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusToken]);

  // fit all
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const pts = units.filter((u) => Number.isFinite(u.lat)).map((u) => [u.lng, u.lat] as [number, number]);
    if (pts.length === 0) {
      map.easeTo({ center: BRAZIL_CENTER, zoom: 3.4, duration: 700 });
      return;
    }
    if (pts.length === 1) {
      map.easeTo({ center: pts[0], zoom: 10, duration: 700 });
      return;
    }
    const b = pts.reduce((acc, p) => acc.extend(p), new mapboxgl.LngLatBounds(pts[0], pts[0]));
    map.fitBounds(b, { padding: 90, maxZoom: 11, duration: 700 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitToken]);

  if (!TOKEN) {
    return (
      <div className={className}>
        <div className="grid h-full min-h-[320px] place-items-center bg-surface-2 text-sm text-muted-foreground">
          Mapbox não configurado.
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className ?? ""}`}>
      <div ref={containerRef} className="absolute inset-0" />

      <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-col gap-2">
        <div className="pointer-events-auto flex overflow-hidden rounded-xl border border-border bg-background/95 shadow-lg backdrop-blur">
          <MapBtn active={style === "streets"} onClick={() => setStyle("streets")} icon={<Layers className="h-3.5 w-3.5" />} label="Mapa" />
          <MapBtn active={style === "satellite"} onClick={() => setStyle("satellite")} icon={<Satellite className="h-3.5 w-3.5" />} label="Satélite" />
          <MapBtn active={traffic} onClick={() => setTraffic((t) => !t)} icon={<TrafficCone className="h-3.5 w-3.5" />} label="Trânsito" />
        </div>
      </div>

      <div className="absolute bottom-3 right-3 z-10 flex gap-2">
        <IconBtn title="Centralizar no Brasil" onClick={() => mapRef.current?.easeTo({ center: BRAZIL_CENTER, zoom: 3.4, duration: 700 })}>
          <Crosshair className="h-4 w-4" />
        </IconBtn>
        <IconBtn
          title="Enquadrar operações"
          onClick={() => {
            const map = mapRef.current;
            const pts = units.map((u) => [u.lng, u.lat] as [number, number]);
            if (!map || !pts.length) return;
            const b = pts.reduce((acc, p) => acc.extend(p), new mapboxgl.LngLatBounds(pts[0], pts[0]));
            map.fitBounds(b, { padding: 90, maxZoom: 11, duration: 700 });
          }}
        >
          <RouteIcon className="h-4 w-4" />
        </IconBtn>
        <IconBtn title="Tela cheia" onClick={() => containerRef.current?.parentElement?.requestFullscreen?.()}>
          <Maximize2 className="h-4 w-4" />
        </IconBtn>
      </div>
    </div>
  );
}

function MapBtn({ active, onClick, icon, label }: { active?: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold ${active ? "bg-brand text-brand-foreground" : "hover:bg-accent"}`}
    >
      {icon} {label}
    </button>
  );
}

function IconBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-background/95 shadow-lg backdrop-blur hover:bg-accent"
    >
      {children}
    </button>
  );
}
