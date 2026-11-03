import { QuoteIndependentReviewHttpAdapter } from "./QuoteIndependentReviewHttpAdapter";
import { QuoteIdentityHttpAdapter } from "./QuoteIdentityHttpAdapter";
import { QuoteProofHttpAdapter } from "./QuoteProofHttpAdapter";
import { QuoteSalesAcceptanceHttpAdapter } from "./QuoteSalesAcceptanceHttpAdapter";
import type { HttpClient } from "@/platform/api/client";
import { CommercialApiClient } from "@/platform/api/generated/commercialApi";
import type { QuoteApiRuntime } from "../../application/ports/QuoteApiRuntime";
import { QuoteHttpApiAdapter } from "./QuoteHttpApiAdapter";

export function createQuoteConnectedApiRuntime(httpClient: HttpClient): QuoteApiRuntime {
  const adapter = new QuoteHttpApiAdapter(new CommercialApiClient(httpClient));
  return { mode: "connected", salesAcceptance: new QuoteSalesAcceptanceHttpAdapter(new CommercialApiClient(httpClient)), queries: adapter, commands: adapter, documents: adapter, acceptance: adapter, review: new QuoteIndependentReviewHttpAdapter(new CommercialApiClient(httpClient)), identity: new QuoteIdentityHttpAdapter(new CommercialApiClient(httpClient)), proofs: new QuoteProofHttpAdapter(new CommercialApiClient(httpClient)) };
}
