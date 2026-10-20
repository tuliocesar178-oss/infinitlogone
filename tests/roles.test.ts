import { expect, test } from 'bun:test';
import { areaGateTarget } from '../src/lib/roles';

// Regra que evita o ciclo infinito de redirecionamentos ("Too many redirects"):
// papéis vazios nunca apontam para outra área protegida.
test('papéis vazios vão para /app em todas as áreas (sem ciclo)', () => {
  expect(areaGateTarget([], 'driver')).toBe('/app');
  expect(areaGateTarget([], 'ops')).toBe('/app');
  expect(areaGateTarget([], 'client')).toBe('/app');
});

test('papel correto entra na própria área', () => {
  expect(areaGateTarget(['driver'], 'driver')).toBeNull();
  expect(areaGateTarget(['admin'], 'ops')).toBeNull();
  expect(areaGateTarget(['logistics'], 'ops')).toBeNull();
  expect(areaGateTarget(['client'], 'client')).toBeNull();
});

test('papel errado é mandado para a área dele', () => {
  expect(areaGateTarget(['client'], 'driver')).toBe('/client');
  expect(areaGateTarget(['driver'], 'ops')).toBe('/driver');
  expect(areaGateTarget(['driver'], 'client')).toBe('/ops/central');
  expect(areaGateTarget(['admin'], 'driver')).toBe('/ops/central');
});
