import { createMutationMetadata, executeMutationCommand, type MutationOutcome } from "@/shared/application";
import type { CustomerOrder } from "@/modules/orders";

export const ACCEPTED_QUOTE_ORDER_CONVERSION_RUNTIME_MODE = "OPENAPI_CONNECTED_ONLY" as const;

export interface ConvertAcceptedQuoteToOrderDraftCommand {
  creationIntentId: string;
  quoteId: string;
  expectedQuoteVersion: number;
  idempotencyKey: string;
}

export interface ConvertedAcceptedQuoteOrderDraftResult {
  order: CustomerOrder;
  sourceQuoteId: string;
  sourceQuoteResourceVersion: number;
  commercialSnapshotFingerprint: string;
}

/**
 * Connected-only production command. The backend copies the accepted Quote's
 * immutable buyer, line, adjustment and payment-agreement snapshots and assigns
 * the Order ID/number/totals/version. The existing demo order.create command is
 * intentionally not reused because it also represents direct-sale authoring.
 */
export function convertAcceptedQuoteToOrderDraftCommand(
  command: ConvertAcceptedQuoteToOrderDraftCommand,
  signal?: AbortSignal,
): Promise<MutationOutcome<ConvertedAcceptedQuoteOrderDraftResult>> {
  return executeMutationCommand(
    {
      commandType: "order.convert-accepted-quote-to-draft",
      aggregateType: "order",
      aggregateId: command.creationIntentId,
      payload: command,
    },
    createMutationMetadata(`order.convert-accepted-quote:${command.creationIntentId}`, {
      idempotencyKey: command.idempotencyKey,
      expectedVersion: command.expectedQuoteVersion,
      signal,
    }),
  );
}
