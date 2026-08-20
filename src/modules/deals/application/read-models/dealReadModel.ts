import type { BuyerRef } from "@/platform/identity";
import type { MoneyDto } from "@/shared/money";
import type {
  Deal,
  DealActivity,
  DealForecastCategory,
  DealForecastHistoryEntry,
  DealLineItem,
  DealNextActionRef,
  DealRecycleDecision,
  DealWinEvidence,
} from "../../domain/model/deal.types";

export interface DealLineReadModel {
  id: string;
  productId: string;
  skuSnapshot?: string;
  productNameSnapshot: string;
  productTypeSnapshot?: string;
  descriptionSnapshot?: string;
  quantity: string;
  unitPrice: MoneyDto;
  discountRate: string;
  taxRate?: string;
  taxMode: "EXCLUSIVE" | "INCLUSIVE" | "NONE";
  billingCycleSnapshot?: string;
  lineSubtotal: MoneyDto;
  lineDiscountAmount: MoneyDto;
  lineTaxAmount: MoneyDto;
  lineTotal: MoneyDto;
}

export interface DealReadModel {
  id: string;
  name: string;
  buyerRef: BuyerRef;
  stageCode: string;
  stageCategory: "OPEN" | "WON" | "LOST";
  amount: MoneyDto;
  opportunityScore: string;
  ownerId: string;
  expectedCloseDate: string;
  contactId?: string;
  sourceLeadId?: string;
  interestedProductIds: string[];
  lineItems: DealLineReadModel[];
  wonAt?: string;
  lostAt?: string;
  actualCloseDate?: string;
  lostReason?: string;
  notes?: string;
  archivedAt?: string;
  archiveReason?: string;
  resourceVersion: number;
  createdAt: string;
  updatedAt: string;
  forecastCategory?: DealForecastCategory;
  forecastHistory?: Array<{
    id: string;
    occurredAt: string;
    actor?: string;
    previousExpectedCloseDate: string;
    nextExpectedCloseDate: string;
    previousProbability: string;
    nextProbability: string;
    previousCategory: DealForecastCategory;
    nextCategory: DealForecastCategory;
  }>;
  stageEnteredAt?: string;
  nextActionAt?: string;
  nextActionSummary?: string;
  nextActionRef?: DealNextActionRef;
  winEvidence?: DealWinEvidence;
  lostReasonNote?: string;
  recycleDecision?: DealRecycleDecision;
  recycleEligible?: boolean;
  revisitAt?: string;
  activities?: Array<Omit<DealActivity, "metadata">>;
}

/**
 * UI display projection only. Decimal strings are converted to JS numbers
 * because the current Deal views predate canonical Money. No authoritative
 * total, eligibility, lifecycle or concurrency decision is calculated here.
 */
export function projectDealReadModel(record: DealReadModel): Deal {
  return {
    id: record.id,
    name: record.name,
    buyerRef: record.buyerRef,
    stage: record.stageCode,
    amount: displayNumber(record.amount.amount, "amount"),
    currency: record.amount.currency,
    opportunityScore: displayNumber(record.opportunityScore, "opportunityScore"),
    ownerId: record.ownerId,
    expectedCloseDate: record.expectedCloseDate,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    interestedProducts: [...record.interestedProductIds],
    lineItems: record.lineItems.map(projectLine),
    resourceVersion: record.resourceVersion,
    ...(record.contactId === undefined ? {} : { contactId: record.contactId }),
    ...(record.sourceLeadId === undefined ? {} : { leadId: record.sourceLeadId }),
    ...(record.wonAt === undefined ? {} : { wonAt: record.wonAt }),
    ...(record.lostAt === undefined ? {} : { lostAt: record.lostAt }),
    ...(record.actualCloseDate === undefined ? {} : { actualCloseDate: record.actualCloseDate }),
    ...(record.lostReason === undefined ? {} : { lostReason: record.lostReason }),
    ...(record.notes === undefined ? {} : { notes: record.notes }),
    ...(record.archivedAt === undefined ? {} : { archivedAt: record.archivedAt }),
    ...(record.archiveReason === undefined ? {} : { archiveReason: record.archiveReason }),
    ...(record.forecastCategory === undefined ? {} : { forecastCategory: record.forecastCategory }),
    ...(record.forecastHistory === undefined ? {} : { forecastHistory: record.forecastHistory.map(projectForecastHistory) }),
    ...(record.stageEnteredAt === undefined ? {} : { stageEnteredAt: record.stageEnteredAt }),
    ...(record.nextActionAt === undefined ? {} : { nextActionAt: record.nextActionAt }),
    ...(record.nextActionSummary === undefined ? {} : { nextActionSummary: record.nextActionSummary }),
    ...(record.nextActionRef === undefined ? {} : { nextActionRef: record.nextActionRef }),
    ...(record.winEvidence === undefined ? {} : { winEvidence: record.winEvidence }),
    ...(record.lostReasonNote === undefined ? {} : { lostReasonNote: record.lostReasonNote }),
    ...(record.recycleDecision === undefined ? {} : { recycleDecision: record.recycleDecision }),
    ...(record.recycleEligible === undefined ? {} : { recycleEligible: record.recycleEligible }),
    ...(record.revisitAt === undefined ? {} : { revisitAt: record.revisitAt }),
    ...(record.activities === undefined ? {} : { activities: record.activities.map((activity) => ({ ...activity })) }),
  };
}

function projectForecastHistory(entry: DealReadModel["forecastHistory"] extends Array<infer T> | undefined ? T : never): DealForecastHistoryEntry {
  return {
    ...entry,
    previousProbability: displayNumber(entry.previousProbability, "previousProbability"),
    nextProbability: displayNumber(entry.nextProbability, "nextProbability"),
  };
}

function projectLine(line: DealLineReadModel): DealLineItem {
  return {
    id: line.id,
    productId: line.productId,
    productNameSnapshot: line.productNameSnapshot,
    quantity: displayNumber(line.quantity, "quantity"),
    unitPriceSnapshot: displayNumber(line.unitPrice.amount, "unitPrice"),
    discountPercent: displayNumber(line.discountRate, "discountRate"),
    taxModeSnapshot: line.taxMode.toLowerCase() as "exclusive" | "inclusive" | "none",
    lineSubtotal: displayNumber(line.lineSubtotal.amount, "lineSubtotal"),
    lineDiscountAmount: displayNumber(line.lineDiscountAmount.amount, "lineDiscountAmount"),
    lineTaxAmount: displayNumber(line.lineTaxAmount.amount, "lineTaxAmount"),
    lineTotal: displayNumber(line.lineTotal.amount, "lineTotal"),
    ...(line.skuSnapshot === undefined ? {} : { skuSnapshot: line.skuSnapshot }),
    ...(line.productTypeSnapshot === undefined ? {} : { productTypeSnapshot: line.productTypeSnapshot }),
    ...(line.descriptionSnapshot === undefined ? {} : { descriptionSnapshot: line.descriptionSnapshot }),
    ...(line.taxRate === undefined ? {} : { taxRateSnapshot: displayNumber(line.taxRate, "taxRate") }),
    ...(line.billingCycleSnapshot === undefined ? {} : { billingCycleSnapshot: line.billingCycleSnapshot }),
  };
}

function displayNumber(value: string, field: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`DEAL_READ_MODEL_INVALID_DECIMAL:${field}`);
  return parsed;
}
