import { getQuoteApiRuntime } from "../application/composition/quoteApplicationServices";
import { MutationCommandError } from "@/shared/application";
export type { ReviewView,ReviewDecision,ReviewInput,ReviewFinding,ReviewCriterion } from "../application/read-models/quoteIndependentReview";
export function quoteReview(){const r=getQuoteApiRuntime();if(r.mode!=="connected"||!r.review)throw new MutationCommandError({code:"BLOCKED_CONTRACT",category:"INFRASTRUCTURE",message:"Independent review unavailable.",retryable:false});return r.review;}
