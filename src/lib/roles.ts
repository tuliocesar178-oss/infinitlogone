import { redirect } from "@tanstack/react-router";
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

/**
 * A sessão guardada no aparelho foi recusada pelo servidor (token vencido,
 * inválido ou revogado) e não pôde ser renovada. O usuário precisa entrar de novo.
 */
export class SessionExpiredError extends Error {
  constructor() {
    super("Sua sessão expirou. Entre novamente.");
    this.name = "SessionExpiredError";
  }
}

/** Erro de autenticação (sessão recusada), e não de rede/servidor. */
export function isAuthFailure(status: number | null | undefined, message?: string | null): boolean {
  if (status === 401) return true;
  return /jwt|token is expired|invalid token|not authenticated/i.test(message ?? "");
}

class RolesAuthError extends Error {}

export async function fetchUserRoles(userId: string): Promise<AppRole[]> {
  const { data, error, status } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) {
    if (isAuthFailure(status, error.message)) throw new RolesAuthError(error.message);
    throw error;
  }
  return (data ?? []).map((r) => r.role as AppRole);
}

/**
 * Busca os papéis e, se a sessão for recusada (401), tenta renovar a sessão
 * uma vez. Se a renovação falhar, encerra a sessão local e lança
 * SessionExpiredError — antes, a sessão recusada virava "sem papéis" e o app
 * ficava pulando entre áreas ("Too many redirects").
 */
async function fetchUserRolesWithRecovery(userId: string): Promise<AppRole[]> {
  try {
    return await fetchUserRoles(userId);
  } catch (e) {
    if (!(e instanceof RolesAuthError)) throw e;
  }
  const { data, error } = await supabase.auth.refreshSession();
  if (!error && data.session?.user.id === userId) {
    try {
      return await fetchUserRoles(userId);
    } catch (e) {
      if (!(e instanceof RolesAuthError)) throw e;
    }
  }
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  throw new SessionExpiredError();
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
    p = fetchUserRolesWithRecovery(userId);
    // Falhas não ficam em cache: uma nova tentativa refaz a consulta.
    p.catch(() => rolesCache.delete(userId));
    rolesCache.set(userId, p);
  }
  return p;
}

/**
 * Carrega os papéis para os gates de rota. Sessão recusada → volta para a
 * tela de login. Erro de rede/servidor → lança Error (tela com "Tentar
 * novamente") em vez de redirecionar, evitando ciclo entre áreas.
 */
export async function requireRoles(userId: string): Promise<AppRole[]> {
  try {
    return await getUserRolesCached(userId);
  } catch (e) {
    if (e instanceof SessionExpiredError) throw redirect({ to: "/auth" });
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
