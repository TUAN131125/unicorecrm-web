import type { Deal } from "../../domain/model/deal.types";
import type { DealFormDraft } from "../components/dealFormModel";
import { updateDealCommand, updateDealForecastCommand, reassignDealCommand, transitionDealStageCommand, refreshDealRecord } from "../../public/deals";
import { executeSequentialCommits, type PartialCommitReport, type CommitStep } from "@/shared/operations";
import type { MutationOutcome } from "@/shared/application";
import { MutationCommandError } from "@/shared/application";
import { getDealSelectionAuthority } from "../hooks/useDealSelectionQueries";
import { normalizeApplicationError } from "@/shared/domain";

interface SaveIntent {
  fingerprint: string;
  authority: string;
  version: number | undefined;
  completed: Set<string>;
  evidence: PartialCommitReport["committed"][number][];
  steps: CommitStep[];
  reset: Map<string, () => void>;
  attempts: Map<string, number>;
  conflictStep?: string;
}

/** One form's immutable command intent. No rollback, workflow coordination or durable cache. */
export class DealSaveCheckpoint {
  private intent: SaveIntent | undefined;
  hasConflict(): boolean { return this.intent?.conflictStep !== undefined; }
  async confirmConflict(dealId: string): Promise<void> {
    const intent = this.intent;
    if (!intent?.conflictStep || intent.authority !== getDealSelectionAuthority()) return;
    const current = await refreshDealRecord(dealId);
    if (intent.authority !== getDealSelectionAuthority()) return;
    intent.version = current.resourceVersion;
    const step = intent.conflictStep;
    intent.attempts.set(step, (intent.attempts.get(step) ?? 0) + 1);
    intent.reset.get(step)?.();
    intent.conflictStep = undefined;
  }

  async save(opening: Deal, draft: DealFormDraft, intentId: string, reason: string | null, execute: typeof executeSequentialCommits = executeSequentialCommits): Promise<PartialCommitReport> {
    const authority = getDealSelectionAuthority();
    const fingerprint = JSON.stringify([intentId, draft]);
    if (this.intent && this.intent.authority !== authority) this.intent = undefined;
    if (this.intent && this.intent.fingerprint !== fingerprint)
      throw new MutationCommandError({ code: "DEAL_SAVE_INTENT_PENDING", message: "Retry the pending save with the original draft before making further changes.", category: "CONFLICT", retryable: false });
    if (!this.intent) {
      const current: SaveIntent = { fingerprint, authority, version: opening.resourceVersion, completed: new Set(), evidence: [], steps: [], reset: new Map(), attempts: new Map() };
      const capture = (step: string, run: (version: number | undefined) => Promise<MutationOutcome<Deal>>) => {
        let captured = false;
        let expected: number | undefined;
        current.reset.set(step, () => { captured = false; });
        current.steps.push({ step, run: async () => {
          if (current.authority !== getDealSelectionAuthority()) throw new MutationCommandError({ code: "REQUEST_CANCELLED", message: "Save authority changed.", category: "INFRASTRUCTURE", retryable: false });
          if (!captured) { expected = current.version; captured = true; }
          const result = await run(expected);
          if (current.authority !== getDealSelectionAuthority()) throw new MutationCommandError({ code: "REQUEST_CANCELLED", message: "Save authority changed.", category: "INFRASTRUCTURE", retryable: false });
          current.version = result.data.resourceVersion;
          current.completed.add(step);
          return result;
        } });
      };
      const metadata = (step: string, expectedVersion: number | undefined) => ({ idempotencyKey: `${intentId}:${step}${current.attempts.has(step) ? `:review-${current.attempts.get(step)}` : ""}`, ...(expectedVersion === undefined ? {} : { expectedVersion }) });
      const notes = [draft.demandSummary, draft.painPoints, draft.notes].filter(Boolean).join(" · ") || undefined;
      const buyerRef = draft.buyerRef ?? opening.buyerRef;
      const profile = { name: draft.name, buyerRef, amount: draft.amount, amountDecimal: draft.amountDecimal, currency: draft.currency, notes, interestedProducts: [...draft.interestedProductIds], lineItems: [] };
      const profileChanged = opening.name !== draft.name || JSON.stringify(opening.buyerRef) !== JSON.stringify(buyerRef)
        || (opening.amountDecimal ?? String(opening.amount)) !== draft.amountDecimal || opening.currency !== draft.currency
        || opening.notes !== notes || JSON.stringify(opening.interestedProducts) !== JSON.stringify(draft.interestedProductIds);
      if (profileChanged) capture("profile", version => updateDealCommand(opening.id, { ...profile, contactId: buyerRef.type === "CONTACT" ? buyerRef.id : undefined }, metadata("profile", version)));
      if (opening.expectedCloseDate !== draft.expectedCloseDate || opening.opportunityScore !== draft.probability || opening.forecastCategory !== draft.forecastCategory)
        capture("forecast", version => updateDealForecastCommand(opening.id, { expectedCloseDate: draft.expectedCloseDate, opportunityScore: draft.probability, forecastCategory: draft.forecastCategory }, metadata("forecast", version)));
      if (opening.ownerId !== draft.ownerId && reason) capture("owner", version => reassignDealCommand(opening.id, { ownerId: draft.ownerId, reason }, metadata("owner", version)));
      if (opening.stage !== draft.stage) capture("stage", version => transitionDealStageCommand(opening.id, draft.stage, undefined, metadata("stage", version)));
      this.intent = current;
    }
    const intent = this.intent;
    const report = await execute(intent.steps.filter(step => !intent.completed.has(step.step)));
    intent.evidence.push(...report.committed);
    if (report.status !== "FULL_SUCCESS") {
      // Refresh does not rebase the captured expected version or mutate the draft.
      await refreshDealRecord(opening.id).catch(() => undefined);
      const failure = normalizeApplicationError(report.error);
      if (failure.code === "VERSION_CONFLICT" && report.failedStep)
        intent.conflictStep = report.failedStep;
      else if (intent.evidence.length === 0 && failure.status !== undefined && failure.status < 500)
        this.intent = undefined;
      return { ...report, status: intent.evidence.length ? "PARTIAL_SUCCESS" : "NO_COMMIT_FAILURE", committed: [...intent.evidence], requiresRefresh: true };
    }
    this.intent = undefined;
    return { ...report, committed: [...intent.evidence] };
  }
}
