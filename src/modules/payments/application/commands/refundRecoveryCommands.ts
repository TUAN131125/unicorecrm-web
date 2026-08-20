/**
 * Production Refund recovery command intent. Provider acknowledgements, attempt IDs,
 * timestamps, references and terminal financial effects remain backend-owned.
 */
export interface RequestRefundCancellationCommand {
  expectedVersion: number;
  reasonCode: string;
  reason: string;
  idempotencyKey: string;
}

export interface RetryRefundIntentCommand {
  expectedVersion: number;
  idempotencyKey: string;
}
