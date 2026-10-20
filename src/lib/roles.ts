import { supabase } from "@/integrations/supabase/client";

export type AppRole =
  | "admin"
  | "supervisor"
  | "logistics"
  | "financeiro"
  | "comercial"
  | "operacional"
  | "driver"
  | "client";

/** Perfis internos da empresa: todos entram pela Central Operacional. */
export const STAFF_ROLES: AppRole[] = [
  "admin",
  "supervisor",
  "logistics",
  "financeiro",
  "comercial",
  "operacional",
];

export const isStaffRole = (role: AppRole | null | undefined) =>
  !!role && STAFF_ROLES.includes(role);

const roleHome: Record<AppRole, string> = {
  admin: "/ops/central",
  supervisor: "/ops/central",
  logistics: "/ops/central",
  financeiro: "/ops/central",
  comercial: "/ops/central",
  operacional: "/ops/central",
  driver: "/driver",
  client: "/client",
};

const rolePriority: AppRole[] = [
  "admin",
  "supervisor",
  "logistics",
  "financeiro",
  "comercial",
  "operacional",
  "driver",
  "client",
];

export function homeForRole(role: AppRole | null | undefined): string {
  if (!role) return "/rastreio";
  return roleHome[role];
}

export async function fetchUserRoles(userId: string): Promise<AppRole[]> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw error;
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
    p = fetchUserRoles(userId);
    // Falhas não ficam em cache: uma nova tentativa refaz a consulta.
    p.catch(() => rolesCache.delete(userId));
    rolesCache.set(userId, p);
  }
  return p;
}

/**
 * Carrega os papéis para os gates de rota. Em caso de erro de rede/sessão,
 * lança Error (a tela de erro com "Tentar novamente" aparece) em vez de
 * redirecionar — redirecionar com papéis desconhecidos causava um ciclo
 * infinito entre /driver, /ops/central e /client ("Too many redirects").
 */
export async function requireRoles(userId: string): Promise<AppRole[]> {
  try {
    return await getUserRolesCached(userId);
  } catch {
    throw new Error(
      "Não foi possível carregar seu perfil de acesso. Verifique sua conexão e tente novamente.",
    );
  }
}

/**
 * Destino do gate de cada área protegida. Retorna null quando o usuário pode
 * entrar. Com papéis vazios (conta sem perfil), manda para "/app" — mandar
 * para outra área protegida criava um ciclo infinito de redirecionamentos
 * ("Too many redirects").
 */
export function areaGateTarget(
  roles: AppRole[],
  area: "driver" | "ops" | "client",
): string | null {
  if (area === "driver") {
    if (roles.includes("driver")) return null;
    if (roles.length === 0) return "/app";
    return roles.includes("client") ? "/client" : "/ops/central";
  }
  if (area === "ops") {
    if (roles.some(isStaffRole)) return null;
    if (roles.length === 0) return "/app";
    return roles.includes("driver") ? "/driver" : "/client";
  }
  if (roles.includes("client")) return null;
  if (roles.length === 0) return "/app";
  return "/ops/central";
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
