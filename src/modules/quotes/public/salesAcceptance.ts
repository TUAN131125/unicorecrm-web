import { MutationCommandError, createMutationMetadata } from "@/shared/application";
import { getQuoteApiRuntime } from "../application/composition/quoteApplicationServices";
import type { StaffAcceptanceInput } from "../application/ports/QuoteSalesAcceptancePort";
export type { SalesAcceptance, SalesInvitation, CustomerAcceptancePreview } from "../application/ports/QuoteSalesAcceptancePort";
function port() {
  const runtime = getQuoteApiRuntime();
  if (runtime.mode !== "connected" || !runtime.salesAcceptance) throw new MutationCommandError({ code: "CONNECTED_OPERATION_REQUIRES_BACKEND", message: "Customer acceptance requires the connected service.", category: "INFRASTRUCTURE", retryable: false });
  return runtime.salesAcceptance;
}
export function recordSalesAcceptance(id: string, version: number, input: StaffAcceptanceInput, key: string) {
  return port().staff(id, input, { expectedVersion: version, idempotencyKey: key });
}
export function inviteQuoteCustomer(id: string, version: number, documentId: string, sendGmail: boolean, key: string) {
  return port().invite(id, documentId, sendGmail, { expectedVersion: version, idempotencyKey: key });
}
export function previewCustomerAcceptance(token: string, signal?: AbortSignal) { return port().preview(token, signal); }
export function readQuoteInvitationHistory(id: string, signal?: AbortSignal) { return port().history(id, signal); }
export function consentCustomerAcceptance(token: string, termsVersion: string, key: string) {
  const metadata = createMutationMetadata("quote.customer-consent", { idempotencyKey: key });
  return port().consent(token, termsVersion, { idempotencyKey: metadata.idempotencyKey });
}
