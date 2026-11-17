export interface ClientIdentity { id: string; auth_user_id: string | null }

/** Keep operational ownership stable; login accounts may have a different UUID. */
export function clientIdentityIds(userId: string, identities: readonly ClientIdentity[]): string[] {
  return [...new Set([userId, ...identities.filter(i => i.auth_user_id === userId).map(i => i.id)])];
}