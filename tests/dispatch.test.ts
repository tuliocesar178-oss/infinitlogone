import { describe, it, expect } from 'bun:test';
import {
  DISPATCH_MODE_LABELS,
  availabilityLabel,
  countOffersByStatus,
  filterDispatchDrivers,
  minutesRemaining,
  type DispatchDriver,
} from '../src/lib/dispatch-model';

const drivers: DispatchDriver[] = [
  { user_id: 'a', full_name: 'Alessandro Silva', phone: '+553136624772', photo_url: null, availability: 'disponivel', vehicle_plate: 'ABC1D23', vehicle_model: 'FH 540', vehicle_type: 'Truck', vehicle_capacity_kg: 27000 },
  { user_id: 'b', full_name: 'Bruna Souza', phone: '+5531988887777', photo_url: null, availability: 'em_frete', vehicle_plate: 'XYZ9K87', vehicle_model: 'Daily', vehicle_type: 'Furgão', vehicle_capacity_kg: 1800 },
  { user_id: 'c', full_name: 'Carlos Lima', phone: null, photo_url: null, availability: null, vehicle_plate: null, vehicle_model: null, vehicle_type: null, vehicle_capacity_kg: null },
];

describe('despacho de fretes', () => {
  it('termo vazio retorna todos os motoristas', () => {
    expect(filterDispatchDrivers(drivers, '')).toHaveLength(3);
    expect(filterDispatchDrivers(drivers, '   ')).toHaveLength(3);
  });

  it('busca por nome sem diferenciar maiúsculas', () => {
    const found = filterDispatchDrivers(drivers, 'ALESSANDRO');
    expect(found.map((d) => d.user_id)).toEqual(['a']);
  });

  it('busca por telefone ignorando formatação', () => {
    expect(filterDispatchDrivers(drivers, '(31) 3662-4772').map((d) => d.user_id)).toEqual(['a']);
    expect(filterDispatchDrivers(drivers, '98888').map((d) => d.user_id)).toEqual(['b']);
  });

  it('busca por placa ignorando formatação', () => {
    expect(filterDispatchDrivers(drivers, 'abc-1d23').map((d) => d.user_id)).toEqual(['a']);
  });

  it('busca por tipo e modelo de veículo', () => {
    expect(filterDispatchDrivers(drivers, 'furgão').map((d) => d.user_id)).toEqual(['b']);
    expect(filterDispatchDrivers(drivers, 'fh 540').map((d) => d.user_id)).toEqual(['a']);
  });

  it('motorista sem dados de veículo não quebra a busca', () => {
    expect(filterDispatchDrivers(drivers, 'carlos').map((d) => d.user_id)).toEqual(['c']);
    expect(filterDispatchDrivers(drivers, 'truck').map((d) => d.user_id)).toEqual(['a']);
  });

  it('modalidades têm rótulos claros', () => {
    expect(DISPATCH_MODE_LABELS.automatic).toContain('Todos os motoristas');
    expect(DISPATCH_MODE_LABELS.manual).toContain('Escolher motorista');
  });

  it('disponibilidade tem rótulo amigável e tolera valores ausentes', () => {
    expect(availabilityLabel('disponivel')).toBe('Disponível');
    expect(availabilityLabel('em_frete')).toBe('Em frete');
    expect(availabilityLabel(null)).toBe('—');
  });

  it('conta ofertas por status para o acompanhamento', () => {
    const counts = countOffersByStatus([
      { status: 'pending' }, { status: 'pending' }, { status: 'accepted' }, { status: 'cancelled' },
    ]);
    expect(counts.pending).toBe(2);
    expect(counts.accepted).toBe(1);
    expect(counts.cancelled).toBe(1);
    expect(counts.expired).toBe(0);
  });

  it('prazo restante nunca é negativo e tolera ausência de prazo', () => {
    const now = Date.now();
    expect(minutesRemaining(new Date(now + 10 * 60_000).toISOString(), now)).toBe(10);
    expect(minutesRemaining(new Date(now - 60_000).toISOString(), now)).toBe(0);
    expect(minutesRemaining(null, now)).toBe(0);
  });
});
