import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const TOKEN = import.meta.env.VITE_LOVABLE_CONNECTOR_MAPBOX_PUBLIC_TOKEN as string | undefined;
if (TOKEN) mapboxgl.accessToken = TOKEN;

type LngLat = [number, number];

interface RouteMiniMapProps {
  origin?: LngLat | null;
  destination?: LngLat | null;
  driver?: LngLat | null;
  className?: string;
  interactive?: boolean;
  showRoute?: boolean;
  onMapClick?: (lngLat: LngLat) => void;
  onStatsUpdate?: (stats: { distanceKm: number; durationMin: number }) => void;
  originInfo?: { title: string; address: string; time?: string };
  destinationInfo?: { title: string; address: string; time?: string };
}

export function RouteMiniMap({
  origin,
  destination,
  driver,
  orderStatus,
  className,
  interactive = false,
  showRoute = true,
  onMapClick,
  onStatsUpdate,
  originInfo,
  destinationInfo,
}: {
  origin?: LngLat | null;
  destination?: LngLat | null;
  driver?: LngLat | null;
  orderStatus?: string | null;
  className?: string;
  interactive?: boolean;
  showRoute?: boolean;
  onMapClick?: (lngLat: LngLat) => void;
  onStatsUpdate?: (stats: { distanceKm: number; durationMin: number }) => void;
  originInfo?: { title: string; address: string; time?: string };
  destinationInfo?: { title: string; address: string; time?: string };
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    if (!ref.current || !TOKEN) return;
    if (mapRef.current) return;

    mapRef.current = new mapboxgl.Map({
      container: ref.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: origin ?? driver ?? destination ?? [-46.63, -23.55],
      zoom: 12,
      interactive: interactive,
      attributionControl: false,
    });

    if (interactive) {
      mapRef.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
      mapRef.current.on("click", (e) => {
        onMapClick?.([e.lngLat.lng, e.lngLat.lat]);
      });
    }

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [interactive, onMapClick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const draw = async () => {
      // Clear old markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      
      const bounds = new mapboxgl.LngLatBounds();

      if (origin) {
        const el = document.createElement("div");
        el.className = "marker-pickup";
        el.innerHTML = `<div style="width:24px;height:24px;background:#10b981;border:3px solid white;border-radius:50%;box-shadow:0 4px 10px rgba(0,0,0,0.2);display:grid;place-items:center;"><div style="width:8px;height:8px;background:white;border-radius:50%;"></div></div>`;
        
        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
          <div style="padding:8px; font-family:sans-serif;">
            <div style="font-size:10px; font-weight:900; color:#10b981; text-transform:uppercase;">Coleta</div>
            <div style="font-size:14px; font-weight:900; margin-top:2px;">${originInfo?.title || "Local de Coleta"}</div>
            <div style="font-size:12px; color:#666; margin-top:2px;">${originInfo?.address || ""}</div>
            ${originInfo?.time ? `<div style="font-size:11px; margin-top:4px; font-weight:bold;">🕒 ${originInfo.time}</div>` : ""}
          </div>
        `);

        const m = new mapboxgl.Marker({ element: el }).setLngLat(origin).setPopup(popup).addTo(map);
        markersRef.current.push(m);
        bounds.extend(origin);
      }

      if (destination) {
        const el = document.createElement("div");
        el.className = "marker-delivery";
        el.innerHTML = `<div style="width:24px;height:24px;background:#ef4444;border:3px solid white;border-radius:50%;box-shadow:0 4px 10px rgba(0,0,0,0.2);display:grid;place-items:center;"><div style="width:8px;height:8px;background:white;border-radius:50%;"></div></div>`;

        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
          <div style="padding:8px; font-family:sans-serif;">
            <div style="font-size:10px; font-weight:900; color:#ef4444; text-transform:uppercase;">Entrega</div>
            <div style="font-size:14px; font-weight:900; margin-top:2px;">${destinationInfo?.title || "Local de Entrega"}</div>
            <div style="font-size:12px; color:#666; margin-top:2px;">${destinationInfo?.address || ""}</div>
            ${destinationInfo?.time ? `<div style="font-size:11px; margin-top:4px; font-weight:bold;">🕒 ${destinationInfo.time}</div>` : ""}
          </div>
        `);

        const m = new mapboxgl.Marker({ element: el }).setLngLat(destination).setPopup(popup).addTo(map);
        markersRef.current.push(m);
        bounds.extend(destination);
      }

      if (driver) {
        const el = document.createElement("div");
        el.className = "marker-driver";
        el.innerHTML = `
          <div style="position:relative; width:32px; height:32px; display:grid; place-items:center;">
            <div style="position:absolute; width:100%; height:100%; background:#2563eb22; border-radius:50%; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="width:16px; height:16px; background:#2563eb; border:3px solid white; border-radius:50%; box-shadow:0 0 15px rgba(37,99,235,0.4); z-index:1;"></div>
          </div>
          <style>
            @keyframes ping { 75%, 100% { transform: scale(2); opacity: 0; } }
          </style>
        `;
        const m = new mapboxgl.Marker({ element: el }).setLngLat(driver).addTo(map);
        markersRef.current.push(m);
        bounds.extend(driver);
      }

      // Draw route line
      if (showRoute && (origin || driver) && destination) {
        const start = driver || origin;
        if (start) {
          try {
            const waypoints = [start.join(","), destination.join(",")];
            if (driver && origin && (orderStatusIncludes(orderStatus, 'pickup'))) {
               // If going to pickup, route is driver -> origin
               // If already picked up, route is driver -> destination
            }
            
            const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${start.join(",")};${destination.join(",")}?geometries=geojson&overview=full&access_token=${TOKEN}`;
            const r = await fetch(url);
            const j = await r.json();
            const route = j?.routes?.[0];
            const geom = route?.geometry;
            
            if (route) {
              onStatsUpdate?.({
                distanceKm: route.distance / 1000,
                durationMin: route.duration / 60
              });
            }

            if (geom) {
              if (!map.isStyleLoaded()) await new Promise((res) => map.once("load", res));
              
              if (map.getSource("route")) {
                (map.getSource("route") as mapboxgl.GeoJSONSource).setData({
                  type: "Feature",
                  properties: {},
                  geometry: geom
                });
              } else {
                map.addSource("route", { 
                  type: "geojson", 
                  data: { type: "Feature", properties: {}, geometry: geom } 
                });
                map.addLayer({
                  id: "route",
                  type: "line",
                  source: "route",
                  layout: { "line-cap": "round", "line-join": "round" },
                  paint: { 
                    "line-color": "#2563eb", 
                    "line-width": 5,
                    "line-opacity": 0.8
                  },
                });
              }
            }
          } catch (err) {
            console.error("Mapbox Directions error:", err);
          }
        }
      }

      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 80, maxZoom: 15, duration: 1000 });
      }
    };

    if (map.isStyleLoaded()) draw();
    else map.once("load", draw);
  }, [origin, destination, driver, showRoute, originInfo, destinationInfo]);

  if (!TOKEN) {
    return (
      <div className={`grid place-items-center rounded-xl bg-surface-2 text-xs text-muted-foreground ${className ?? "h-32"}`}>
        Mapa indisponível
      </div>
    );
  }
  return <div ref={ref} className={`overflow-hidden ${className ?? "h-32"}`} />;
}

function orderStatusIncludes(status: any, part: string) {
  return String(status || "").toLowerCase().includes(part);
}
