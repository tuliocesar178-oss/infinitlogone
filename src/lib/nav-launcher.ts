export type NavProvider = 'google' | 'waze' | 'apple' | 'mapbox';
export interface NavTarget { lat: number | null; lng: number | null; label?: string; orderId?: string; }
export function buildNavUrl(provider: NavProvider, target: NavTarget, origin?: { lat: number; lng: number }): string {
  if (provider === 'mapbox') { if (!target.orderId) throw new Error('Selecione o frete para continuar na INFINITLOG.'); return `/driver/navegacao/${encodeURIComponent(target.orderId)}`; }
  const coordinates = target.lat != null && target.lng != null;
  const destination = coordinates ? `${target.lat},${target.lng}` : target.label?.trim();
  if (!destination) throw new Error('Destino não cadastrado.');
  const encoded = encodeURIComponent(destination);
  if (provider === 'google') return `https://www.google.com/maps/dir/?api=1&destination=${encoded}&travelmode=driving${origin ? `&origin=${encodeURIComponent(`${origin.lat},${origin.lng}`)}` : ''}`;
  if (provider === 'waze') return `https://waze.com/ul?${coordinates ? 'll' : 'q'}=${encoded}&navigate=yes`;
  return `https://maps.apple.com/?daddr=${encoded}&dirflg=d`;
}
export function openNavigation(provider: NavProvider, target: NavTarget, origin?: { lat: number; lng: number }) {
  const url = buildNavUrl(provider, target, origin);
  if (provider === 'mapbox') { window.location.assign(url); return; }
  window.open(url, '_blank', 'noopener,noreferrer');
}
export const NAV_PROVIDERS: { key: NavProvider; label: string; hint: string }[] = [
  { key: 'mapbox', label: 'Continuar no Mapbox', hint: 'Dentro da INFINITLOG' },
  { key: 'google', label: 'Google Maps', hint: 'Aplicativo ou versão web' },
  { key: 'waze', label: 'Waze', hint: 'Aplicativo ou versão web' },
];
