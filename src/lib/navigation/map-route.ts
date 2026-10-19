import { z } from 'zod';
import nearestPointOnLine from '@turf/nearest-point-on-line';
import { lineString, point } from '@turf/helpers';
import type { NavigationRoute } from './model';

export const positionSchema = z.tuple([z.number().finite().min(-180).max(180), z.number().finite().min(-90).max(90)]);
export const geometrySchema = z.object({ type: z.literal('LineString'), coordinates: z.array(positionSchema).min(2) });
export const ROUTE_SOURCE = 'navigation-route';
export const ROUTE_CASING = 'navigation-route-casing';
export const ROUTE_LINE = 'navigation-route-line';
export const ROUTE_COMPLETED_SOURCE = 'navigation-route-completed';
export const ROUTE_COMPLETED_LINE = 'navigation-route-completed-line';

// Structural interface allows lifecycle regression tests without WebGL.
export interface RouteMap {
  isStyleLoaded(): boolean | undefined;
  getSource(id: string): unknown;
  addSource(id: string, source: { type: 'geojson'; data: GeoJSON.Feature<GeoJSON.LineString> | GeoJSON.FeatureCollection }): unknown;
  getLayer(id: string): unknown;
  addLayer(layer: { id: string; type: 'line'; source: string; layout: { 'line-cap': 'round'; 'line-join': 'round' }; paint: { 'line-color': string; 'line-width': number; 'line-opacity'?: number } }): unknown;
}

export function drawNavigationRoute(
  map: RouteMap,
  route: NavigationRoute,
  colors: { line: string; casing: string; completed?: string },
  position?: [number, number] | null,
  maxOffRouteMeters = 60,
): boolean {
  if (!map.isStyleLoaded()) return false;
  const geometry = geometrySchema.parse(route.geometry);
  let remainingGeometry: GeoJSON.LineString = geometry;
  let completedGeometry: GeoJSON.LineString | null = null;

  if (position && validPosition(position)) {
    const snapped = nearestPointOnLine(lineString(geometry.coordinates), point(position));
    // GPS noise far from the road keeps the last drawing instead of flickering;
    // a real deviation is handled by recalculation in the navigation hook.
    if (Number(snapped.properties.dist) * 1000 > maxOffRouteMeters && map.getSource(ROUTE_SOURCE) && map.getLayer(ROUTE_LINE)) return true;
    const segmentIndex = Number(snapped.properties.index);
    if (Number.isInteger(segmentIndex) && segmentIndex >= 0) {
      const snappedCoordinate = snapped.geometry.coordinates as [number, number];
      const completedCoordinates = [...geometry.coordinates.slice(0, segmentIndex + 1), snappedCoordinate];
      const remainingCoordinates = [snappedCoordinate, ...geometry.coordinates.slice(segmentIndex + 1)];
      if (completedCoordinates.length >= 2) {
        completedGeometry = { type: 'LineString', coordinates: completedCoordinates };
      }
      if (remainingCoordinates.length >= 2) {
        remainingGeometry = { type: 'LineString', coordinates: remainingCoordinates };
      } else {
        remainingGeometry = { type: 'LineString', coordinates: [snappedCoordinate, snappedCoordinate] };
      }
    }
  }

  const emptyCollection: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
  const routeData: GeoJSON.Feature<GeoJSON.LineString> = { type: 'Feature', properties: {}, geometry: remainingGeometry };
  const completedData: GeoJSON.Feature<GeoJSON.LineString> | GeoJSON.FeatureCollection = completedGeometry
    ? { type: 'Feature', properties: {}, geometry: completedGeometry }
    : emptyCollection;

  const routeSource = map.getSource(ROUTE_SOURCE) as { setData(data: GeoJSON.Feature<GeoJSON.LineString> | GeoJSON.FeatureCollection): void } | undefined;
  if (routeSource) routeSource.setData(routeData);
  else map.addSource(ROUTE_SOURCE, { type: 'geojson', data: routeData });

  const completedSource = map.getSource(ROUTE_COMPLETED_SOURCE) as { setData(data: GeoJSON.Feature<GeoJSON.LineString> | GeoJSON.FeatureCollection): void } | undefined;
  if (completedSource) completedSource.setData(completedData);
  else map.addSource(ROUTE_COMPLETED_SOURCE, { type: 'geojson', data: completedData });

  // Sources and layers are checked separately: a style reload can remove either.
  for (const [id, color, width] of [[ROUTE_CASING, colors.casing, 11], [ROUTE_LINE, colors.line, 7]] as const) {
    if (!map.getLayer(id)) map.addLayer({ id, type: 'line', source: ROUTE_SOURCE, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': color, 'line-width': width } });
  }
  if (!map.getLayer(ROUTE_COMPLETED_LINE)) {
    map.addLayer({
      id: ROUTE_COMPLETED_LINE,
      type: 'line',
      source: ROUTE_COMPLETED_SOURCE,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': colors.completed ?? colors.casing, 'line-width': 5, 'line-opacity': 0.48 },
    });
  }
  return true;
}

export function validPosition(position: unknown): position is [number, number] { return positionSchema.safeParse(position).success; }