import { describe, it, expect } from 'bun:test';
import { availabilityUpdate, requireAvailabilityRow } from '../src/lib/driver-availability';

describe('disponibilidade do motorista', () => {
  it('online persiste disponibilidade e status compatíveis', () => {
    expect(availabilityUpdate('disponivel', '2026-11-17T20:00:00Z')).toEqual({ availability: 'disponivel', status: 'available', last_seen_at: '2026-11-17T20:00:00Z' });
  });
  it('offline persiste ambos os indicadores offline', () => {
    expect(availabilityUpdate('offline').status).toBe('offline');
    expect(availabilityUpdate('offline').availability).toBe('offline');
  });
  it('em frete preserva indicador de viagem', () => { expect(availabilityUpdate('em_frete').status).toBe('on_trip'); });
  it('não informa sucesso quando nenhuma linha foi atualizada', () => { expect(() => requireAvailabilityRow(null)).toThrow('Cadastro de motorista não encontrado'); });
});