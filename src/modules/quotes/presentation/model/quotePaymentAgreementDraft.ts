import type { Quote, QuotePaymentTiming } from "../../domain/model/quote.types";
import { createDurableId } from "@/shared/ids";
import { money } from "@/shared/money";
import { canonicalPaymentMethodCodeForKind, isCanonicalCodMethodCode, type PaymentAgreementLineSnapshot, type PaymentAgreementSnapshot, type PaymentFulfillmentGate, type PaymentPurpose } from "@/shared/order-to-cash";

export interface PaymentAgreementDraftLine {
  id: string;
  label: string;
  purpose: PaymentPurpose;
  amountMode: "PERCENTAGE" | "REMAINDER";
  percentage: number;
  timing: QuotePaymentTiming;
  dueDays: number;
  methodCode: string;
  fulfillmentGate: PaymentFulfillmentGate;
}

export function allocateAgreementLineId(): string {
  return createDurableId("payment-term");
}

export function legacyAgreementDraftLine(input?: Pick<Quote, "paymentTiming" | "paymentDueDays" | "paymentMethod">): PaymentAgreementDraftLine {
  const timing = input?.paymentTiming ?? "PREPAID";
  const methodKind = input?.paymentMethod ?? "BANK_TRANSFER";
  const methodCode = canonicalPaymentMethodCodeForKind(methodKind);
  return {
    id: allocateAgreementLineId(),
    label: "Thanh toán toàn bộ",
    purpose: "FULL",
    amountMode: "REMAINDER",
    percentage: 100,
    timing,
    dueDays: input?.paymentDueDays ?? 0,
    methodCode,
    fulfillmentGate: methodKind === "COD" ? "NONE" : timing === "PREPAID" ? "BEFORE_COMPLETION" : "NONE",
  };
}

export function draftLinesFromAgreement(quote?: Quote): PaymentAgreementDraftLine[] {
  if (!quote?.paymentAgreement?.lines.length) return [legacyAgreementDraftLine(quote)];
  return quote.paymentAgreement.lines.map((line) => ({
    id: line.id,
    label: line.label,
    purpose: line.purpose,
    amountMode: line.amountRule.type === "REMAINDER" ? "REMAINDER" : "PERCENTAGE",
    percentage: line.amountRule.type === "PERCENTAGE" ? Number(line.amountRule.percentage) : 0,
    timing: line.dueRule.type === "EVENT_RELATIVE" && line.dueRule.event === "DELIVERY_CONFIRMED"
      ? "ON_DELIVERY"
      : line.dueRule.type === "EVENT_RELATIVE" && line.dueRule.offsetDays > 0
        ? "POSTPAID"
        : line.dueRule.type === "MILESTONE"
          ? "CUSTOM"
          : "PREPAID",
    dueDays: line.dueRule.type === "EVENT_RELATIVE" ? Math.max(0, line.dueRule.offsetDays) : 0,
    methodCode: line.preferredMethodCode ?? line.allowedMethodCodes[0] ?? canonicalPaymentMethodCodeForKind("BANK_TRANSFER"),
    fulfillmentGate: line.fulfillmentGate,
  }));
}

export function buildPaymentAgreementSnapshot(
  draftLines: readonly PaymentAgreementDraftLine[],
  total: number,
  currency: string,
  sourceQuoteId?: string,
): PaymentAgreementSnapshot {
  let allocated = 0;
  const lines: PaymentAgreementLineSnapshot[] = draftLines.map((line, index) => {
    const isRemainder = line.amountMode === "REMAINDER" || index === draftLines.length - 1;
    const preview = isRemainder ? Math.max(0, total - allocated) : Math.max(0, total * Math.max(0, line.percentage) / 100);
    allocated += preview;
    const dueRule = line.timing === "ON_DELIVERY"
      ? { type: "EVENT_RELATIVE" as const, event: "DELIVERY_CONFIRMED" as const, offsetDays: 0, dayBasis: "CALENDAR" as const }
      : line.timing === "POSTPAID"
        ? { type: "EVENT_RELATIVE" as const, event: "INVOICE_ISSUED" as const, offsetDays: Math.max(0, line.dueDays), dayBasis: "CALENDAR" as const }
        : line.timing === "CUSTOM"
          ? { type: "MILESTONE" as const, milestoneCode: `PAYMENT_${index + 1}`, offsetDays: Math.max(0, line.dueDays) }
          : { type: "EVENT_RELATIVE" as const, event: "ORDER_CONFIRMED" as const, offsetDays: 0, dayBasis: "CALENDAR" as const };
    return {
      id: line.id,
      sequence: index + 1,
      label: line.label.trim() || `Đợt ${index + 1}`,
      purpose: line.purpose,
      amountRule: isRemainder
        ? { type: "REMAINDER" as const }
        : { type: "PERCENTAGE" as const, percentage: String(Math.max(0, line.percentage)) },
      previewAmount: money(String(preview), currency),
      dueRule,
      allowedMethodCodes: [line.methodCode],
      preferredMethodCode: line.methodCode,
      fulfillmentGate: isCanonicalCodMethodCode(line.methodCode) ? "NONE" : line.fulfillmentGate,
      invoicePolicyCode: line.purpose === "DEPOSIT" ? "DEPOSIT_INVOICE_ALLOWED" : "STANDARD_ORDER_INVOICE",
    };
  });
  const kind = lines.length === 1 ? "FULL_PAYMENT" : lines.some((line) => line.purpose === "DEPOSIT") ? "DEPOSIT_AND_BALANCE" : "INSTALLMENT";
  return { version: 1, kind, currency, lines, sourceQuoteId, policyVersion: "quote-payment-agreement/v1" };
}


// Compare only command content; identity and previews remain server owned.
function agreementContent(value: PaymentAgreementSnapshot): string {
  const canonical = (input: unknown): unknown => Array.isArray(input)
    ? input.map(canonical)
    : input && typeof input === "object"
      ? Object.fromEntries(Object.entries(input).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]))
      : input;
  return JSON.stringify(canonical({ kind: value.kind, currency: value.currency, policyVersion: value.policyVersion,
    lines: value.lines.map(line => ({ sequence: line.sequence, label: line.label, purpose: line.purpose,
      amountRule: line.amountRule, dueRule: line.dueRule, allowedMethodCodes: line.allowedMethodCodes,
      preferredMethodCode: line.preferredMethodCode, channel: line.channel,
      fulfillmentGate: line.fulfillmentGate, invoicePolicyCode: line.invoicePolicyCode })) }));
}

export function canEditAgreementWithDraftControls(quote?: Quote): boolean {
  const original = quote?.paymentAgreement;
  return !original || agreementContent(original) === agreementContent(buildPaymentAgreementSnapshot(
    draftLinesFromAgreement(quote), 0, original.currency, quote.id,
  ));
}

export function resolveDraftPaymentAgreement(quote: Quote | undefined, lines: readonly PaymentAgreementDraftLine[], total: number, currency: string, sourceQuoteId?: string): PaymentAgreementSnapshot {
  if (quote?.paymentAgreement && (!canEditAgreementWithDraftControls(quote)
    || JSON.stringify(lines) === JSON.stringify(draftLinesFromAgreement(quote)))) return quote.paymentAgreement;
  return buildPaymentAgreementSnapshot(lines, total, currency, sourceQuoteId);
}
