/** Completed records remain historical even after operational soft deletion. */
export const CLIENT_HISTORY_FILTER = "deleted_at.is.null,status.in.(delivered,finalized)";

export function isClientHistoryOrder(order: { status: string }): boolean {
  return order.status === "delivered" || order.status === "finalized";
}