import type { CommercialApiClient } from "@/platform/api/generated/commercialApi";
import type { QuoteSalesAcceptancePort, StaffAcceptanceInput, SalesAcceptance, SalesInvitation, CustomerAcceptancePreview } from "../../application/ports/QuoteSalesAcceptancePort";
import type { QuoteVersionedCommandOptions, QuoteCommandOptions } from "../../application/ports/QuoteCommandMetadata";
export class QuoteSalesAcceptanceHttpAdapter implements QuoteSalesAcceptancePort {
  constructor(private readonly api: CommercialApiClient) {}
  history(id: string, signal?: AbortSignal) { return this.api.listQuoteAcceptanceInvitations<SalesInvitation[]>(id, {}, signal); }
  staff(id: string, input: StaffAcceptanceInput, options: QuoteVersionedCommandOptions) { return this.api.recordQuoteSalesAcceptance<SalesAcceptance>(id, input, options); }
  invite(id: string, documentId: string, sendGmail: boolean, options: QuoteVersionedCommandOptions) { return this.api.createQuoteAcceptanceInvitation<SalesInvitation>(id, { documentId, sendGmail }, options); }
  preview(token: string, signal?: AbortSignal) { return this.api.previewCustomerQuoteAcceptance<CustomerAcceptancePreview>({ token }, signal ? { signal } : {}); }
  consent(token: string, termsVersion: string, options: QuoteCommandOptions) { return this.api.consentCustomerQuoteAcceptance<SalesAcceptance>({ token, agree: true, termsVersion }, options); }
}
