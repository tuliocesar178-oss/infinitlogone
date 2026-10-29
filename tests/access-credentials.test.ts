import { describe, it, expect } from 'vitest';
import { loginEmailFor, passwordPairError, phoneLoginEmail } from '../src/lib/access-credentials';

describe('login por telefone', () => {
  it('normaliza telefone com ou sem formatação para a mesma credencial', () => {
    expect(phoneLoginEmail('(11) 98765-4321')).toBe('5511987654321@telefone.infinitlog.app');
    expect(loginEmailFor('+55 11 98765-4321')).toBe('5511987654321@telefone.infinitlog.app');
    expect(loginEmailFor('11987654321')).toBe('5511987654321@telefone.infinitlog.app');
  });
  it('mantém login por e-mail', () => {
    expect(loginEmailFor(' Ana@Empresa.com ')).toBe('ana@empresa.com');
  });
  it('rejeita telefone sem DDD', () => {
    expect(() => loginEmailFor('98765-4321')).toThrow();
  });
});

describe('senha e confirmação', () => {
  it('recusa senhas diferentes', () => {
    expect(passwordPairError('senhaForte1', 'senhaForte2')).toMatch(/não conferem/);
  });
  it('recusa senha com menos de 8 caracteres', () => {
    expect(passwordPairError('abc123', 'abc123')).toMatch(/8 caracteres/);
  });
  it('aceita senhas iguais', () => {
    expect(passwordPairError('senhaForte1', 'senhaForte1')).toBeNull();
  });
});
