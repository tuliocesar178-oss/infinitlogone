import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  code: z
    .string()
    .trim()
    .min(4)
    .max(40)
    .regex(/^[A-Za-z0-9-]+$/, "Código inválido"),
});

/**
 * Public tracking lookup. The underlying `get_tracking` database function is no
 * longer executable by anonymous clients; this server function is the only
 * public entry point and validates the tracking code before querying.
 */
export const getPublicTracking = createServerFn({ method: "POST" })
  .inputValidator((d: z.infer<typeof schema>) => schema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await supabaseAdmin.rpc("get_tracking", {
      _code: data.code.toUpperCase(),
    });
    if (error) throw new Error("Não foi possível consultar o rastreio.");
    return result ?? null;
  });
