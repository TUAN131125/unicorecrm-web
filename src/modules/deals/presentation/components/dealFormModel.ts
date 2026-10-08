import type { SelectedPickerItem } from "@/modules/products";
import type { DealForecastCategory, DealLineItem, OpportunityStageConfig } from "../../domain/model/deal.types";
import { createDurableId } from "@/shared/ids";

export type DealFormMode = "create" | "edit";
export type DealPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type DealOpportunityType = "new_sale" | "upsell" | "cross_sell" | "renewal" | "consulting";

export interface DealOwnerOption {
  memberId: string;
  displayName: string;
}

export interface DealFormDraft {
  name: string;
  customerName: string;
  amount: number;
  ownerId: string;
  expectedCloseDate: string;
  stage: string;
  probability: number;
  forecastCategory: DealForecastCategory;
  source: string;
  pipeline: string;
  currency: string;
  priority: DealPriority;
  opportunityType: DealOpportunityType;
  demandSummary: string;
  painPoints: string;
  expectedBudget: number;
  nextActionSummary: string;
  nextActionAt: string;
  createFollowUpTask: boolean;
  notes: string;
  lineItems: SelectedPickerItem[];
}

function localDateTime(value: Date): string {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

function normalizeDateTime(value?: string): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : localDateTime(parsed);
}

export function createDraft(
  initialValues: Partial<DealFormDraft> | undefined,
  owners: DealOwnerOption[],
  stages: OpportunityStageConfig[],
  defaultCurrency: string,
): DealFormDraft {
  const openStages = stages.filter((stage) => stage.isActive && stage.category === "open").sort((left, right) => left.order - right.order);
  const stage = initialValues?.stage || openStages[0]?.code || "DISCOVERY";
  const stageConfig = stages.find((candidate) => candidate.code === stage);
  const lineItems = initialValues?.lineItems || [];
  const lineItemTotal = calculateLineItemTotal(lineItems);
  const amount = lineItems.length > 0 ? lineItemTotal : (initialValues?.amount ?? 0);

  return {
    name: initialValues?.name ?? "",
    customerName: initialValues?.customerName ?? "",
    amount,
    ownerId: initialValues?.ownerId || owners[0]?.memberId || "",
    expectedCloseDate: initialValues?.expectedCloseDate || "",
    stage,
    probability: initialValues?.probability ?? stageConfig?.probabilityDefault ?? 10,
    forecastCategory: initialValues?.forecastCategory ?? "PIPELINE",
    source: initialValues?.source ?? "Direct",
    pipeline: initialValues?.pipeline ?? "standard",
    currency: initialValues?.currency ?? defaultCurrency,
    priority: initialValues?.priority ?? "MEDIUM",
    opportunityType: initialValues?.opportunityType ?? "new_sale",
    demandSummary: initialValues?.demandSummary ?? "",
    painPoints: initialValues?.painPoints ?? "",
    expectedBudget: initialValues?.expectedBudget ?? amount,
    nextActionSummary: initialValues?.nextActionSummary ?? "",
    nextActionAt: normalizeDateTime(initialValues?.nextActionAt),
    createFollowUpTask: initialValues?.createFollowUpTask ?? Boolean(initialValues?.nextActionSummary || initialValues?.nextActionAt),
    notes: initialValues?.notes ?? "",
    lineItems,
  };
}

export function mapSelectedPickerItemsToDealLineItems(items: readonly SelectedPickerItem[]): DealLineItem[] {
  return items.map((item, index) => {
    const unitPrice = item.customPrice ?? item.product.listPrice ?? 0;
    const discountPercent = item.discountPercent ?? 0;
    const subtotal = unitPrice * item.quantity;
    const discountAmount = subtotal * discountPercent / 100;
    const lineTotal = subtotal - discountAmount;
    return {
      id: createDurableId(`deal_line_${index + 1}`),
      productId: item.product.id,
      skuSnapshot: item.product.sku,
      productNameSnapshot: item.product.name,
      productTypeSnapshot: item.product.type,
      descriptionSnapshot: item.product.description,
      quantity: item.quantity,
      unitPriceSnapshot: unitPrice,
      discountPercent,
      taxRateSnapshot: item.product.taxRate,
      taxModeSnapshot: item.taxMode || item.product.taxMode || "none",
      billingCycleSnapshot: item.billingCycle || item.product.billingCycle,
      lineSubtotal: subtotal,
      lineDiscountAmount: discountAmount,
      lineTaxAmount: 0,
      lineTotal,
      productName: item.product.name,
      description: item.product.description,
      unitPrice,
      taxRate: item.product.taxRate,
      taxMode: item.taxMode || item.product.taxMode || "none",
      subtotal,
      totalAmount: lineTotal,
    };
  });
}

export function calculateLineItemTotal(items: readonly SelectedPickerItem[]): number {
  return items.reduce((total, item) => {
    const price = item.customPrice ?? item.product.listPrice ?? 0;
    const discount = item.discountPercent ?? 0;
    return total + price * item.quantity * (1 - discount / 100);
  }, 0);
}
