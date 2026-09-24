import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const TOKEN = import.meta.env.VITE_LOVABLE_CONNECTOR_MAPBOX_PUBLIC_TOKEN as
  | string
  | undefined;
if (TOKEN) mapboxgl.accessToken = TOKEN;

export type TripMapProps = {
  driver?: { lat: number; lng: number } | null;
  destination?: { lat: number; lng: number } | null;
  origin?: { lat: number; lng: number } | null;
  routeGeoJSON?: { type: "LineString"; coordinates: [number, number][] } | null;
  className?: string;
  interactive?: boolean;
  driverLabel?: string | null;
  vehicleLabel?: string | null;
};

export function TripMap({
  driver,
  destination,
  origin,
  routeGeoJSON,
  className,
  interactive = true,
  driverLabel,
  vehicleLabel,
}: TripMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const driverMarker = useRef<mapboxgl.Marker | null>(null);
  const destMarker = useRef<mapboxgl.Marker | null>(null);
  const originMarker = useRef<mapboxgl.Marker | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !TOKEN) return;
    const center: [number, number] = driver
      ? [driver.lng, driver.lat]
      : destination
        ? [destination.lng, destination.lat]
        : [-46.6333, -23.5505];
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center,
      zoom: 11,
      interactive,
      attributionControl: false,
    });
    mapRef.current = map;
    map.on("load", () => setReady(true));
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // update markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (destination) {
      if (!destMarker.current) {
        destMarker.current = new mapboxgl.Marker({ color: "#0d1b4a" })
          .setLngLat([destination.lng, destination.lat])
          .addTo(map);
      } else destMarker.current.setLngLat([destination.lng, destination.lat]);
    }
    if (origin) {
      if (!originMarker.current) {
        const el = document.createElement("div");
        el.style.cssText =
          "width:14px;height:14px;border-radius:50%;background:#94a3b8;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.3)";
        originMarker.current = new mapboxgl.Marker({ element: el })
          .setLngLat([origin.lng, origin.lat])
          .addTo(map);
      } else originMarker.current.setLngLat([origin.lng, origin.lat]);
    }
    if (driver) {
      if (!driverMarker.current) {
        const el = document.createElement("div");
        el.textContent = "🚚";
        el.style.cssText =
          "font-size:24px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.3));transition:transform 300ms ease";
        const popupText = [driverLabel, vehicleLabel].filter(Boolean).join(" · ");
        driverMarker.current = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([driver.lng, driver.lat])
          .setPopup(popupText ? new mapboxgl.Popup({ offset: 18 }).setText(popupText) : new mapboxgl.Popup().setText("Veículo em rota"))
          .addTo(map);
      } else driverMarker.current.setLngLat([driver.lng, driver.lat]);
    }
  }, [driver, destination, origin, ready, driverLabel, vehicleLabel]);

  // fit bounds
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const pts: [number, number][] = [];
    if (driver) pts.push([driver.lng, driver.lat]);
    if (destination) pts.push([destination.lng, destination.lat]);
    if (origin) pts.push([origin.lng, origin.lat]);
    if (pts.length < 2) return;
    const bounds = pts.reduce(
      (b, p) => b.extend(p as mapboxgl.LngLatLike),
      new mapboxgl.LngLatBounds(pts[0], pts[0]),
    );
    map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 800 });
  }, [driver?.lat, driver?.lng, destination?.lat, destination?.lng, ready]);

  // route line
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const src = map.getSource("route") as mapboxgl.GeoJSONSource | undefined;
    if (routeGeoJSON) {
      const data = {
        type: "Feature" as const,
        properties: {},
        geometry: routeGeoJSON,
      };
      if (src) src.setData(data as any);
      else {
        map.addSource("route", { type: "geojson", data: data as any });
        map.addLayer({
          id: "route",
          type: "line",
          source: "route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#3b82f6",
            "line-width": 5,
            "line-opacity": 0.85,
          },
        });
      }
    } else if (src) {
      src.setData({ type: "FeatureCollection", features: [] } as any);
    }
  }, [routeGeoJSON, ready]);

  if (!TOKEN) {
    return (
      <div className={className}>
        <div className="grid h-full min-h-[240px] place-items-center rounded-2xl bg-surface-2 text-sm text-muted-foreground">
          Mapbox não configurado.
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className={className} />;
}
