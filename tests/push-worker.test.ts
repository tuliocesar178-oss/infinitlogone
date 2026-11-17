import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

describe("messaging worker", () => {
  test("delivers branded notification and retains same-origin destination", async () => {
    const handlers = new Map<string, (event: unknown) => void>();
    const notices: { title: string; options: { icon: string; badge: string; data: { url: string } } }[] = [];
    let pending: Promise<void> = Promise.resolve();
    const origin = "https://infinitlogone.lovable.app";
    runInNewContext(readFileSync("public/push-sw.js", "utf8"), {
      URL, Date, Number,
      self: {
        location: { origin },
        addEventListener: (name: string, handler: (event: unknown) => void) => handlers.set(name, handler),
        registration: {
          showNotification: async (title: string, options: typeof notices[number]["options"]) => { notices.push({ title, options }); },
        },
      },
    });
    const handler = handlers.get("push");
    if (!handler) throw new Error("Push handler missing");
    handler({
      data: { json: () => ({ title: "INFINITLOG | Atualização", url: "https://external.example/private" }) },
      waitUntil: (promise: Promise<void>) => { pending = promise; },
    });
    await pending;
    expect(notices).toHaveLength(1);
    expect(notices[0]?.options.icon).toBe(`${origin}/notification-icon-v2.png`);
    expect(notices[0]?.options.badge).toBe(`${origin}/notification-badge-v2.png`);
    expect(notices[0]?.options.data.url).toBe("/app");
  });
});