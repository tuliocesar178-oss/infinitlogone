import { expect, test } from 'bun:test';
import { stageFor, APPROACH_RADIUS_M } from '../src/lib/driver-action';

test('approach radius is 300 m', () => { expect(APPROACH_RADIUS_M).toBe(300); });
test('near pickup only changes the hint, not the action', () => {
  expect(stageFor('start_loading', 299)).toBe('near_pickup');
  expect(stageFor('start_loading', 301)).toBe('go_pickup');
  expect(stageFor('start_loading', null)).toBe('go_pickup');
});
test('near destination offers delivery preparation; checklist precedes trip', () => {
  expect(stageFor('start_unloading', 100)).toBe('near_delivery');
  expect(stageFor('loaded', 0)).toBe('pickup_checklist');
  expect(stageFor('delivered', 0)).toBe('delivery_docs');
});
