import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureStaff(ctx: { supabase: any; userId: string }) {
  const { data: adminRow } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  const { data: logRow } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "logistics",
  });
  const isAdmin = !!adminRow;
  const isStaff = isAdmin || !!logRow;
  if (!isStaff) throw new Error("Acesso negado — apenas administrador ou logística.");
  return { isAdmin, isStaff };
}

const inviteSchema = z.object({
  email: z.string().trim().email(),
  full_name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(30).optional().nullable(),
  cpf: z.string().trim().max(20).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  state: z.string().trim().max(2).optional().nullable(),
});

export const inviteDriver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof inviteSchema>) => inviteSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const origin = process.env.SITE_URL || undefined;

    const { data: inv, error: invErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      data.email,
      {
        data: { full_name: data.full_name, phone: data.phone ?? undefined },
        redirectTo: origin ? `${origin}/auth` : undefined,
      },
    );
    if (invErr || !inv?.user) throw new Error(invErr?.message ?? "Falha ao convidar");

    const userId = inv.user.id;

    await supabaseAdmin.from("profiles").upsert({
      id: userId,
      full_name: data.full_name,
      phone: data.phone ?? null,
    });

    // Remove default "client" role, ensure "driver".
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "driver" });

    await supabaseAdmin.from("drivers").upsert(
      {
        user_id: userId,
        cpf: data.cpf ?? null,
        phone: data.phone ?? null,
        city: data.city ?? null,
        state: data.state ?? null,
        email: data.email,
        status: "offline",
        availability: "offline",
        financial_status: "ativo",
      },
      { onConflict: "user_id" },
    );

    return { user_id: userId };
  });

const resetSchema = z.object({ user_id: z.string().uuid() });

export const resetDriverPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof resetSchema>) => resetSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(data.user_id);
    const email = u?.user?.email;
    if (!email) throw new Error("Usuário sem e-mail");
    const origin = process.env.SITE_URL || undefined;
    const { error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: origin ? { redirectTo: `${origin}/auth` } : undefined,
    });
    if (error) throw new Error(error.message);
    return { ok: true, email };
  });

export const resendDriverInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof resetSchema>) => resetSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(data.user_id);
    const email = u?.user?.email;
    if (!email) throw new Error("Usuário sem e-mail");
    const origin = process.env.SITE_URL || undefined;
    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: origin ? `${origin}/auth` : undefined,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteDriver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof resetSchema>) => resetSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { isAdmin } = await ensureStaff(context);
    if (!isAdmin) throw new Error("Apenas administrador pode excluir motoristas.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const reviewSchema = z.object({
  driver_id: z.string().uuid(),
  decision: z.enum(["approve", "reject", "correction"]),
  reason: z.string().trim().max(2000).optional().nullable(),
});

/**
 * Approve / reject / request correction on a driver signup.
 * The database routine is server-only; staff membership is verified here and
 * re-verified inside the routine using the forwarded actor id.
 */
export const reviewDriverSignup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof reviewSchema>) => reviewSchema.parse(d))
  .handler(async ({ data, context }) => {
    const admin=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});
    if(admin.error||!admin.data)throw new Error('Somente administrador pode alterar aprovação.');
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("review_driver_signup_as", {
      _actor: context.userId,
      _driver_id: data.driver_id,
      _decision: data.decision,
      _reason: data.reason ?? undefined,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const availabilitySchema = z.object({

  user_id: z.string().uuid(),
  availability: z.enum(["disponivel", "em_frete", "folga", "ferias", "bloqueado", "offline"]),
});

export const setDriverAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof availabilitySchema>) => availabilitySchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const { error } = await context.supabase
      .from("drivers")
      .update({
        availability: data.availability,
        financial_status: data.availability === "bloqueado" ? "bloqueado" : "ativo",
      })
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
