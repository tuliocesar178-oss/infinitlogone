// Preferências locais do motorista (persistidas no navegador)

const FAV_KEY = "driver:favorite-routes";
const THEME_KEY = "driver:theme";
const DRIVE_MODE_KEY = "driver:drive-mode";

export type FavoriteRoute = { origin: string; destination: string };

function normalize(s: string | null | undefined) {
  return (s ?? "").trim().toLowerCase();
}

export function routeKey(origin?: string | null, destination?: string | null) {
  return `${normalize(origin)}|${normalize(destination)}`;
}

export function readFavorites(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(FAV_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function isFavorite(origin?: string | null, destination?: string | null) {
  return readFavorites().includes(routeKey(origin, destination));
}

export function toggleFavorite(origin?: string | null, destination?: string | null): boolean {
  const key = routeKey(origin, destination);
  const list = new Set(readFavorites());
  const now = !list.has(key);
  if (now) list.add(key);
  else list.delete(key);
  localStorage.setItem(FAV_KEY, JSON.stringify(Array.from(list)));
  window.dispatchEvent(new CustomEvent("driver-favorites-changed"));
  return now;
}

// -------- Tema --------
export type ThemeMode = "light" | "dark";

export function readTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  const t = localStorage.getItem(THEME_KEY);
  if (t === "dark" || t === "light") return t;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", mode === "dark");
  localStorage.setItem(THEME_KEY, mode);
  window.dispatchEvent(new CustomEvent("driver-theme-changed"));
}

// -------- Modo direção --------
export function readDriveMode(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(DRIVE_MODE_KEY) === "1";
}

export function setDriveMode(on: boolean) {
  localStorage.setItem(DRIVE_MODE_KEY, on ? "1" : "0");
  window.dispatchEvent(new CustomEvent("driver-drive-mode-changed"));
}
