import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TEAM_ROLES = [
  "admin",
  "supervisor",
  "logistics",
  "financeiro",
  "comercial",
  "operacional",
] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

async function ensureCanManage(ctx: { supabase: any; userId: string }) {
  const [{ data: isAdmin }, { data: isSup }, { data: isLog }] = await Promise.all([
    ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" }),
    ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "supervisor" }),
    ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "logistics" }),
  ]);
  const isSupervisor = !!isSup;
  const isAdminUser = !!isAdmin;
  const isStaff = isAdminUser || isSupervisor || !!isLog;
  if (!isStaff) throw new Error("Acesso não autorizado.");
  return { isAdmin: isAdminUser, isSupervisor, isStaff };
}

function reqMeta() {
  const ip =
    getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ||
    getRequestHeader("x-real-ip") ||
    null;
  const ua = getRequestHeader("user-agent") || null;
  return { ip, ua };
}

async function log(
  ctx: { supabase: any; userId: string },
  action: string,
  entity_type: string | null,
  entity_id: string | null,
  description: string,
  metadata: Record<string, unknown> = {},
) {
  const { ip, ua } = reqMeta();
  await ctx.supabase.from("activity_log").insert({
    actor_id: ctx.userId,
    action,
    entity_type,
    entity_id,
    description,
    metadata,
    ip,
    user_agent: ua,
  });
}

const inviteSchema = z.object({
  email: z.string().trim().email(),
  full_name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(30).optional().nullable(),
  whatsapp: z.string().trim().max(30).optional().nullable(),
  cpf: z.string().trim().max(20).optional().nullable(),
  rg: z.string().trim().max(20).optional().nullable(),
  position: z.string().trim().max(80).optional().nullable(),
  department_id: z.string().uuid().optional().nullable(),
  role: z.enum(TEAM_ROLES),
});

export const inviteTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof inviteSchema>) => inviteSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { isAdmin } = await ensureCanManage(context);
    if (data.role === "admin" && !isAdmin) {
      throw new Error("Somente administrador pode criar outro admin.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const origin = process.env.SITE_URL || undefined;

    const { data: inv, error: invErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      data.email,
      {
        data: { full_name: data.full_name, phone: data.phone ?? undefined },
        redirectTo: origin ? `${origin}/auth` : undefined,
      },
    );
    if (invErr || !inv?.user) throw new Error(invErr?.message ?? "Falha ao convidar.");
    const userId = inv.user.id;

    await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, full_name: data.full_name, phone: data.phone ?? null });

    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: data.role });

    await supabaseAdmin.from("team_members").upsert(
      {
        user_id: userId,
        email: data.email,
        full_name: data.full_name,
        phone: data.phone ?? null,
        whatsapp: data.whatsapp ?? null,
        cpf: data.cpf ?? null,
        rg: data.rg ?? null,
        position: data.position ?? null,
        department_id: data.department_id ?? null,
        status: "convite_pendente",
        created_by: context.userId,
      },
      { onConflict: "user_id" },
    );

    await log(context, "team.invite", "team_member", userId, `Convite enviado a ${data.email}`, {
      role: data.role,
    });

    return { user_id: userId };
  });

const idSchema = z.object({ user_id: z.string().uuid() });

export const resendTeamInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof idSchema>) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureCanManage(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(data.user_id);
    const email = u?.user?.email;
    if (!email) throw new Error("Colaborador sem e-mail.");
    const origin = process.env.SITE_URL || undefined;
    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: origin ? `${origin}/auth` : undefined,
    });
    if (error) throw new Error(error.message);
    await log(context, "team.resend_invite", "team_member", data.user_id, `Convite reenviado a ${email}`);
    return { ok: true };
  });

export const resetTeamPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof idSchema>) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureCanManage(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(data.user_id);
    const email = u?.user?.email;
    if (!email) throw new Error("Colaborador sem e-mail.");
    const origin = process.env.SITE_URL || undefined;
    const { error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: origin ? { redirectTo: `${origin}/auth` } : undefined,
    });
    if (error) throw new Error(error.message);
    await log(context, "team.reset_password", "team_member", data.user_id, `Reset de senha enviado a ${email}`);
    return { ok: true };
  });

const blockSchema = z.object({
  user_id: z.string().uuid(),
  blocked: z.boolean(),
});

export const setTeamBlocked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof blockSchema>) => blockSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureCanManage(context);
    const { error } = await context.supabase
      .from("team_members")
      .update({ status: data.blocked ? "bloqueado" : "ativo" })
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    if (data.blocked) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.auth.admin.updateUserById(data.user_id, { ban_duration: "876000h" });
    } else {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.auth.admin.updateUserById(data.user_id, { ban_duration: "none" });
    }
    await log(
      context,
      data.blocked ? "team.block" : "team.unblock",
      "team_member",
      data.user_id,
      data.blocked ? "Colaborador bloqueado" : "Colaborador desbloqueado",
    );
    return { ok: true };
  });

const roleSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(TEAM_ROLES),
});

export const setTeamRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof roleSchema>) => roleSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { isAdmin } = await ensureCanManage(context);
    if (data.role === "admin" && !isAdmin) throw new Error("Somente administrador pode promover outro admin.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.user_id, role: data.role });
    if (error) throw new Error(error.message);
    await log(context, "team.set_role", "team_member", data.user_id, `Novo papel: ${data.role}`);
    return { ok: true };
  });

export const deleteTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof idSchema>) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { isAdmin } = await ensureCanManage(context);
    if (!isAdmin) throw new Error("Somente administrador pode excluir colaboradores.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    await log(context, "team.delete", "team_member", data.user_id, "Colaborador excluído");
    return { ok: true };
  });

const deptSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(200).optional().nullable(),
});

export const createDepartment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof deptSchema>) => deptSchema.parse(d))
  .handler(async ({ data, context }) => {
    const [{ data: isAdmin }] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    ]);
    if (!isAdmin) throw new Error("Somente administrador cria departamentos.");
    const { data: row, error } = await context.supabase
      .from("departments")
      .insert({ name: data.name, description: data.description ?? null })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await log(context, "department.create", "department", row.id, `Departamento criado: ${data.name}`);
    return row;
  });
