import { describe, expect, test } from 'bun:test';
import { summarizePushDeliveries } from '../src/lib/push-result';
describe('concurrent push test results', () => {
  test('already accepted HTTP 201 delivery never becomes skipped', () => {
    expect(summarizePushDeliveries([{ status: 'accepted' }])).toEqual({ sent: 1, failed: 0, pending: 0, status: 'accepted' });
  });
  test('another sender still processing is not a failure or skip', () => {
    expect(summarizePushDeliveries([{ status: 'processing' }])).toEqual({ sent: 0, failed: 0, pending: 1, status: 'processing' });
  });
  test('provider rejection remains a failure', () => {
    expect(summarizePushDeliveries([{ status: 'expired' }]).failed).toBe(1);
  });
});