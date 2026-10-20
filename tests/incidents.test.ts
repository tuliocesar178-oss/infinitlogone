import { describe, expect, it } from 'vitest';
import { createIncidentSchema, incidentStage, isCriticalIncident, priorityRank, validateIncidentExplanation } from '../src/lib/incidents/model';
const payload = { request_id: '10000000-0000-4000-8000-000000000001', order_id: '10000000-0000-4000-8000-000000000002', type: 'other', description: 'Acesso bloqueado', safe_stop: true, affects_deadline: false, driver_eta: null, latitude: null, longitude: null, location_captured_at: null };
describe('driver incident rules', () => {
  it('requires a safe stop confirmation', () => { expect(createIncidentSchema.safeParse({ ...payload, safe_stop: false }).success).toBe(false); });
  it('allows sending without GPS', () => { expect(createIncidentSchema.safeParse(payload).success).toBe(true); });
  it('requires a capture time when GPS is present', () => { expect(createIncidentSchema.safeParse({ ...payload, latitude: -23, longitude: -46 }).success).toBe(false); });
  it('rejects partial and out-of-range coordinates', () => { expect(createIncidentSchema.safeParse({ ...payload, latitude: 91, longitude: -46, location_captured_at: '2026-10-20T00:00:00Z' }).success).toBe(false); });
  it('requires an explanation for Other', () => { expect(validateIncidentExplanation({ value: 'other', label: 'Outros', priority: 'attention', requires_description: true }, '  ')).toBe(false); });
  it('permits short reports for categories without explanation', () => { expect(validateIncidentExplanation({ value: 'traffic', label: 'Trânsito', priority: 'attention', requires_description: false }, '')).toBe(true); });
  it('ranks critical above high without making informational incidents critical', () => { expect(priorityRank('critical')).toBe(3); expect(priorityRank('informative')).toBe(0); });
  it('does not label high priority or resolved incidents as critical', () => { expect(isCriticalIncident({ priority: 'high', resolved_at: null })).toBe(false); expect(isCriticalIncident({ priority: 'critical', resolved_at: null })).toBe(true); expect(isCriticalIncident({ priority: 'critical', resolved_at: '2026-10-20T00:00:00Z' })).toBe(false); });
  it('derives the trip stage without changing the order state', () => { expect(incidentStage('unloading')).toBe('unloading'); expect(incidentStage('in_transit')).toBe('transit'); expect(incidentStage('en_route_pickup')).toBe('pickup_travel'); });
});