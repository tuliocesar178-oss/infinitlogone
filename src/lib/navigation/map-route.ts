import { z } from 'zod';
import type { NavigationRoute } from './model';

export const positionSchema = z.tuple([z.number().finite().min(-180).max(180), z.number().finite().min(-90).max(90)]);
export const geometrySchema = z.object({ type: z.literal('LineString'), coordinates: z.array(positionSchema).min(2) });
export const ROUTE_SOURCE = 'navigation-route';
export const ROUTE_CASING = 'navigation-route-casing';
export const ROUTE_LINE = 'navigation-route-line';

// Structural interface allows lifecycle regression tests without WebGL.
export interface RouteMap {
  isStyleLoaded(): boolean | undefined;
  getSource(id: string): unknown;
  addSource(id: string, source: { type: 'geojson'; data: GeoJSON.Feature<GeoJSON.LineString> }): unknown;
  getLayer(id: string): unknown;
  addLayer(layer: { id: string; type: 'line'; source: string; layout: { 'line-cap': 'round'; 'line-join': 'round' }; paint: { 'line-color': string; 'line-width': number } }): unknown;
}

export function drawNavigationRoute(map: RouteMap, route: NavigationRoute, colors: { line: string; casing: string }): boolean {
  if (!map.isStyleLoaded()) return false;
  const geometry = geometrySchema.parse(route.geometry);
  const data: GeoJSON.Feature<GeoJSON.LineString> = { type: 'Feature', properties: {}, geometry };
  const source = map.getSource(ROUTE_SOURCE) as { setData(data: GeoJSON.Feature<GeoJSON.LineString>): void } | undefined;
  if (source) source.setData(data);
  else map.addSource(ROUTE_SOURCE, { type: 'geojson', data });
  // Sources and layers are checked separately: a style reload can remove either.
  for (const [id, color, width] of [[ROUTE_CASING, colors.casing, 11], [ROUTE_LINE, colors.line, 7]] as const) {
    if (!map.getLayer(id)) map.addLayer({ id, type: 'line', source: ROUTE_SOURCE, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': color, 'line-width': width } });
  }
  return true;
}

export function validPosition(position: unknown): position is [number, number] { return positionSchema.safeParse(position).success; }