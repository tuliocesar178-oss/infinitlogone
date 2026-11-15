import { describe, expect, test } from "bun:test";
import { trustedPushEndpoint, pushPreferencesSchema, pushCategory, safePushContent } from "../src/lib/push-model";
describe("mobile notification security", () => {
  test("rejects private and lookalike push destinations", () => {
    expect(trustedPushEndpoint("https://127.0.0.1/private")).toBe(false);
    expect(trustedPushEndpoint("https://fcm.googleapis.com.attacker.example/send")).toBe(false);
    expect(trustedPushEndpoint("https://user:pass@fcm.googleapis.com/send")).toBe(false);
    expect(trustedPushEndpoint("https://fcm.googleapis.com/send/device")).toBe(true);
  });
  test("each disabled event preference remains disabled", () => {
    for (const category of ["offers", "routes", "chat", "incidents", "registrations", "finance"] as const) {
      expect(pushPreferencesSchema.parse({ [category]: false })[category]).toBe(false);
    }
  });
  test("financial, chat, delivery and incident events keep separate preferences", () => {
    expect(pushCategory("payment_paid")).toBe("finance");
    expect(pushCategory("chat_message")).toBe("chat");
    expect(pushCategory("evidence_uploaded")).toBe("deliveries");
    expect(pushCategory("critical_incident")).toBe("incidents");
  });
  test("lock screen receives no amount, document or arbitrary message", () => {
    expect(safePushContent("payment_paid", "/driver/faturamento", "event-1")).toEqual({
      title: "INFINITLOG | Atualização financeira", body: "Abra a InfinitLog para consultar com segurança.",
      url: "/driver/faturamento", tag: "event-1", roomId: undefined, requireInteraction: false,
    });
  });
});