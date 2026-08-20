import type { QuoteApprovalPolicyConfig } from "@/shared/order-to-cash";

import {
  QuoteApprovalStatus,
  SalesDocumentAdjustmentType,
  type Quote,
  type QuoteApprovalReason,
} from "../model/quote.types";
import { quoteContentFingerprint } from "./quoteVersioning";

export const DEFAULT_QUOTE_APPROVAL_POLICY: QuoteApprovalPolicyConfig = {
  policyVersion: "quote-policy-v1",
  alwaysRequireApproval: false,
  maxLineDiscountPercentWithoutApproval: 10,
  maxTotalDiscountPercentWithoutApproval: 10,
  maxGrandTotalWithoutApproval: 100_000_000,
  maxPostpaidDaysWithoutApproval: 30,
  requireApprovalForCustomPaymentTerms: true,
  approverRoleLabel: "Quản lý kinh doanh",
};

export interface QuoteApprovalAssessment {
  required: boolean;
  reasons: QuoteApprovalReason[];
  policyVersion: string;
  approverRoleLabel?: string;
}

export function evaluateQuoteApproval(
  quote: Pick<Quote, "lineItems" | "subtotal" | "discountTotal" | "grandTotal" | "paymentTiming" | "paymentDueDays">,
  policy: QuoteApprovalPolicyConfig = DEFAULT_QUOTE_APPROVAL_POLICY,
): QuoteApprovalAssessment {
  const reasons: QuoteApprovalReason[] = [];
  const maxLineDiscount = quote.lineItems.reduce((maximum, line) => Math.max(maximum, Number(line.discountPercent || 0)), 0);
  const totalDiscountPercent = quote.subtotal > 0 ? ((quote.discountTotal ?? 0) / quote.subtotal) * 100 : 0;

  if (policy.alwaysRequireApproval) {
    reasons.push({ code: "MANUAL_REVIEW", label: "Workspace yêu cầu phê duyệt mọi Báo giá." });
  }
  if (maxLineDiscount > policy.maxLineDiscountPercentWithoutApproval) {
    reasons.push({
      code: "LINE_DISCOUNT_LIMIT",
      label: `Chiết khấu dòng ${maxLineDiscount.toFixed(1)}% vượt hạn mức ${policy.maxLineDiscountPercentWithoutApproval}%.`,
      actual: maxLineDiscount,
      limit: policy.maxLineDiscountPercentWithoutApproval,
    });
  }
  if (totalDiscountPercent > policy.maxTotalDiscountPercentWithoutApproval) {
    reasons.push({
      code: "TOTAL_DISCOUNT_LIMIT",
      label: `Tổng chiết khấu ${totalDiscountPercent.toFixed(1)}% vượt hạn mức ${policy.maxTotalDiscountPercentWithoutApproval}%.`,
      actual: Number(totalDiscountPercent.toFixed(2)),
      limit: policy.maxTotalDiscountPercentWithoutApproval,
    });
  }
  if (quote.grandTotal > policy.maxGrandTotalWithoutApproval) {
    reasons.push({
      code: "GRAND_TOTAL_LIMIT",
      label: `Giá trị Báo giá vượt hạn mức gửi thẳng ${new Intl.NumberFormat("vi-VN").format(policy.maxGrandTotalWithoutApproval)} VND.`,
      actual: quote.grandTotal,
      limit: policy.maxGrandTotalWithoutApproval,
    });
  }
  if (quote.paymentTiming === "POSTPAID" && (quote.paymentDueDays ?? 0) > policy.maxPostpaidDaysWithoutApproval) {
    reasons.push({
      code: "POSTPAID_DAYS_LIMIT",
      label: `Trả sau ${quote.paymentDueDays} ngày vượt hạn mức ${policy.maxPostpaidDaysWithoutApproval} ngày.`,
      actual: quote.paymentDueDays,
      limit: policy.maxPostpaidDaysWithoutApproval,
    });
  }
  if (quote.paymentTiming === "CUSTOM" && policy.requireApprovalForCustomPaymentTerms) {
    reasons.push({ code: "CUSTOM_PAYMENT_TERMS", label: "Điều khoản thanh toán tùy chỉnh cần được phê duyệt." });
  }

  return {
    required: reasons.length > 0,
    reasons,
    policyVersion: policy.policyVersion,
    approverRoleLabel: policy.approverRoleLabel,
  };
}

export function applyQuoteApprovalAssessment(
  quote: Quote,
  policy: QuoteApprovalPolicyConfig = DEFAULT_QUOTE_APPROVAL_POLICY,
): Quote {
  const assessment = evaluateQuoteApproval(quote, policy);
  const fingerprint = quoteContentFingerprint(quote);
  const approvalStillMatches = quote.approvalContentFingerprint === fingerprint;

  if (!assessment.required) {
    return {
      ...quote,
      approvalRequired: false,
      approvalStatus: QuoteApprovalStatus.NOT_REQUIRED,
      approvalReasons: [],
      approvalPolicyVersion: assessment.policyVersion,
      approvalRequestedAt: undefined,
      approvalRequestedBy: undefined,
      approvedAt: undefined,
      approvedBy: undefined,
      approvalDecisionNote: undefined,
      approvalContentFingerprint: fingerprint,
    };
  }

  if (approvalStillMatches && quote.approvalStatus === QuoteApprovalStatus.APPROVED) {
    return {
      ...quote,
      approvalRequired: true,
      approvalReasons: assessment.reasons,
      approvalPolicyVersion: assessment.policyVersion,
    };
  }

  const keepPending = approvalStillMatches && quote.approvalStatus === QuoteApprovalStatus.PENDING;
  const keepChangesRequested = approvalStillMatches && quote.approvalStatus === QuoteApprovalStatus.CHANGES_REQUESTED;
  return {
    ...quote,
    approvalRequired: true,
    approvalStatus: keepPending
      ? QuoteApprovalStatus.PENDING
      : keepChangesRequested
        ? QuoteApprovalStatus.CHANGES_REQUESTED
        : QuoteApprovalStatus.PENDING,
    approvalReasons: assessment.reasons,
    approvalPolicyVersion: assessment.policyVersion,
    approvalRequestedAt: keepPending || keepChangesRequested ? quote.approvalRequestedAt : undefined,
    approvalRequestedBy: keepPending || keepChangesRequested ? quote.approvalRequestedBy : undefined,
    approvedAt: undefined,
    approvedBy: undefined,
    approvalDecisionNote: keepChangesRequested ? quote.approvalDecisionNote : undefined,
    approvalContentFingerprint: keepPending || keepChangesRequested ? quote.approvalContentFingerprint : fingerprint,
  };
}

export function isQuoteApprovalCurrent(quote: Quote): boolean {
  if (!quote.approvalRequired) return true;
  return quote.approvalStatus === QuoteApprovalStatus.APPROVED
    && quote.approvalContentFingerprint === quoteContentFingerprint(quote);
}

export function canQuoteBeSent(quote: Quote): boolean {
  return !quote.approvalRequired || isQuoteApprovalCurrent(quote);
}

export function quoteHasExplicitDiscount(quote: Quote): boolean {
  return (quote.discountTotal ?? 0) > 0
    || Boolean(quote.adjustments?.some((adjustment) => adjustment.type === SalesDocumentAdjustmentType.DISCOUNT && adjustment.value > 0));
}
