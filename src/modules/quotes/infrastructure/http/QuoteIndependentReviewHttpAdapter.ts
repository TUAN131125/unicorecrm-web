import type { CommercialApiClient } from "@/platform/api/generated/commercialApi";
import type { IndependentReviewPort,ReviewInput } from "../../application/read-models/quoteIndependentReview";
import type { QuoteVersionedCommandOptions } from "../../application/ports/QuoteApiRuntime";
export class QuoteIndependentReviewHttpAdapter implements IndependentReviewPort {
 constructor(private readonly api:CommercialApiClient){}
 async read(q:string,c:string,signal?:AbortSignal){return this.api.getQuoteIndependentReview(q,c,{},signal);}
 async history(q:string,c:string,cursor?:string,signal?:AbortSignal){const p=await this.api.listQuoteIndependentReviewHistory(q,c,{limit:20,...(cursor?{cursor}:{})},signal);return {items:p.items,...(p.pageInfo.nextCursor?{nextCursor:p.pageInfo.nextCursor}:{})};}
 async submit(q:string,c:string,input:ReviewInput,options:QuoteVersionedCommandOptions){return (await this.api.submitQuoteIndependentReviewDecision(q,c,input,options)).result;}
}
