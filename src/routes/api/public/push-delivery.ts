import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

export const Route = createFileRoute("/api/public/push-delivery")({
  server: { handlers: { POST: async ({ request }) => {
    const secret = process.env["PUSH_WEBHOOK_SECRET"];
    const bearer = request.headers.get("authorization");
    if (!secret || !bearer) return new Response("Unauthorized", { status: 401 });
    const { timingSafeEqual } = await import("node:crypto");
    const expected = new TextEncoder().encode(`Bearer ${secret}`);
    const received = new TextEncoder().encode(bearer);
    if (received.byteLength !== expected.byteLength || !timingSafeEqual(received, expected)) return new Response("Unauthorized", { status: 401 });
    try {
      const input = z.union([z.object({ notification_id: z.string().uuid() }), z.object({ action: z.literal("configure") })]).parse(await request.json());
      if ("action" in input) {
        const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
        const { error } = await db.from("push_transport_config").upsert({ key: "web_push", endpoint: "https://infinitlogone.lovable.app/api/public/push-delivery", bearer: secret, updated_at: new Date().toISOString() }, { onConflict: "key" });
        if (error) throw new Error("Falha ao configurar transporte.");
        return Response.json({ ok: true });
      }
      const { deliverNotification } = await import("@/lib/push-delivery.server");
      await deliverNotification(input.notification_id);
      return Response.json({ ok: true });
    } catch {
      console.error("[Push] falha ao processar aviso autorizado");
      return Response.json({ ok: false }, { status: 500 });
    }
  } } },
});