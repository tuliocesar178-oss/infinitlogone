import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  program_id: z.string().uuid(),
  driver_id: z.string().uuid(),
  price: z.number().positive().max(10_000_000),
  expires_minutes: z.number().int().min(1).max(1440).default(15),
});

/**
 * Send a freight program to a driver as an offer.
 * The database routine is server-only; staff membership is verified here and
 * re-verified inside the routine using the forwarded actor id.
 */
export const sendProgramToDriver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof schema>) => schema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isStaff } = await context.supabase.rpc("is_staff", {
      _user_id: context.userId,
    });
    if (!isStaff) throw new Error("Acesso negado — apenas administrador ou logística.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: offerId, error } = await (supabaseAdmin as any).rpc("send_program_to_driver_as", {
      _actor: context.userId,
      _program_id: data.program_id,
      _driver_id: data.driver_id,
      _price: data.price,
      _expires_minutes: data.expires_minutes,
    });
    if (error) throw new Error(error.message);
    return { offer_id: offerId as string };
  });
