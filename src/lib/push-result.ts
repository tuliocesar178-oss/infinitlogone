export interface DeliveryState { status: string; }
/** A concurrent sender's persisted result is authoritative, not a zero-send attempt. */
export function summarizePushDeliveries(rows: DeliveryState[]) {
  const sent = rows.filter(row => row.status === 'accepted').length;
  const failed = rows.filter(row => ['failed', 'expired'].includes(row.status)).length;
  const pending = rows.filter(row => row.status === 'processing').length;
  return { sent, failed, pending, status: pending ? 'processing' : failed ? 'failed' : sent ? 'accepted' : 'skipped' };
}