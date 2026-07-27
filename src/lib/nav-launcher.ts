export type NavProvider = "google" | "waze" | "apple" | "mapbox";

export type NavTarget = {
  lat: number;
  lng: number;
  label?: string;
};

export function buildNavUrl(provider: NavProvider, target: NavTarget): string {
  const { lat, lng, label } = target;
  const q = encodeURIComponent(label ?? `${lat},${lng}`);
  switch (provider) {
    case "google":
      return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    case "waze":
      return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
    case "apple":
      return `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d&q=${q}`;
    case "mapbox":
      return `https://api.mapbox.com/directions/v5/mapbox/driving/${lng},${lat}?geometries=geojson`;
  }
}

export function openNavigation(provider: NavProvider, target: NavTarget) {
  const url = buildNavUrl(provider, target);
  window.open(url, "_blank", "noopener,noreferrer");
}

export const NAV_PROVIDERS: { key: NavProvider; label: string; hint: string }[] = [
  { key: "google", label: "Google Maps", hint: "Padrão Android/iOS" },
  { key: "waze", label: "Waze", hint: "Trânsito em tempo real" },
  { key: "apple", label: "Apple Maps", hint: "Recomendado no iPhone" },
  { key: "mapbox", label: "Mapbox", hint: "Rota técnica" },
];
