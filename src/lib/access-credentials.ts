import { z } from 'zod';
import { normalizePhone } from './registration-model';

/** Domain reserved for phone-based credentials. Never receives mail; Auth still hashes the password. */
export const PHONE_LOGIN_DOMAIN = 'telefone.infinitlog.app';

/** Deterministic Auth login for a phone: same phone (any formatting) → same credential, no lookup table. */
export function phoneLoginEmail(phone: string): string {
  return `${normalizePhone(phone).slice(1)}@${PHONE_LOGIN_DOMAIN}`;
}

/** Login identifier: e-mail when it contains "@", otherwise a Brazilian phone number. */
export function loginEmailFor(identifier: string): string {
  const value = identifier.trim();
  return value.includes('@') ? value.toLowerCase() : phoneLoginEmail(value);
}

export const PASSWORD_MIN = 8;
export const accessPasswordSchema = z.string().min(PASSWORD_MIN, `A senha precisa ter pelo menos ${PASSWORD_MIN} caracteres.`).max(72, 'A senha pode ter no máximo 72 caracteres.');

/** Returns a user-facing error or null when password and confirmation are acceptable. */
export function passwordPairError(password: string, confirm: string): string | null {
  const parsed = accessPasswordSchema.safeParse(password);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? 'Senha inválida.';
  if (password !== confirm) return 'As senhas não conferem. Digite a mesma senha nos dois campos.';
  return null;
}
