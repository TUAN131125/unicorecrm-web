import { recordQuoteCustomerDecisionCommand, rejectQuoteCommand } from "../../public/quotes";
import type { RecordQuoteCustomerDecisionInput } from "../../application/ports/QuoteApiRuntime";

export async function saveQuoteCustomerResponse(quoteId: string, expectedVersion: number, identity: string,
  input: { kind: "acceptance"; channel: RecordQuoteCustomerDecisionInput["sourceChannel"]; description: string } | { kind: "rejection"; reason: string }) {
  const metadata = { expectedVersion, idempotencyKey: `quote.response:${identity}` };
  return input.kind === "rejection"
    ? rejectQuoteCommand(quoteId, { reason: input.reason }, metadata)
    : recordQuoteCustomerDecisionCommand(quoteId, { decisionId: identity, evidenceType: "USER_REPORTED_ACCEPTANCE",
        sourceChannel: input.channel, sourceDescription: input.description }, metadata);
}
