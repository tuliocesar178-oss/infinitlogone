import { z } from 'zod';

export const routePointsSchema = z.object({
  fromLat: z.number().min(-90).max(90), fromLng: z.number().min(-180).max(180),
  toLat: z.number().min(-90).max(90), toLng: z.number().min(-180).max(180),
});
const responseSchema = z.object({ routes: z.array(z.object({
  distance: z.number().nonnegative(), duration: z.number().nonnegative(),
  geometry: z.object({ type: z.literal('LineString'), coordinates: z.array(z.tuple([z.number(), z.number()])).min(2) }),
})) });

/** Called only after authentication; credentials are supplied inside each handler. */
export async function calculateConfirmedRoute(points: z.infer<typeof routePointsSchema>, key: string | undefined, lovable: string | undefined) {
  const p = routePointsSchema.parse(points);
  if (!key || !lovable) throw new Error('Conexão Mapbox indisponível.');
  const coords = `${p.fromLng},${p.fromLat};${p.toLng},${p.toLat}`;
  const response = await fetch(`https://connector-gateway.lovable.dev/mapbox/directions/v5/mapbox/driving-traffic/${coords}?overview=full&geometries=geojson`, {
    headers: { Authorization: `Bearer ${lovable}`, 'X-Connection-Api-Key': key },
  });
  if (!response.ok) {
    const body = await response.text();
    console.error(`Mapbox Directions [${response.status}]: ${body}`);
    throw new Error(`Mapbox [${response.status}]: ${body}`);
  }
  const route = responseSchema.parse(await response.json()).routes[0];
  if (!route) throw new Error('Não foi possível calcular a rota. Confira os pontos de coleta e entrega.');
  return { geometry: route.geometry, duration: Math.ceil(route.duration / 60), distance: Math.round(route.distance / 100) / 10 };
}