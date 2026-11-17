import { describe, expect, it } from 'bun:test';
import { CLIENT_HISTORY_FILTER, isClientHistoryOrder } from '../src/lib/client-history';

describe('client completed freight history', () => {
  const matches = (status: string, deleted_at: string | null) =>
    CLIENT_HISTORY_FILTER.includes('deleted_at.is.null') && deleted_at === null ||
    CLIENT_HISTORY_FILTER.includes(`status.in.(${['delivered', 'finalized'].join(',')})`) && isClientHistoryOrder({ status });

  it('retains Tulio delivered freights after operational deletion', () => {
    expect(matches('delivered', '2026-11-04T12:40:22.959Z')).toBe(true);
  });
  it('retains finalized historical freights', () => {
    expect(matches('finalized', '2026-11-04T12:40:22.959Z')).toBe(true);
  });
  it('never restores deleted active or cancelled routes', () => {
    expect(matches('loading', '2026-11-04T12:40:07.078Z')).toBe(false);
    expect(matches('cancelled', '2026-11-04T12:40:07.078Z')).toBe(false);
  });
  it('keeps undeleted active freight visible but outside completed history', () => {
    expect(matches('loading', null)).toBe(true);
    expect(isClientHistoryOrder({ status: 'loading' })).toBe(false);
  });
});