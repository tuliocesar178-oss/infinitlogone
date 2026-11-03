export type ApprovalFilter = "pending" | "correction" | "rejected" | "all";
export type ApprovalDecision = "approve" | "reject" | "correction";

interface ApprovalRow {
  user_id: string;
  approval_status: string;
}

/** Apply only a confirmed review, preserving history in the explicit all filter. */
export function applyConfirmedDriverReview<T extends ApprovalRow>(
  rows: T[] | undefined,
  driverId: string,
  decision: ApprovalDecision,
  filter: ApprovalFilter,
): T[] | undefined {
  if (!rows) return rows;
  const status = { approve: "active", reject: "rejected", correction: "correction" }[decision];
  return rows
    .map((row) => row.user_id === driverId ? { ...row, approval_status: status } : row)
    .filter((row) => filter === "all" || row.approval_status === filter);
}