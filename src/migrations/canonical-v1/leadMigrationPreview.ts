import type { Lead } from "@/modules/leads";
import {
  LeadWorkState,
  QualificationOutcome,
  validateCanonicalLeadLifecycle,
  type CanonicalLeadLifecycleState,
} from "@/modules/leads/domain/model/leadLifecycle.canonical";
import type { RelationshipRef } from "@/platform/identity";
import type { CanonicalMigrationDisposition, CanonicalMigrationIssue } from "./migrationIssues";
import { CanonicalMigrationIssueCollector } from "./migrationIssues";

export interface LeadMigrationEvidence {
  relationshipRef?: RelationshipRef;
  linkedDealId?: string;
  hasDirectOrder?: boolean;
  hasCareEvidence?: boolean;
}

export interface LeadMigrationPreview {
  leadId: string;
  disposition: CanonicalMigrationDisposition;
  canonical: CanonicalLeadLifecycleState;
  issues: CanonicalMigrationIssue[];
}

/**
 * The migration preview is intentionally dual-mode:
 * - already-canonical runtime records are validated as-is;
 * - records carrying a deterministic legacy migration marker are re-evaluated
 *   against linked evidence without restoring a combined Lead status field.
 */
export function previewLeadMigration(
  lead: Lead,
  evidence: LeadMigrationEvidence = {},
): LeadMigrationPreview {
  const collector = new CanonicalMigrationIssueCollector();

  if (!lead.migrationReview) {
    const canonical: CanonicalLeadLifecycleState = {
      leadWorkState: lead.leadWorkState,
      qualificationOutcome: lead.qualificationOutcome,
      relationshipRef: lead.relationshipRef,
      dealRef: lead.dealRef,
    };
    const validationErrors = validateCanonicalLeadLifecycle(canonical);
    validationErrors.forEach((message) => collector.add({
      sourceType: "Lead",
      sourceId: lead.id,
      disposition: "REVIEW",
      severity: "ERROR",
      rule: "LEAD_CANONICAL_INVARIANT_VIOLATION",
      message,
      candidateResolution: "Repair the Lead lifecycle fields before runtime use.",
    }));
    return {
      leadId: lead.id,
      disposition: validationErrors.length > 0 ? "REVIEW" : "SAFE",
      canonical,
      issues: collector.list(),
    };
  }

  let disposition: CanonicalMigrationDisposition = "INFER";
  let canonical: CanonicalLeadLifecycleState;

  if (evidence.linkedDealId && evidence.relationshipRef) {
    canonical = {
      leadWorkState: LeadWorkState.CLOSED,
      qualificationOutcome: QualificationOutcome.OPPORTUNITY,
      relationshipRef: evidence.relationshipRef,
      dealRef: evidence.linkedDealId,
    };
  } else if (evidence.hasDirectOrder && evidence.relationshipRef) {
    canonical = {
      leadWorkState: LeadWorkState.CLOSED,
      qualificationOutcome: QualificationOutcome.DIRECT_SALE,
      relationshipRef: evidence.relationshipRef,
    };
  } else if (evidence.hasCareEvidence && evidence.relationshipRef) {
    canonical = {
      leadWorkState: LeadWorkState.CLOSED,
      qualificationOutcome: QualificationOutcome.NURTURE,
      relationshipRef: evidence.relationshipRef,
    };
  } else {
    disposition = "REVIEW";
    canonical = { leadWorkState: LeadWorkState.VERIFYING };
    collector.add({
      sourceType: "Lead",
      sourceId: lead.id,
      disposition: "REVIEW",
      severity: "WARNING",
      rule: "LEAD_OUTCOME_REQUIRES_EVIDENCE",
      message: `Legacy ${lead.migrationReview.legacyStatus} cannot be mapped to a canonical qualification outcome without relationship plus Deal, Direct Sale or Care evidence.`,
      candidateResolution: "Review the record and choose DISQUALIFIED, NURTURE, OPPORTUNITY or DIRECT_SALE.",
    });
  }

  return { leadId: lead.id, disposition, canonical, issues: collector.list() };
}
