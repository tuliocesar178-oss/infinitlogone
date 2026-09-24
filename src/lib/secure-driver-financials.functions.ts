import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FINANCIAL_COLUMNS =
  "bank_name, bank_code, bank_agency, bank_account, bank_account_digit, bank_account_type, pix_key, pix_key_type, favored_name, favored_document, financial_notes";

const schema = z.object({ user_id: z.string().uuid() });

export type DriverFinancials = {
  bank_name: string | null;
  bank_code: string | null;
  bank_agency: string | null;
  bank_account: string | null;
  bank_account_digit: string | null;
  bank_account_type: string | null;
  pix_key: string | null;
  pix_key_type: string | null;
  favored_name: string | null;
  favored_document: string | null;
  financial_notes: string | null;
} | null;

/**
 * Banking / payout data of a driver. Only the driver themself or an
 * administrator may read it — logistics staff intentionally cannot.
 */
export const getDriverFinancials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof schema>) => schema.parse(d))
  .handler(async ({ data, context }): Promise<DriverFinancials> => {
    if (context.userId !== data.user_id) {
      const { data: isAdmin } = await context.supabase.rpc("has_role", {
        _user_id: context.userId,
        _role: "admin",
      });
      if (!isAdmin) throw new Error("Acesso negado aos dados financeiros.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("drivers")
      .select(FINANCIAL_COLUMNS)
      .eq("user_id", data.user_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (row as DriverFinancials) ?? null;
  });
