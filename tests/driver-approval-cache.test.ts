import { describe, expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { applyConfirmedDriverReview } from "../src/lib/driver-approval-cache";

const rows = [
  { user_id: "analisado", approval_status: "pending" },
  { user_id: "outro", approval_status: "pending" },
];

describe("fila de solicitações de cadastro", () => {
  it("retira imediatamente a solicitação aprovada dos pendentes", () => {
    expect(applyConfirmedDriverReview(rows, "analisado", "approve", "pending"))
      .toEqual([{ user_id: "outro", approval_status: "pending" }]);
  });
  it("retira imediatamente a solicitação reprovada dos pendentes", () => {
    expect(applyConfirmedDriverReview(rows, "analisado", "reject", "pending"))
      .toEqual([{ user_id: "outro", approval_status: "pending" }]);
  });
  it("preserva o cadastro analisado no histórico com status confirmado", () => {
    expect(applyConfirmedDriverReview(rows, "analisado", "approve", "all")?.[0])
      .toEqual({ user_id: "analisado", approval_status: "active" });
    expect(rows[0]?.approval_status).toBe("pending");
  });
  it("retira uma solicitação em correção quando reprovada", () => {
    expect(applyConfirmedDriverReview([{ user_id: "analisado", approval_status: "correction" }],
      "analisado", "reject", "correction")).toEqual([]);
  });
  it("atualiza caches já abertos de pendentes e histórico sem esperar nova consulta", () => {
    const client = new QueryClient();
    client.setQueryData(["driver-approvals", "pending"], rows);
    client.setQueryData(["driver-approvals", "all"], rows);
    client.setQueryData(["driver-approvals", "pending"], (old: typeof rows | undefined) =>
      applyConfirmedDriverReview(old, "analisado", "reject", "pending"));
    client.setQueryData(["driver-approvals", "all"], (old: typeof rows | undefined) =>
      applyConfirmedDriverReview(old, "analisado", "reject", "all"));
    expect(client.getQueryData(["driver-approvals", "pending"])).toHaveLength(1);
    expect(client.getQueryData<typeof rows>(["driver-approvals", "all"])?.[0]?.approval_status).toBe("rejected");
  });
});