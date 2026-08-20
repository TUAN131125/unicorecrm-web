import { DealStage, type Deal, type DealLineItem } from "@/modules/deals/domain/model/deal.types";
import { QuoteStatus, type Quote, type QuoteLineItem } from "@/modules/quotes/domain/model/quote.types";
import type { BuyerRef } from "@/platform/identity";
import type { CanonicalMigrationDisposition, CanonicalMigrationIssue } from "./migrationIssues";
import { CanonicalMigrationIssueCollector } from "./migrationIssues";

export interface DealNormalizationSourceInput {
  id: string;
  name: string;
  stage: string;
  amount?: number;
  opportunityScore?: number;
  ownerId?: string;
  expectedCloseDate?: string;
  createdAt?: string;
  updatedAt?: string;
  interestedProducts?: string[];
  lineItems?: DealLineItem[];
  nextActionAt?: string;
  nextActionSummary?: string;
  nextActivity?: { date?: string; type?: string; title?: string };
  lostReason?: string;
  recycleEligible?: boolean;
  revisitAt?: string;
  buyerRef?: BuyerRef;
}

export interface DealNormalizationPreview {
  dealId: string;
  disposition: CanonicalMigrationDisposition;
  canonicalStage: DealStage;
  canAutoMigrate: boolean;
  candidate: Partial<Deal> & Pick<Deal, "id" | "name" | "stage">;
  issues: CanonicalMigrationIssue[];
}

export interface QuoteNormalizationSourceInput {
  id: string;
  quoteNumber: string;
  status: string;
  title?: string;
  dealId?: string;
  lineItems?: QuoteLineItem[];
  subtotal?: number;
  discountTotal?: number;
  taxTotal?: number;
  grandTotal?: number;
  createdAt?: string;
  updatedAt?: string;
  sentAt?: string;
  acceptedAt?: string;
  rejectedAt?: string;
  expiredAt?: string;
}

export interface QuoteNormalizationPreview {
  quoteId: string;
  disposition: CanonicalMigrationDisposition;
  canAutoMigrate: boolean;
  candidate?: Quote;
  issues: CanonicalMigrationIssue[];
}

/**
 * Tooling-only deterministic preview for legacy Deal normalization.
 * Runtime code must not import migration code.
 */
export function previewDealNormalization(
  legacy: DealNormalizationSourceInput,
  options: { buyerRef?: BuyerRef } = {},
): DealNormalizationPreview {
  const collector = new CanonicalMigrationIssueCollector();
  let disposition: CanonicalMigrationDisposition = "SAFE";
  const buyerRef = options.buyerRef ?? legacy.buyerRef;
  const canonicalStage = inferCanonicalDealStage(legacy, collector);

  const inferredStage = canonicalStage !== String(legacy.stage).toUpperCase();
  if (inferredStage && collector.list().length === 0) disposition = "INFER";

  const nextActionAt = legacy.nextActionAt ?? legacy.nextActivity?.date;
  const nextActionSummary = legacy.nextActionSummary ?? legacy.nextActivity?.title ?? legacy.nextActivity?.type;
  const active = canonicalStage !== DealStage.WON && canonicalStage !== DealStage.LOST;

  if (!buyerRef) {
    disposition = "REVIEW";
    collector.add({
      sourceType: "Deal",
      sourceId: legacy.id,
      disposition: "REVIEW",
      severity: "ERROR",
      rule: "DEAL_BUYER_REF_REQUIRED",
      message: "Legacy Deal has no deterministic Contact or Organization Account buyer reference.",
      candidateResolution: "Resolve buyer identity before enabling the canonical Deal at runtime.",
    });
  }

  if (active && !legacy.nextActionAt && legacy.nextActivity?.date) {
    if (disposition === "SAFE") disposition = "INFER";
    collector.add({
      sourceType: "Deal",
      sourceId: legacy.id,
      disposition: "INFER",
      severity: "INFO",
      rule: "LEGACY_NEXT_ACTIVITY_TO_NEXT_ACTION",
      message: "Legacy nextActivity date can be deterministically mapped to canonical nextActionAt.",
    });
  }

  let recycleDecision: Deal["recycleDecision"];
  if (canonicalStage === DealStage.LOST) {
    if (legacy.recycleEligible === true) recycleDecision = "RECYCLE";
    if (legacy.recycleEligible === false) recycleDecision = "DO_NOT_RECYCLE";
    if (!legacy.lostReason?.trim() || !recycleDecision || (recycleDecision !== "DO_NOT_RECYCLE" && !legacy.revisitAt)) {
      disposition = "REVIEW";
      collector.add({
        sourceType: "Deal",
        sourceId: legacy.id,
        disposition: "REVIEW",
        severity: "ERROR",
        rule: "LOST_DEAL_RECYCLE_CONTRACT_INCOMPLETE",
        message: "Legacy LOST Deal requires loss reason, explicit recycle decision, and revisitAt when recyclable.",
      });
    }
  }

  const candidate: DealNormalizationPreview["candidate"] = {
    id: legacy.id,
    name: legacy.name,
    buyerRef,
    stage: canonicalStage,
    amount: legacy.amount ?? 0,
    opportunityScore: legacy.opportunityScore ?? 0,
    ownerId: legacy.ownerId,
    expectedCloseDate: legacy.expectedCloseDate,
    createdAt: legacy.createdAt,
    updatedAt: legacy.updatedAt,
    interestedProducts: [...(legacy.interestedProducts ?? [])],
    lineItems: [...(legacy.lineItems ?? [])],
    nextActionAt: active ? nextActionAt : undefined,
    nextActionSummary: active ? nextActionSummary : undefined,
    nextActionRef: active && nextActionAt ? { type: "MANUAL" } : undefined,
    lostReason: canonicalStage === DealStage.LOST ? legacy.lostReason : undefined,
    recycleDecision,
    recycleEligible: canonicalStage === DealStage.LOST ? legacy.recycleEligible : undefined,
    revisitAt: canonicalStage === DealStage.LOST ? legacy.revisitAt : undefined,
  };

  if (collector.list().some((issue) => issue.disposition === "REVIEW")) disposition = "REVIEW";
  return {
    dealId: legacy.id,
    disposition,
    canonicalStage,
    canAutoMigrate: disposition !== "REVIEW",
    candidate,
    issues: collector.list(),
  };
}

/** Tooling-only deterministic preview for Quote v1/version-lineage normalization. */
export function previewQuoteNormalization(
  legacy: QuoteNormalizationSourceInput,
  options: { buyerRef?: BuyerRef } = {},
): QuoteNormalizationPreview {
  const collector = new CanonicalMigrationIssueCollector();
  const buyerRef = options.buyerRef;
  if (!buyerRef) {
    collector.add({
      sourceType: "Quote",
      sourceId: legacy.id,
      disposition: "REVIEW",
      severity: "ERROR",
      rule: "QUOTE_BUYER_REF_REQUIRED",
      message: "Legacy Quote has no deterministic Contact or Organization Account buyer reference.",
      candidateResolution: "Resolve buyer identity before enabling the canonical Quote version.",
    });
    return {
      quoteId: legacy.id,
      disposition: "REVIEW",
      canAutoMigrate: false,
      issues: collector.list(),
    };
  }

  const status = normalizeQuoteStatus(legacy.status, collector, legacy.id);
  if (!status) {
    return {
      quoteId: legacy.id,
      disposition: "REVIEW",
      canAutoMigrate: false,
      issues: collector.list(),
    };
  }

  const sourcePath: Quote["sourcePath"] = legacy.dealId ? "DEAL" : "DIRECT_SALE";
  const candidate: Quote = {
    id: legacy.id,
    quoteNumber: legacy.quoteNumber,
    version: 1,
    rootQuoteId: legacy.id,
    buyerRef,
    sourcePath,
    dealId: legacy.dealId,
    sourceDealId: legacy.dealId,
    status,
    title: legacy.title ?? `Quote ${legacy.quoteNumber}`,
    lineItems: [...(legacy.lineItems ?? [])],
    subtotal: legacy.subtotal ?? 0,
    discountTotal: legacy.discountTotal,
    taxTotal: legacy.taxTotal,
    grandTotal: legacy.grandTotal ?? legacy.subtotal ?? 0,
    createdAt: legacy.createdAt ?? "1970-01-01T00:00:00.000Z",
    updatedAt: legacy.updatedAt,
    sentAt: legacy.sentAt,
    acceptedAt: legacy.acceptedAt,
    rejectedAt: legacy.rejectedAt,
    expiredAt: legacy.expiredAt,
  };

  collector.add({
    sourceType: "Quote",
    sourceId: legacy.id,
    disposition: "INFER",
    severity: "INFO",
    rule: "QUOTE_VERSION_ROOT_BACKFILL",
    message: "Legacy Quote is normalized as version 1 and its own rootQuoteId.",
  });
  if (!legacy.dealId) {
    collector.add({
      sourceType: "Quote",
      sourceId: legacy.id,
      disposition: "INFER",
      severity: "INFO",
      rule: "QUOTE_DIRECT_SALE_SOURCE_INFERRED",
      message: "Quote without Deal is preserved as a canonical Direct Sale Quote.",
    });
  }

  return {
    quoteId: legacy.id,
    disposition: "INFER",
    canAutoMigrate: true,
    candidate,
    issues: collector.list(),
  };
}

function inferCanonicalDealStage(
  legacy: DealNormalizationSourceInput,
  collector: CanonicalMigrationIssueCollector,
): DealStage {
  const stage = String(legacy.stage).toUpperCase();
  if (Object.values(DealStage).includes(stage as DealStage)) return stage as DealStage;
  if (stage === "NEW") return DealStage.DISCOVERY;
  if (stage === "CONSULTING") {
    if ((legacy.lineItems?.length ?? 0) > 0 || (legacy.interestedProducts?.length ?? 0) > 0) return DealStage.SOLUTION;
    if (legacy.buyerRef && legacy.ownerId && ((legacy.amount ?? 0) > 0 || Boolean(legacy.expectedCloseDate))) return DealStage.QUALIFIED;
    collector.add({
      sourceType: "Deal",
      sourceId: legacy.id,
      disposition: "REVIEW",
      severity: "WARNING",
      rule: "LEGACY_CONSULTING_STAGE_AMBIGUOUS",
      message: "Legacy CONSULTING has insufficient evidence to infer QUALIFIED versus SOLUTION; candidate falls back to DISCOVERY for review.",
    });
    return DealStage.DISCOVERY;
  }
  collector.add({
    sourceType: "Deal",
    sourceId: legacy.id,
    disposition: "REVIEW",
    severity: "WARNING",
    rule: "LEGACY_DEAL_STAGE_UNKNOWN",
    message: `Legacy Deal stage ${legacy.stage} is not a canonical semantic anchor.`,
  });
  return DealStage.DISCOVERY;
}

function normalizeQuoteStatus(
  status: string,
  collector: CanonicalMigrationIssueCollector,
  sourceId: string,
): QuoteStatus | undefined {
  const normalized = String(status).toUpperCase();
  if (Object.values(QuoteStatus).includes(normalized as QuoteStatus)) return normalized as QuoteStatus;
  collector.add({
    sourceType: "Quote",
    sourceId,
    disposition: "REVIEW",
    severity: "WARNING",
    rule: "LEGACY_QUOTE_STATUS_UNKNOWN",
    message: `Legacy Quote status ${status} cannot be normalized automatically.`,
  });
  return undefined;
}
