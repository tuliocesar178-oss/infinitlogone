import { describe, it, expect } from 'bun:test';
import { clientIdentityIds } from '../src/lib/client-identity';

describe('client operational ownership', () => {
  it('Geisiane accesses only her linked registration, not Alfa', () => {
    const user = 'c26ac63a-ae2c-4601-b574-ff99d7011edf';
    expect(clientIdentityIds(user, [
      { id: 'e673c657-fd38-43a5-a793-20afd614a584', auth_user_id: user },
      { id: 'd9f4a559-65bd-4265-aed0-e3a095cfe9e7', auth_user_id: 'another-user' },
    ])).toEqual([user, 'e673c657-fd38-43a5-a793-20afd614a584']);
  });
  it('preserves legacy same-UUID ownership without duplicate IDs', () => {
    expect(clientIdentityIds('legacy', [{ id: 'legacy', auth_user_id: 'legacy' }])).toEqual(['legacy']);
  });
});