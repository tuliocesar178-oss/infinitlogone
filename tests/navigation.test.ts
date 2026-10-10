import { describe, expect, test } from 'bun:test';
import { navigationTarget, navigationActive, routeProgress, type NavigationRoute } from '../src/lib/navigation/model';
import { buildNavUrl } from '../src/lib/nav-launcher';
const order = { id: 'real', driver_id: 'driver', status: 'loading', origin_lat: 0, origin_lng: -46, origin_address: 'Coleta', destination_lat: -23, destination_lng: -45, destination_address: 'Entrega' };
describe('navigation preserves freight rules', () => {
  test('stays at collection until confirmed, including loading', () => { expect(navigationTarget(order).position).toEqual([-46,0]); expect(navigationTarget({ ...order, status: 'loaded' }).position).toEqual([-45,-23]); });
  test('finished or cancelled freight cannot start navigation', () => { expect(navigationActive('delivered')).toBe(false); expect(navigationActive('cancelled')).toBe(false); expect(navigationActive('driver_assigned')).toBe(true); });
  test('Mapbox stays internal and external choice never mutates status', () => { const before = { ...order }; expect(buildNavUrl('mapbox', { lat: 0, lng: -46, orderId: 'real' })).toBe('/driver/navegacao/real'); expect(buildNavUrl('google', { lat: 0, lng: -46 })).toContain('destination=0%2C-46'); expect(order).toEqual(before); });
  test('address fallback is encoded without invented coordinates', () => { expect(buildNavUrl('waze', { lat: null, lng: null, label: 'Rua São João, 10' })).toContain('q=Rua%20S%C3%A3o%20Jo%C3%A3o%2C%2010'); expect(() => buildNavUrl('google', { lat: null, lng: null })).toThrow(); });
  test('progress follows road geometry and arrival only reports proximity', () => {
    const route: NavigationRoute = { distance: 1112, duration: 120, geometry: { type: 'LineString', coordinates: [[0,0],[0.01,0]] }, legs: [{ steps: [{ distance: 1112, duration: 120, geometry: { type: 'LineString', coordinates: [[0,0],[0.01,0]] }, maneuver: { instruction: 'Siga em frente', type: 'depart', location: [0,0] } }] }] };
    const midpoint = routeProgress(route, [0.005,0]); expect(midpoint.percent).toBeCloseTo(50,0); expect(midpoint.seconds).toBeCloseTo(60,0); expect(midpoint.arrival).toBe(false);
    expect(routeProgress(route,[0.01,0]).arrival).toBe(true); expect(order.status).toBe('loading'); expect(routeProgress(route,[0.005,0.01]).offRoute).toBeGreaterThan(1000);
  });
});
