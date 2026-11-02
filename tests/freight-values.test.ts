import { describe, expect, it } from 'bun:test';
import { grossMargin, requireDriverAmount } from '../src/lib/freight-values';

describe('valores independentes do frete', () => {
  const order = { client_amount: 2500, driver_amount: 1800 };
  it('comercial e faturamento mantêm 2500', () => expect(order.client_amount).toBe(2500));
  it('oferta e pagamento usam 1800', () => expect(requireDriverAmount(order.driver_amount)).toBe(1800));
  it('margem bruta antes de despesas é 700', () => expect(grossMargin(order)).toBe(700));
  it('alterar comercial não altera pagamento', () => {
    const changed = { ...order, client_amount: 3000 };
    expect(requireDriverAmount(changed.driver_amount)).toBe(1800);
    expect(grossMargin(changed)).toBe(1200);
  });
  it('alterar pagamento não altera comercial', () => {
    const changed = { ...order, driver_amount: 2000 };
    expect(changed.client_amount).toBe(2500);
    expect(grossMargin(changed)).toBe(500);
  });
  it('legado sem pagamento não recebe valor comercial por fallback', () => {
    expect(() => requireDriverAmount(null)).toThrow();
    expect(grossMargin({ client_amount: 2500, driver_amount: null })).toBeNull();
  });
  it('rejeita valor ausente, zero, negativo e não finito', () => {
    for (const value of [undefined, 0, -1, NaN, Infinity]) expect(() => requireDriverAmount(value)).toThrow();
  });
});