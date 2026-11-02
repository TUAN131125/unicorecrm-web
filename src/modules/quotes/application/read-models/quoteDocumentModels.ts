import type { QuoteReadModel } from "./quoteReadModel";
import type { Quote } from "../../domain/model/quote.types";
import type { QuoteMutationEvidence, QuoteVersionedCommandOptions } from "../ports/QuoteCommandMetadata";

export interface IssuedQuoteDocument {
  documentId: string; quoteId: string; rootQuoteId: string; quoteRevision: number; documentVersion: number;
  sourceResourceVersion: number; resultResourceVersion: number; commercialContentFingerprint: string;
  sellerConfigurationVersion: number; approvalPolicyVersion: string; documentPolicyVersion: string;
  documentTemplateVersion: string; issuedAt: string; issuedBy: string; documentStatus: "ISSUED";
  fileSize: number; pageCount: number; mediaType: "application/pdf"; pdfSha256: string; fileName: string;
}
export interface QuoteSellerInformation {
  workspaceId: string; configurationVersion: number; displayName: string; legalName: string; address: string;
  taxId?: string; email?: string; phone?: string; website?: string;
}
export interface QuoteSellerReadiness { ready: boolean; blockerCodes: readonly string[]; seller?: QuoteSellerInformation; }
export interface QuoteDocumentPage { items: readonly IssuedQuoteDocument[]; nextCursor?: string; }
export interface QuoteDocumentIssueResult { quote: Quote; document: IssuedQuoteDocument; evidence: QuoteMutationEvidence; }
export type QuoteCommercialPreviewRead = Pick<QuoteReadModel, "quoteNumber" | "quoteRevision" | "title" | "buyerRef" | "validUntil" | "currency" | "lineItems" | "subtotal" | "discountTotal" | "taxTotal" | "grandTotal" | "notes"> & { adjustments?: { id: string; label: string; amount: { amount: string; currency: string } }[] };
export interface QuoteDocumentPort {
  preview(quoteId: string, signal?: AbortSignal): Promise<QuoteCommercialPreviewRead>;
  seller(signal?: AbortSignal): Promise<QuoteSellerReadiness>;
  listDocuments(quoteId: string, cursor?: string, signal?: AbortSignal): Promise<QuoteDocumentPage>;
  issueDocument(quoteId: string, reason: string, options: QuoteVersionedCommandOptions): Promise<QuoteDocumentIssueResult>;
  downloadDocument(quoteId: string, documentId: string, signal?: AbortSignal): Promise<{ document: IssuedQuoteDocument; blob: Blob }>;
}
