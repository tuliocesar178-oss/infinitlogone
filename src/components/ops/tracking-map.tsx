import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import type { Feature, Geometry } from "geojson";
import "mapbox-gl/dist/mapbox-gl.css";
import { TRACK_KIND, type TrackKind } from "@/lib/tracking-center";
import { Layers, Maximize2, Crosshair, Route as RouteIcon, Satellite, TrafficCone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const RAW_TOKEN = import.meta.env.VITE_LOVABLE_CONNECTOR_MAPBOX_PUBLIC_TOKEN as string | undefined;
const TOKEN = RAW_TOKEN?.trim().replace(/^['"]|['"]$/g, "");
if (TOKEN) mapboxgl.accessToken = TOKEN;

export type MapUnit = {
  id: string;
  lat: number;
  lng: number;
  kind: TrackKind;
  title: string;
  subtitle?: string;
  avatarUrl?: string | null;
  statusLabel?: string;
  heading?: number | null;
};

export type MapPin = { lng: number; lat: number; color: string; label: string };

const BRAZIL_CENTER: [number, number] = [-51.9253, -14.235];
const STYLES = {
  streets: "mapbox://styles/mapbox/streets-v12",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
} as const;

const FALLBACK_STYLE: mapboxgl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

type MarkerEntry = {
  marker: mapboxgl.Marker;
  el: HTMLDivElement;
  bubble: HTMLDivElement;
  badge: HTMLDivElement;
  media: HTMLDivElement;
  from: [number, number];
  to: [number, number];
  start: number;
  raf: number | null;
};

const ANIM_MS = 900;

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
  routes = [],
}: {
  units: MapUnit[];
  pins?: MapPin[];
  planned?: Geometry | null;
  traveled?: [number, number][] | null;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  focusToken?: number;
  fitToken?: number;
  className?: string;
  routes?: { id: string; geometry: GeoJSON.LineString; critical?: boolean }[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<Map<string, MarkerEntry>>(new Map());
  const pinMarkers = useRef<mapboxgl.Marker[]>([]);
  const ready = useRef(false);
  const firstStyle = useRef(true);
  const fallbackApplied = useRef(false);
  const [style, setStyle] = useState<keyof typeof STYLES>("streets");
  const [traffic, setTraffic] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const latestLines = useRef({ planned, traveled, routes, selectedId });
  latestLines.current = { planned, traveled, routes, selectedId };
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;

  useEffect(() => {
    if (!containerRef.current || !TOKEN || mapRef.current) return;
    let map: mapboxgl.Map;
    try {
      map = new mapboxgl.Map({
        container: containerRef.current,
        style: STYLES.streets,
        center: BRAZIL_CENTER,
        zoom: 3.4,
        attributionControl: false,
        antialias: true,
        failIfMajorPerformanceCaveat: false,
      });
    } catch (error) {
      setMapError(error instanceof Error ? error.message : "Não foi possível iniciar o mapa.");
      return;
    }
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), "top-right");
    map.addControl(new mapboxgl.FullscreenControl(), "top-right");
    map.addControl(new mapboxgl.ScaleControl({ unit: "metric" }), "bottom-left");
    map.on("error", (e) => {
      const message = e?.error?.message ?? "Falha ao carregar o estilo do mapa.";
      console.error("[mapbox]", message);
      if (!fallbackApplied.current && !mapLoaded) {
        fallbackApplied.current = true;
        map.setStyle(FALLBACK_STYLE);
        setMapError("O estilo principal ficou indisponível; exibindo mapa alternativo.");
      }
    });
    map.on("style.load", () => {
      ready.current = true;
      setMapLoaded(true);
      map.resize();
      drawLines();
      applyTraffic();
    });
    map.on("load", () => map.resize());
    map.on("idle", () => {
      if (!map.isStyleLoaded()) return;
      if (!map.getLayer("board-routes-line") || !map.getLayer("planned-route") || !map.getLayer("traveled-route")) drawLines();
    });
    map.on("click", "board-routes-line", e => {
      const id = e.features?.[0]?.properties?.id;
      if (typeof id === "string") selectRef.current?.(id);
    });
    mapRef.current = map;

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);
    const t = window.setTimeout(() => map.resize(), 300);

    return () => {
      window.clearTimeout(t);
      ro.disconnect();
      markers.current.forEach((m) => m.raf && cancelAnimationFrame(m.raf));
      map.remove();
      mapRef.current = null;
      markers.current.clear();
      ready.current = false;
      fallbackApplied.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (firstStyle.current) {
      firstStyle.current = false;
      return;
    }
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

  function setLine(id: string, coords: [number, number][] | null, color: string, width: number) {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    const data: Feature = {
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: coords ?? [] },
    };
    const src = map.getSource(id) as mapboxgl.GeoJSONSource | undefined;
    if (src) {
      src.setData(data);
    } else map.addSource(id, { type: "geojson", data });
    if (!map.getLayer(id)) map.addLayer({
      id,
      type: "line",
      source: id,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": color, "line-width": width, "line-opacity": 0.9 },
    });
    if (id === "planned-route" && !map.getLayer("planned-route-arrows")) {
      map.addLayer({
        id: "planned-route-arrows",
        type: "symbol",
        source: id,
        layout: {
          "symbol-placement": "line",
          "symbol-spacing": 90,
          "text-field": "▶",
          "text-size": 13,
          "text-keep-upright": false,
          "text-allow-overlap": true,
        },
        paint: { "text-color": "#1d4ed8", "text-halo-color": "#ffffff", "text-halo-width": 1.4 },
      });
    }
  }

  function drawLines() {
    const { planned, traveled, routes, selectedId } = latestLines.current;
    const plannedCoords =
      planned && planned.type === "LineString" ? (planned.coordinates as [number, number][]) : null;
    setLine("planned-route", plannedCoords, "#2563eb", 5);
    setLine("traveled-route", traveled ?? null, "#22c55e", 5);
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const data: GeoJSON.FeatureCollection<GeoJSON.LineString> = { type: "FeatureCollection", features: routes.map(r => ({type:"Feature", geometry:r.geometry, properties:{id:r.id, selected:r.id===selectedId, muted:Boolean(selectedId && r.id!==selectedId),critical:Boolean(r.critical)}})) };
    const src=map.getSource("board-routes") as mapboxgl.GeoJSONSource | undefined;
    if(src) src.setData(data); else map.addSource("board-routes",{type:"geojson",data});
    const resolveColor=(token:string)=>{const el=document.createElement("span"); el.style.color=`var(${token})`; containerRef.current?.appendChild(el); const color=getComputedStyle(el).color; const canvas=document.createElement("canvas"); const ctx=canvas.getContext("2d"); if(!ctx){el.remove();return color;} ctx.fillStyle=color;ctx.fillRect(0,0,1,1); const pixel=ctx.getImageData(0,0,1,1).data;el.remove();return `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;};
    if(!map.getLayer("board-routes-line")) {
      map.addLayer({id:"board-routes-line",type:"line",source:"board-routes",layout:{"line-cap":"round","line-join":"round"},paint:{"line-color":["case",["get","critical"],resolveColor("--destructive"),resolveColor("--brand")],"line-width":["case",["get","selected"],8,4],"line-opacity":["case",["get","muted"],0.25,0.95]}});
    }
    const coordinates=routes.filter(r=>!selectedId || r.id===selectedId).flatMap(r=>r.geometry.coordinates);
    if(coordinates.length && map.getSource("board-routes") && map.getLayer("board-routes-line")) {
      const signature=routes.map(r=>r.id).join(",")+selectedId;
      if(containerRef.current?.dataset.routeFit!==signature) {
        if(containerRef.current) containerRef.current.dataset.routeFit=signature;
        const bounds=new mapboxgl.LngLatBounds();for(const p of coordinates) bounds.extend([p[0],p[1]]);
        map.fitBounds(bounds,{padding:75,maxZoom:13,duration:600});
      }
    }
  }

  useEffect(drawLines, [planned, traveled, routes, selectedId, mapLoaded]);

  // markers — created once, then animated to new positions
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();

    for (const u of units) {
      if (!Number.isFinite(u.lat) || !Number.isFinite(u.lng)) continue;
      seen.add(u.id);
      const color = TRACK_KIND[u.kind].color;
      let entry = markers.current.get(u.id);

      if (!entry) {
        const el = document.createElement("div");
        el.style.cssText = "display:flex;flex-direction:column;align-items:center;cursor:pointer;";

        const bubble = document.createElement("div");
        bubble.style.cssText =
          "max-width:170px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:3px 8px;border-radius:9999px;background:rgba(255,255,255,.97);color:#0f172a;font-size:11px;font-weight:800;box-shadow:0 2px 8px rgba(0,0,0,.25);margin-bottom:4px;";

        const media = document.createElement("div");
        media.style.cssText =
          "position:relative;width:38px;height:38px;border-radius:9999px;display:grid;place-items:center;overflow:hidden;font-size:17px;background:#fff;transition:transform .2s ease;";

        const badge = document.createElement("div");
        badge.style.cssText =
          "margin-top:3px;padding:1px 6px;border-radius:9999px;font-size:9px;font-weight:800;color:#fff;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.25);";

        el.append(bubble, media, badge);
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          selectRef.current?.(u.id);
        });

        const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([u.lng, u.lat])
          .addTo(map);
        entry = {
          marker,
          el,
          bubble,
          badge,
          media,
          from: [u.lng, u.lat],
          to: [u.lng, u.lat],
          start: performance.now(),
          raf: null,
        };
        markers.current.set(u.id, entry);
      } else if (entry.to[0] !== u.lng || entry.to[1] !== u.lat) {
        // smooth move: never recreate the marker
        const current = entry.marker.getLngLat();
        entry.from = [current.lng, current.lat];
        entry.to = [u.lng, u.lat];
        entry.start = performance.now();
        if (entry.raf) cancelAnimationFrame(entry.raf);
        const e = entry;
        const step = () => {
          const k = Math.min(1, (performance.now() - e.start) / ANIM_MS);
          const t = k < 0.5 ? 2 * k * k : -1 + (4 - 2 * k) * k;
          e.marker.setLngLat([
            e.from[0] + (e.to[0] - e.from[0]) * t,
            e.from[1] + (e.to[1] - e.from[1]) * t,
          ]);
          e.raf = k < 1 ? requestAnimationFrame(step) : null;
        };
        e.raf = requestAnimationFrame(step);
      }

      const isSel = selectedId === u.id;
      entry.bubble.textContent = u.title;
      entry.badge.textContent = u.statusLabel ?? TRACK_KIND[u.kind].label;
      entry.badge.style.background = color;
      entry.el.title = `${u.title}${u.subtitle ? ` — ${u.subtitle}` : ""}`;
      entry.media.style.border = `3px solid ${color}`;
      entry.media.style.boxShadow = isSel
        ? `0 0 0 6px ${color}44, 0 4px 12px rgba(0,0,0,.35)`
        : "0 3px 10px rgba(0,0,0,.3)";
      entry.media.style.transform = isSel ? "scale(1.18)" : "scale(1)";
      entry.el.style.zIndex = isSel ? "5" : "1";

      const avatar = u.avatarUrl ?? "";
      if (entry.media.dataset.avatar !== avatar) {
        entry.media.dataset.avatar = avatar;
        entry.media.replaceChildren();
        if(avatar) { const img=document.createElement("img");img.src=avatar;img.alt="";img.style.cssText="width:100%;height:100%;object-fit:cover";entry.media.appendChild(img); }
        else { const icon=document.createElementNS("http://www.w3.org/2000/svg","svg");icon.setAttribute("viewBox","0 0 24 24");icon.setAttribute("width","24");icon.setAttribute("height","24");const path=document.createElementNS("http://www.w3.org/2000/svg","path");path.setAttribute("d","M1 3h13v12H1z M14 7h4l4 5v3h-8 M5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4 M18 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4");path.setAttribute("fill","none");path.setAttribute("stroke","currentColor");path.setAttribute("stroke-width","2");icon.appendChild(path);entry.media.appendChild(icon); }
      }
    }

    for (const [id, entry] of markers.current.entries()) {
      if (!seen.has(id)) {
        if (entry.raf) cancelAnimationFrame(entry.raf);
        entry.marker.remove();
        markers.current.delete(id);
      }
    }
  }, [units, selectedId, onSelect, mapLoaded]);

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
  }, [pins, mapLoaded]);

  // focus selected
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const u = units.find((x) => x.id === selectedId);
    if (u) map.flyTo({ center: [u.lng, u.lat], zoom: 13.5, duration: 1100, essential: true });
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
      <div ref={containerRef} className="tracking-map-canvas absolute inset-0 min-h-[320px] min-w-0 bg-surface-2" />

      {!mapLoaded && !mapError && (
        <div className="pointer-events-none absolute inset-0 z-[1] grid place-items-center bg-surface-2 text-sm font-semibold text-muted-foreground">
          Carregando mapa do Brasil…
        </div>
      )}
      {mapError && !mapLoaded && (
        <div className="pointer-events-none absolute inset-0 z-[1] grid place-items-center bg-surface-2 px-8 text-center text-sm font-semibold text-muted-foreground">
          {mapError}
        </div>
      )}

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
    <Button
      variant="ghost"
      type="button"
      onClick={onClick}
      className={cn("flex items-center gap-1.5 rounded-none px-3 py-2 text-[11px] font-bold",active ? "bg-brand text-brand-foreground" : "hover:bg-accent")}
    >
      {icon} {label}
    </Button>
  );
}

function IconBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button
      variant="outline"
      size="icon"
      type="button"
      title={title}
      onClick={onClick}
      className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-background/95 shadow-lg backdrop-blur hover:bg-accent"
    >
      {children}
    </Button>
  );
}
