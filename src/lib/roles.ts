import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "logistics" | "driver" | "client";

const roleHome: Record<AppRole, string> = {
  admin: "/ops/central",
  logistics: "/ops/central",
  driver: "/driver",
  client: "/client",
};

const rolePriority: AppRole[] = ["admin", "logistics", "driver", "client"];

export function homeForRole(role: AppRole | null | undefined): string {
  if (!role) return "/rastreio";
  return roleHome[role];
}

export async function fetchUserRoles(userId: string): Promise<AppRole[]> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) return [];
  return (data ?? []).map((r) => r.role as AppRole);
}

/**
 * Cache em memória dos papéis por usuário: evita repetir a mesma consulta
 * em cada `beforeLoad` de rota (layout + subrota), o que deixava a entrada
 * no painel lenta.
 */
const rolesCache = new Map<string, Promise<AppRole[]>>();

export function getUserRolesCached(userId: string): Promise<AppRole[]> {
  let p = rolesCache.get(userId);
  if (!p) {
    p = fetchUserRoles(userId).catch(() => [] as AppRole[]);
    rolesCache.set(userId, p);
  }
  return p;
}

export function clearRolesCache() {
  rolesCache.clear();
}

export function primaryRole(roles: AppRole[]): AppRole {
  for (const r of rolePriority) {
    if (roles.includes(r)) return r;
  }
  return "client";
}
