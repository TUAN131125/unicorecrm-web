import type { CommercialApiClient } from "@/platform/api/generated/commercialApi";
import type { AcceptanceProofPort, ProofEvidenceType } from "../../application/read-models/quoteAcceptanceProof";
import type { QuoteVersionedCommandOptions } from "../../application/ports/QuoteApiRuntime";
import { ApiClientError } from "@/platform/api/errors/ApiClientError";
export class QuoteProofHttpAdapter implements AcceptanceProofPort {
  constructor(private readonly api: CommercialApiClient) {}
  async cases(quoteId: string, cursor?: string, signal?: AbortSignal) {
    const result = await this.api.listQuoteAcceptanceCases(quoteId, { limit: 20, ...(cursor ? { cursor } : {}) }, signal);
    return { items: result.items, ...(result.pageInfo.nextCursor ? { nextCursor: result.pageInfo.nextCursor } : {}) };
  }
  async proofs(quoteId: string, caseId: string, cursor?: string, signal?: AbortSignal) {
    const result = await this.api.listQuoteAcceptanceProofs(quoteId, caseId, { limit: 20, ...(cursor ? { cursor } : {}) }, signal);
    return { items: result.items, ...(result.pageInfo.nextCursor ? { nextCursor: result.pageInfo.nextCursor } : {}) };
  }
  async history(quoteId: string, caseId: string, proofId: string, cursor?: string, signal?: AbortSignal) {
    const result = await this.api.getQuoteAcceptanceProofScanHistory(quoteId, caseId, proofId, { limit: 20, ...(cursor ? { cursor } : {}) }, signal);
    return { items: result.items, ...(result.pageInfo.nextCursor ? { nextCursor: result.pageInfo.nextCursor } : {}) };
  }
  async download(quoteId: string, caseId: string, proofId: string, signal?: AbortSignal) {
    const metadata = await this.api.getQuoteAcceptanceProof(quoteId, caseId, proofId, {}, signal);
    const blob = await this.api.downloadQuoteAcceptanceProofContent<Blob>(quoteId, caseId, proofId, {}, signal);
    const bytes = await blob.arrayBuffer();
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), x => x.toString(16).padStart(2, "0")).join("").toUpperCase();
    if (blob.size !== metadata.fileSize || hash !== metadata.sha256.toUpperCase()) throw new ApiClientError({ code: "RESPONSE_DESERIALIZATION_FAILED", message: "Proof PDF integrity mismatch.", retryable: false });
    return { blob, fileName: metadata.fileName };
  }
  async create(quoteId: string, binding: Parameters<AcceptanceProofPort["create"]>[1], options: QuoteVersionedCommandOptions) {
    const result = await this.api.createQuoteAcceptanceCase(quoteId, { ...binding }, options);
    return result.result.case;
  }
  async upload(quoteId: string, caseId: string, file: File, evidenceType: ProofEvidenceType, options: QuoteVersionedCommandOptions) {
    const result = await this.api.uploadQuoteAcceptanceProof(quoteId, caseId, file,
      { "X-Proof-File-Name": encodeURIComponent(file.name), "X-Proof-Evidence-Type": evidenceType }, options);
    return result.result;
  }
}
