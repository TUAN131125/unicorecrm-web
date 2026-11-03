import type { CommercialApiClient } from "@/platform/api/generated/commercialApi";
import type { QuoteIdentityAuthorityPort } from "../../application/read-models/quoteIdentityAuthority";
import type { QuoteVersionedCommandOptions } from "../../application/ports/QuoteApiRuntime";
export class QuoteIdentityHttpAdapter implements QuoteIdentityAuthorityPort {
 constructor(private readonly api: CommercialApiClient) {}
 async read(q: string, c: string, signal?: AbortSignal) { return this.api.getQuoteIdentityAuthority(q,c,{},signal); }
 async history(q: string, c: string, cursor?: string, signal?: AbortSignal) { const p=await this.api.listQuoteIdentityAuthorityHistory(q,c,{limit:20,...(cursor?{cursor}:{})},signal);return {items:p.items,...(p.pageInfo.nextCursor?{nextCursor:p.pageInfo.nextCursor}:{})}; }
 async sources(q: string, cursor?: string, signal?: AbortSignal) { const p=await this.api.listQuoteAcceptanceEvidenceSources(q,{limit:20,...(cursor?{cursor}:{})},signal);return {items:p.items,...(p.pageInfo.nextCursor?{nextCursor:p.pageInfo.nextCursor}:{})}; }
 async save(q: string,c: string,input: Parameters<QuoteIdentityAuthorityPort["save"]>[2],options: QuoteVersionedCommandOptions) { return (await this.api.saveQuoteIdentityAuthorityBinding(q,c,input,options)).result; }
 async assess(q: string,c: string,subjectId: string,options: QuoteVersionedCommandOptions) { return (await this.api.assessQuoteIdentityAuthority(q,c,{subjectId},options)).result; }
 async check(q: string,c: string,subjectId: string,options: QuoteVersionedCommandOptions,manualCheck?: Parameters<QuoteIdentityAuthorityPort["check"]>[4]) { return (await this.api.recordQuoteAcceptanceSourceCheck(q,c,{subjectId,...(manualCheck?{manualCheck}:{})},options)).result; }
 async approveSource(q: string,s: string,reason: string,options: QuoteVersionedCommandOptions) { return (await this.api.approveQuoteAcceptanceEvidenceSource(q,s,{reason},options)).result; }
 async registerSource(q: string,input: Parameters<QuoteIdentityAuthorityPort["registerSource"]>[1],options: QuoteVersionedCommandOptions) { return (await this.api.registerQuoteAcceptanceEvidenceSource(q,input,options)).result; }
 async revokeSource(q: string,s: string,reason: string,options: QuoteVersionedCommandOptions) { return (await this.api.revokeQuoteAcceptanceEvidenceSource(q,s,{reason},options)).result; }
}
