import type { Contact } from "@/modules/contacts";
import type {
  PaymentFulfillmentGate,
  PaymentMethod,
  PaymentPlanType,
  PaymentPurpose,
  PaymentTerm,
  PaymentTiming,
} from "@/modules/payments";
import { createDurableId } from "@/shared/ids";
import { money } from "@/shared/money";
import { canonicalPaymentMethodCodeForKind, type PaymentAgreementSnapshot } from "@/shared/order-to-cash";

export interface DraftPaymentLine {
  localId: string;
  label: string;
  term: PaymentTerm;
  method: PaymentMethod;
  planType: PaymentPlanType;
  purpose: PaymentPurpose;
  timing: PaymentTiming;
  fulfillmentGate: PaymentFulfillmentGate;
  amountDue: number;
  dueDate: string;
}

export const PAYMENT_TERMS: PaymentTerm[] = ["DEPOSIT", "PREPAID", "POSTPAID"];
export const PAYMENT_PLAN_TYPES: PaymentPlanType[] = ["FULL_PAYMENT", "DEPOSIT_AND_BALANCE", "INSTALLMENT", "CUSTOM"];
export const PAYMENT_PURPOSES: PaymentPurpose[] = ["FULL", "DEPOSIT", "BALANCE", "INSTALLMENT", "OTHER"];
export const PAYMENT_TIMINGS: PaymentTiming[] = ["PREPAID", "ON_DELIVERY", "POSTPAID"];
export const PAYMENT_GATES: PaymentFulfillmentGate[] = ["NONE", "BEFORE_BOOKING", "BEFORE_COMPLETION"];
export const ORDER_COMMERCIAL_IMMUTABLE_ERROR = "Confirmed Order commercial content is immutable. Cancel the Order and create a replacement instead.";

export const PAYMENT_PLAN_TYPE_LABELS: Record<PaymentPlanType, { vi: string; en: string }> = {
  FULL_PAYMENT: { vi: "Thanh toán toàn bộ", en: "Full payment" },
  DEPOSIT_AND_BALANCE: { vi: "Đặt cọc và thanh toán phần còn lại", en: "Deposit and balance" },
  INSTALLMENT: { vi: "Thanh toán theo đợt", en: "Installments" },
  CUSTOM: { vi: "Tùy chỉnh", en: "Custom" },
};

export const PAYMENT_PURPOSE_LABELS: Record<PaymentPurpose, { vi: string; en: string }> = {
  FULL: { vi: "Toàn bộ giá trị đơn", en: "Full order value" },
  DEPOSIT: { vi: "Đặt cọc", en: "Deposit" },
  BALANCE: { vi: "Phần còn lại", en: "Balance" },
  INSTALLMENT: { vi: "Đợt thanh toán", en: "Installment" },
  OTHER: { vi: "Mục đích khác", en: "Other purpose" },
};

export const PAYMENT_TIMING_LABELS: Record<PaymentTiming, { vi: string; en: string }> = {
  PREPAID: { vi: "Thu trước", en: "Before delivery" },
  ON_DELIVERY: { vi: "Thu khi giao hàng", en: "On delivery" },
  POSTPAID: { vi: "Thu sau", en: "After delivery" },
};

export const PAYMENT_TERM_LABELS: Record<PaymentTerm, { vi: string; en: string }> = {
  DEPOSIT: { vi: "Điều khoản đặt cọc", en: "Deposit term" },
  PREPAID: { vi: "Điều khoản trả trước", en: "Prepaid term" },
  POSTPAID: { vi: "Điều khoản trả sau", en: "Postpaid term" },
};

export const PAYMENT_GATE_LABELS: Record<PaymentFulfillmentGate, { vi: string; en: string }> = {
  NONE: { vi: "Không chặn thực hiện đơn", en: "No fulfillment block" },
  BEFORE_BOOKING: { vi: "Cần thanh toán trước khi tạo vận đơn", en: "Required before shipment booking" },
  BEFORE_COMPLETION: { vi: "Cần thanh toán trước khi hoàn tất đơn", en: "Required before order completion" },
};

export function localizedPaymentLabel<T extends string>(
  map: Record<T, { vi: string; en: string }>,
  value: T,
  locale: string,
): string {
  return locale === "vi" ? map[value].vi : map[value].en;
}

export function customerName(customer: any): string {
  return customer?.displayName || customer?.companyName || customer?.individualName || customer?.name || "Unknown Customer";
}

export function contactName(contact: any): string {
  return contact?.fullName || contact?.name || "";
}

export interface RecipientPrefill {
  name: string;
  phone: string;
  email: string;
  addressLine1: string;
  city: string;
}

interface OrganizationRecipientSource {
  displayName?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export function recipientPrefill(contact?: Contact, customer?: any, organization?: OrganizationRecipientSource): RecipientPrefill {
  return {
    name: contactName(contact) || customerName(customer) || organization?.displayName || "",
    phone: contact?.mobilePhone || contact?.phone || contact?.workPhone || customer?.phone || organization?.phone || "",
    email: contact?.workEmail || contact?.email || contact?.personalEmail || customer?.billingEmail || customer?.email || organization?.email || "",
    addressLine1: contact?.address || customer?.address || customer?.billingAddress || organization?.address || "",
    city: customer?.city || "",
  };
}

export function nextOrderFormId(prefix: string): string {
  return createDurableId(prefix);
}

export function buildOrderPaymentAgreement(
  lines: readonly DraftPaymentLine[],
  currency: string,
  sourceQuoteId?: string,
): PaymentAgreementSnapshot {
  return {
    version: 1,
    kind: lines[0]?.planType ?? (lines.length > 1 ? "INSTALLMENT" : "FULL_PAYMENT"),
    currency,
    sourceQuoteId,
    policyVersion: "order-payment-agreement/v1",
    lines: lines.map((line, index) => {
      const methodCode = canonicalPaymentMethodCodeForKind(line.method);
      return {
        id: `schedule:${sourceQuoteId ?? "direct"}:${line.localId}`,
        sequence: index + 1,
        label: line.label || `Đợt ${index + 1}`,
        purpose: line.purpose,
        amountRule: index === lines.length - 1
          ? { type: "REMAINDER" as const }
          : { type: "FIXED" as const, amount: money(String(line.amountDue), currency) },
        previewAmount: money(String(line.amountDue), currency),
        dueRule: line.timing === "ON_DELIVERY"
          ? { type: "EVENT_RELATIVE" as const, event: "DELIVERY_CONFIRMED" as const, offsetDays: 0, dayBasis: "CALENDAR" as const }
          : line.timing === "POSTPAID"
            ? { type: "EVENT_RELATIVE" as const, event: "INVOICE_ISSUED" as const, offsetDays: 0, dayBasis: "CALENDAR" as const }
            : { type: "EVENT_RELATIVE" as const, event: "ORDER_CONFIRMED" as const, offsetDays: 0, dayBasis: "CALENDAR" as const },
        allowedMethodCodes: [methodCode],
        preferredMethodCode: methodCode,
        fulfillmentGate: line.method === "COD" ? "NONE" : line.fulfillmentGate,
        invoicePolicyCode: line.purpose === "DEPOSIT" ? "DEPOSIT_INVOICE_ALLOWED" : "STANDARD_ORDER_INVOICE",
      };
    }),
  };
}
