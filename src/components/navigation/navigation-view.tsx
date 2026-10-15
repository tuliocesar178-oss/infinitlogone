import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Button } from "@/components/ui/button";
import { navTarget } from "@/lib/geofence";
import { buildNavUrl } from "@/lib/nav-launcher";
import { ArrowUp, LocateFixed, MapPin, RotateCcw, Volume2, VolumeX } from "lucide-react";

const TOKEN = import.meta.env.VITE_LOVABLE_CONNECTOR_MAPBOX_PUBLIC_TOKEN as string | undefined;
const SOURCE_ID = "navigation-remaining-route";
const LAYER_ID = "navigation-remaining-route-line";

type NavigationOrder = {
  id: string;
  status: string;
  origin_lat: number | null;
  origin_lng: number | null;
  origin_address: string;
  destination_lat: number | null;
  destination_lng: number | null;
  destination_address: string;
};

type Position = { lat: number; lng: number };
type RouteStep = {
  distance: number;
  duration: number;
  name: string;
  maneuver: { type: string; modifier?: string; instruction?: string };
};
type RouteData = {
  coordinates: [number, number][];
  cumulative: number[];
  distance: number;
  duration: number;
  steps: RouteStep[];
};

function distanceMeters(a: Position, b: Position) {
  const rad = Math.PI / 180;
  const x = (b.lng - a.lng) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  const y = (b.lat - a.lat) * rad;
  return Math.hypot(x, y) * 6_371_000;
}

function projectOnRoute(position: Position, route: RouteData) {
  let best = { distance: Infinity, progress: 0, point: route.coordinates[0] };
  for (let i = 0; i < route.coordinates.length - 1; i++) {
    const a = route.coordinates[i];
    const b = route.coordinates[i + 1];
    const latitude = (a[1] + b[1]) / 2;
    const scaleX = Math.cos((latitude * Math.PI) / 180);
    const bx = (b[0] - a[0]) * scaleX;
    const by = b[1] - a[1];
    const px = (position.lng - a[0]) * scaleX;
    const py = position.lat - a[1];
    const denominator = bx * bx + by * by;
    const t = denominator ? Math.max(0, Math.min(1, (px * bx + py * by) / denominator)) : 0;
    const point: [number, number] = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const gap = distanceMeters(position, { lng: point[0], lat: point[1] });
    const segmentLength = distanceMeters({ lng: a[0], lat: a[1] }, { lng: b[0], lat: b[1] });
    const progress = route.cumulative[i] + segmentLength * t;
    if (gap < best.distance) best = { distance: gap, progress, point };
  }
  return best;
}

function remainingCoordinates(route: RouteData, progress: number, start: [number, number]) {
  let index = route.cumulative.findIndex((value, i) => i < route.cumulative.length - 1 && value <= progress && route.cumulative[i + 1] >= progress);
  if (index < 0) index = route.coordinates.length - 2;
  return [start, ...route.coordinates.slice(index + 1)];
}

function maneuverLabel(step?: RouteStep) {
  if (!step) return "Siga até o destino";
  return step.maneuver.instruction || "Continue pela rota";
}

export function NavigationView({ order }: { order: NavigationOrder }) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const routeRef = useRef<RouteData | null>(null);
  const progressRef = useRef(0);
  const lastFixRef = useRef<{ position: Position; time: number } | null>(null);
  const offRouteCountRef = useRef(0);
  const rerouteBusyRef = useRef(false);
  const cameraAtRef = useRef(0);

  const target = useMemo(() => navTarget(order.status, order), [order]);
  const [position, setPosition] = useState<Position | null>(null);
  const [progress, setProgress] = useState(0);
  const [route, setRoute] = useState<RouteData | null>(null);
  const [gpsMessage, setGpsMessage] = useState("Aguardando sinal do GPS…");
  const [routeMessage, setRouteMessage] = useState("");
  const [following, setFollowing] = useState(true);
  const [rerouting, setRerouting] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);

  const destination = useMemo(
    () =>
      target.lat != null && target.lng != null
        ? { lat: target.lat, lng: target.lng }
        : null,
    [target.lat, target.lng],
  );

  const drawRemaining = useCallback((activeRoute: RouteData, current: Position, currentProgress: number) => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const source = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    const coordinates = remainingCoordinates(activeRoute, currentProgress, [current.lng, current.lat]);
    const data: GeoJSON.Feature<GeoJSON.LineString> = {
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates },
    };
    if (source) {
      source.setData(data);
    } else {
      map.addSource(SOURCE_ID, { type: "geojson", data });
      map.addLayer({
        id: LAYER_ID,
        type: "line",
        source: SOURCE_ID,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#1769ff", "line-width": 7, "line-opacity": 0.92 },
      });
    }
  }, []);

  const fetchRoute = useCallback(async (from: Position, recalculate = false) => {
    if (!TOKEN || !destination || rerouteBusyRef.current) return;
    rerouteBusyRef.current = true;
    if (recalculate) setRerouting(true);
    try {
      const coordinates = `${from.lng},${from.lat};${destination.lng},${destination.lat}`;
      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coordinates}?overview=full&geometries=geojson&steps=true&voice_instructions=true&banner_instructions=true&language=pt&access_token=${TOKEN}`,
      );
      if (!response.ok) throw new Error("O serviço de rotas está indisponível no momento.");
      const result = await response.json();
      const found = result?.routes?.[0];
      const points = found?.geometry?.coordinates as [number, number][] | undefined;
      if (!points || points.length < 2) throw new Error("Não foi possível obter uma rota para este destino.");

      const cumulative = [0];
      for (let i = 1; i < points.length; i++) {
        cumulative.push(
          cumulative[i - 1] +
            distanceMeters(
              { lng: points[i - 1][0], lat: points[i - 1][1] },
              { lng: points[i][0], lat: points[i][1] },
            ),
        );
      }
      const nextRoute: RouteData = {
        coordinates: points,
        cumulative,
        distance: Number(found.distance) || cumulative[cumulative.length - 1],
        duration: Number(found.duration) || 0,
        steps: (found.legs?.[0]?.steps ?? []) as RouteStep[],
      };
      routeRef.current = nextRoute;
      progressRef.current = 0;
      setProgress(0);
      setRoute(nextRoute);
      setRouteMessage("");
      drawRemaining(nextRoute, from, 0);
    } catch (error) {
      setRouteMessage(
        error instanceof Error ? error.message : "Não foi possível atualizar a rota. Mantendo o último trajeto disponível.",
      );
    } finally {
      rerouteBusyRef.current = false;
      setRerouting(false);
    }
  }, [destination, drawRemaining]);

  useEffect(() => {
    if (!TOKEN || !mapContainer.current || mapRef.current) return;
    mapboxgl.accessToken = TOKEN;
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: destination ? [destination.lng, destination.lat] : [-46.63, -23.55],
      zoom: 12,
      attributionControl: false,
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.on("dragstart", () => setFollowing(false));
    map.on("style.load", () => {
      const currentRoute = routeRef.current;
      const currentPosition = lastFixRef.current?.position;
      if (currentRoute && currentPosition) {
        drawRemaining(currentRoute, currentPosition, progressRef.current);
      }
    });
    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [destination, drawRemaining]);

  useEffect(() => {
    if (!destination) {
      setRouteMessage("As coordenadas do destino não estão cadastradas para este frete.");
      return;
    }
    if (!("geolocation" in navigator)) {
      setGpsMessage("Este dispositivo não disponibiliza localização GPS.");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (fix) => {
        const current = { lat: fix.coords.latitude, lng: fix.coords.longitude };
        const now = Date.now();
        const previous = lastFixRef.current;
        setGpsMessage(fix.coords.accuracy > 60 ? "Sinal GPS impreciso; aguardando uma posição melhor." : "");
        if (fix.coords.accuracy > 100) return;

        if (previous) {
          const elapsedSeconds = Math.max(1, (now - previous.time) / 1000);
          const moved = distanceMeters(previous.position, current);
          const maxPlausible = Math.max(180, elapsedSeconds * 65);
          if (moved > maxPlausible) return;
        }
        lastFixRef.current = { position: current, time: now };
        setPosition(current);

        const map = mapRef.current;
        if (!map) return;
        if (!markerRef.current) {
          const element = document.createElement("div");
          element.className = "grid h-8 w-8 place-items-center rounded-full border-[3px] border-background bg-primary text-primary-foreground shadow-lg";
          element.innerHTML = '<div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:14px solid currentColor"></div>';
          markerRef.current = new mapboxgl.Marker({ element, anchor: "center" }).setLngLat([current.lng, current.lat]).addTo(map);
        } else {
          markerRef.current.setLngLat([current.lng, current.lat]);
        }

        const activeRoute = routeRef.current;
        if (!activeRoute) {
          void fetchRoute(current);
        } else {
          const projected = projectOnRoute(current, activeRoute);
          const accuracyLimit = Math.max(45, Math.min(90, fix.coords.accuracy * 1.8));
          const elapsedSeconds = previous ? Math.max(1, (now - previous.time) / 1000) : 1;
          const maxAdvance = Math.max(150, elapsedSeconds * Math.max(15, (fix.coords.speed ?? 0) * 2.5) + 50);
          if (projected.distance <= accuracyLimit && projected.progress >= progressRef.current - 20 &&
              projected.progress <= progressRef.current + maxAdvance) {
            offRouteCountRef.current = 0;
            progressRef.current = Math.max(progressRef.current, projected.progress);
            setProgress(progressRef.current);
            drawRemaining(activeRoute, current, progressRef.current);
          } else if (projected.distance > accuracyLimit) {
            offRouteCountRef.current += 1;
            if (offRouteCountRef.current >= 3) {
              offRouteCountRef.current = 0;
              void fetchRoute(current, true);
            }
          }
        }

        if (following && now - cameraAtRef.current > 900) {
          cameraAtRef.current = now;
          const heading = fix.coords.speed != null && fix.coords.speed > 2 && fix.coords.heading != null
            ? fix.coords.heading
            : map.getBearing();
          map.easeTo({
            center: [current.lng, current.lat],
            bearing: heading,
            zoom: fix.coords.speed != null && fix.coords.speed > 20 ? 14.5 : 16,
            duration: 700,
            offset: [0, 90],
          });
        }
      },
      (error) => {
        setGpsMessage(
          error.code === error.PERMISSION_DENIED
            ? "Permita o acesso à localização para acompanhar a navegação."
            : "Sinal GPS indisponível. A última rota válida será mantida.",
        );
      },
      { enableHighAccuracy: true, maximumAge: 2500, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [destination, drawRemaining, fetchRoute, following]);

  const remainingDistance = route ? Math.max(0, route.distance - progress) : null;
  const remainingDuration = route && route.distance > 0
    ? route.duration * ((remainingDistance ?? route.distance) / route.distance)
    : null;
  const stepBefore = route?.steps.reduce((sum, item, index) =>
    index < (route.steps.findIndex((step, i) =>
      sum + step.distance > progress && i === index
    )) ? sum + item.distance : sum, 0);
  const nextStepIndex = route?.steps.findIndex((step, index) => {
    const before = route.steps.slice(0, index).reduce((sum, item) => sum + item.distance, 0);
    return before + step.distance > progress;
  }) ?? -1;
  const nextStep = nextStepIndex >= 0 ? route?.steps[nextStepIndex] : undefined;
  const distanceToTurn = route && nextStepIndex >= 0
    ? Math.max(0, route.steps.slice(0, nextStepIndex).reduce((sum, step) => sum + step.distance, 0) + (nextStep?.distance ?? 0) - progress)
    : null;

  useEffect(() => {
    if (!voiceEnabled || !nextStep) return;
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(maneuverLabel(nextStep)));
    }
  }, [voiceEnabled, nextStep]);

  const centerOnDriver = () => {
    setFollowing(true);
    if (position) mapRef.current?.easeTo({ center: [position.lng, position.lat], zoom: 16, duration: 500 });
  };

  const externalNavigation = (provider: "google" | "waze") => {
    try {
      const url = buildNavUrl(provider, { lat: target.lat, lng: target.lng, label: target.address }, position ?? undefined);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      setRouteMessage("Não foi possível abrir a navegação externa: o destino não está cadastrado.");
    }
  };

  if (!TOKEN) {
    return <div className="grid min-h-[60vh] place-items-center p-6 text-center text-muted-foreground">Mapa indisponível: a integração Mapbox não está configurada.</div>;
  }

  return (
    <main className="fixed inset-0 z-50 overflow-hidden bg-background">
      <div ref={mapContainer} className="absolute inset-0" aria-label="Mapa da navegação" />

      <section className="absolute left-3 right-3 top-3 z-10 mx-auto flex max-w-2xl items-center gap-3 rounded-2xl bg-background/95 p-4 shadow-xl backdrop-blur">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
          <ArrowUp className="h-7 w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-muted-foreground">
            {distanceToTurn != null ? `${distanceToTurn >= 1000 ? `${(distanceToTurn / 1000).toFixed(1)} km` : `${Math.round(distanceToTurn)} m`} até a manobra` : "Navegação"}
          </div>
          <div className="truncate font-semibold">{maneuverLabel(nextStep)}</div>
          <div className="truncate text-xs text-muted-foreground">{nextStep?.name || target.address}</div>
        </div>
        <Button size="icon" variant="ghost" aria-label={voiceEnabled ? "Desativar instruções por voz" : "Ativar instruções por voz"} onClick={() => setVoiceEnabled((value) => !value)}>
          {voiceEnabled ? <Volume2 /> : <VolumeX />}
        </Button>
        <Button size="icon" variant="ghost" aria-label="Voltar aos fretes" onClick={() => window.history.back()}>
          <MapPin />
        </Button>
      </section>

      {(gpsMessage || routeMessage || rerouting) && (
        <div role="status" className="absolute left-4 right-4 top-24 z-10 mx-auto max-w-xl rounded-xl border border-border bg-background/95 px-4 py-2 text-sm shadow-lg">
          {rerouting ? "Recalculando a rota…" : routeMessage || gpsMessage}
        </div>
      )}

      <section className="absolute bottom-3 left-3 right-3 z-10 mx-auto max-w-2xl rounded-2xl bg-background/95 p-4 shadow-xl backdrop-blur">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <div className="text-xs text-muted-foreground">Distância restante</div>
            <div className="text-2xl font-bold">{remainingDistance == null ? "—" : `${(remainingDistance / 1000).toFixed(1)} km`}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Tempo estimado</div>
            <div className="font-semibold">{remainingDuration == null ? "—" : `${Math.max(1, Math.round(remainingDuration / 60))} min`}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Chegada prevista</div>
            <div className="font-semibold">{remainingDuration == null ? "—" : new Date(Date.now() + remainingDuration * 1000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>
          </div>
        </div>
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${route?.distance ? Math.min(100, (progress / route.distance) * 100) : 0}%` }} />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Button variant="outline" size="sm" onClick={() => position && void fetchRoute(position, true)} disabled={!position || rerouting}>
            <RotateCcw /> Recalcular
          </Button>
          <Button variant="outline" size="sm" onClick={() => externalNavigation("google")}>Google Maps</Button>
          <Button variant="outline" size="sm" onClick={() => externalNavigation("waze")}>Waze</Button>
          <Button variant={following ? "default" : "outline"} size="sm" onClick={centerOnDriver}>
            <LocateFixed /> Centralizar
          </Button>
        </div>
      </section>
    </main>
  );
}