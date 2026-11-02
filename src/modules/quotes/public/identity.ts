import { getQuoteApiRuntime } from "../application/composition/quoteApplicationServices";
import { MutationCommandError } from "@/shared/application";
export type { IdentityCaseView, IdentityHistoryItem, IdentityBindingInput, EvidenceSource, ManualSourceCheckInput, SourceEvidenceInput } from "../application/read-models/quoteIdentityAuthority";
export function quoteIdentity() { const r=getQuoteApiRuntime();if(r.mode!=="connected" || !r.identity)throw new MutationCommandError({code:"BLOCKED_CONTRACT",category:"INFRASTRUCTURE",message:"Identity evidence unavailable.",retryable:false});return r.identity; }
