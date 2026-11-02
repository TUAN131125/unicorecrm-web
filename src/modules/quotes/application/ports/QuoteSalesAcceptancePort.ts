import type { MoneyDto } from "@/shared/money";
import type { PaymentAgreementSnapshot } from "@/shared/order-to-cash";
import type { QuoteVersionedCommandOptions, QuoteCommandOptions } from "./QuoteCommandMetadata";
import type { SalesAcceptance } from "../../domain/model/salesAcceptance.types";
export type { SalesAcceptance } from "../../domain/model/salesAcceptance.types";
export interface SalesInvitation { invitationId: string; quoteId: string; deliveryStatus: "NOT_SENT" | "SENT" | "FAILED"; deliveryErrorCode?: string | null; expiresAt: string; acceptanceUrl?: string | null }
export interface StaffAcceptanceInput { documentId: string; channel: "PHONE" | "EMAIL" | "GMAIL" | "ZALO" | "IN_PERSON" | "OTHER"; customerAgreedAt: string; evidence: string; responsibilityConfirmed: boolean; attachmentEvidenceId?: string }
export interface CustomerAcceptancePreview {
  quoteNumber: string; buyerName: string; quoteRevision: number; documentVersion: number; grandTotal: MoneyDto;
  lineItems: { id: string; productNameSnapshot: string; quantity: string; unitPrice: MoneyDto; lineTotal: MoneyDto }[];
  paymentAgreement?: PaymentAgreementSnapshot | null; validUntil?: string | null; termsVersion: string; terms: string; deliveryStatus: string;
}
export interface QuoteSalesAcceptancePort {
  history(quoteId: string, signal?: AbortSignal): Promise<SalesInvitation[]>;
  staff(quoteId: string, input: StaffAcceptanceInput, options: QuoteVersionedCommandOptions): Promise<SalesAcceptance>;
  invite(quoteId: string, documentId: string, sendGmail: boolean, options: QuoteVersionedCommandOptions): Promise<SalesInvitation>;
  preview(token: string, signal?: AbortSignal): Promise<CustomerAcceptancePreview>;
  consent(token: string, termsVersion: string, options: QuoteCommandOptions): Promise<SalesAcceptance>;
}
