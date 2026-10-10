import { expect, test } from 'bun:test';
import { drawNavigationRoute, geometrySchema, ROUTE_LINE, ROUTE_SOURCE, type RouteMap } from '../src/lib/navigation/map-route';
import type { NavigationRoute } from '../src/lib/navigation/model';
const route: NavigationRoute = { distance: 100, duration: 10, geometry: { type: 'LineString', coordinates: [[-44.04,-19.59],[-44.041,-19.592],[-44.043,-19.593]] }, legs: [] };
test('draws full road geometry only after style is loaded, recovers layers and never duplicates on recalculation', () => {
  let loaded = false;
  const sources = new Map<string, { setData(data: GeoJSON.Feature<GeoJSON.LineString>): void }>();
  const layers = new Set<string>(); let creates = 0; let received: unknown;
  const map: RouteMap = { isStyleLoaded: () => loaded, getSource: id => sources.get(id), getLayer: id => layers.has(id), addLayer: layer => { if (layers.has(layer.id)) throw Error('duplicate'); layers.add(layer.id); }, addSource: (id, source) => { creates++; received = source.data.geometry.coordinates; sources.set(id, { setData: data => { received = data.geometry.coordinates; } }); } };
  expect(drawNavigationRoute(map, route, { line: 'blue', casing: 'white' })).toBe(false); expect(creates).toBe(0);
  loaded = true; drawNavigationRoute(map, route, { line: 'blue', casing: 'white' }); expect(received).toEqual(route.geometry.coordinates); expect(layers.has(ROUTE_LINE)).toBe(true);
  layers.clear(); drawNavigationRoute(map, route, { line: 'blue', casing: 'white' }); expect(layers.size).toBe(2); expect(creates).toBe(1);
  const recalculated = { ...route, geometry: { ...route.geometry, coordinates: [[-44.04,-19.59],[-44.05,-19.60]] } };
  drawNavigationRoute(map, recalculated, { line: 'blue', casing: 'white' }); expect(received).toEqual(recalculated.geometry.coordinates); expect(creates).toBe(1);
  sources.delete(ROUTE_SOURCE); layers.clear(); drawNavigationRoute(map, route, { line: 'blue', casing: 'white' }); expect(creates).toBe(2); expect(layers.size).toBe(2);
});
test('rejects insufficient, inverted-out-of-range or non-finite road coordinates', () => {
  expect(geometrySchema.safeParse({ type: 'LineString', coordinates: [[-44,-19]] }).success).toBe(false);
  expect(geometrySchema.safeParse({ type: 'LineString', coordinates: [[-44,100],[-45,100]] }).success).toBe(false);
  expect(geometrySchema.safeParse({ type: 'LineString', coordinates: [[NaN,-19],[-44,-19]] }).success).toBe(false);
});