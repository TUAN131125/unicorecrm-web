import type { Quote, QuoteLineItem, SalesDocumentAdjustment } from "../../domain/model/quote.types";
import type { ApplicationError } from "@/shared/domain";
import { isValidEmail } from "@/shared/lib/contactDataValidation";

export interface QuoteBuilderIssue { target: string; message: string; binding?: string; buyerVersion?: number }

/** Keep each server error bound to its own input and to the owner version it rejected. */
export function quoteBuilderFieldFeedback(quote: Partial<Quote>, buyer: { version?: number; state: string; canReadStatus: boolean; status?: string }) {
  const fieldBinding = (target: string) => quoteBuilderFieldBinding(target, quote);
  const fieldIssueCurrent = (issue: QuoteBuilderIssue) => {
    if (issue.binding !== undefined && issue.binding !== fieldBinding(issue.target)) return false;
    const updatedEligibleBuyer = issue.target === "quote-buyer" && issue.buyerVersion !== undefined && buyer.version !== undefined
      && issue.buyerVersion !== buyer.version && buyer.state === "READY" && buyer.canReadStatus
      && (quote.buyerRef?.type === "ORGANIZATION_ACCOUNT" ? buyer.status === "active" : buyer.status !== "archived");
    return !updatedEligibleBuyer;
  };
  return { fieldBinding, fieldIssueCurrent };
}

/** Presentation of existing draft constraints; saving still uses the owning validator. */
export function quoteBuilderIssues(title: string, lines: readonly QuoteLineItem[], vi: boolean, adjustments: readonly SalesDocumentAdjustment[] = [], email?: string): QuoteBuilderIssue[] {
  const issues: QuoteBuilderIssue[] = [];
  if (!title.trim()) issues.push({ target: "quote-title", message: vi ? "Nhập tiêu đề báo giá." : "Enter a quote title." });
  if (!isValidEmail(email)) issues.push({ target: "quote-recipient-email", message: vi ? "Vui lòng nhập địa chỉ email hợp lệ hoặc để trống khi lưu nháp." : "Enter a valid email address or leave it blank for a draft." });
  if (!lines.length) issues.push({ target: "quote-lines", message: vi ? "Thêm ít nhất một dòng hàng." : "Add at least one line item." });
  lines.forEach((line, index) => {
    const prefix = vi ? `Dòng ${index + 1}` : `Line ${index + 1}`;
    const add = (field: string, message: string) => issues.push({ target: `line-${line.id}-${field}`, message: `${prefix}: ${message}` });
    if (!(line.productNameSnapshot ?? line.productName ?? "").trim()) add("name", vi ? "nhập tên sản phẩm/dịch vụ." : "enter a product/service name.");
    const validDecimal = (field: "quantity" | "unitPrice" | "discountRate") => {
      const value = line.inputDecimals?.[field];
      return value === undefined || /^(0|[1-9][0-9]*)(\.[0-9]{1,6})?$/.test(value);
    };
    if (line.quantity <= 0 || !validDecimal("quantity")) add("quantity", vi ? "số lượng phải lớn hơn 0, tối đa 6 chữ số lẻ." : "quantity must be positive, with at most 6 decimal places.");
    if ((line.unitPriceSnapshot ?? line.unitPrice ?? 0) < 0 || !validDecimal("unitPrice")) add("price", vi ? "đơn giá phải không âm, tối đa 6 chữ số lẻ." : "unit price must be non-negative, with at most 6 decimal places.");
    if (line.discountPercent < 0 || line.discountPercent > 100 || !validDecimal("discountRate")) add("discount", vi ? "chiết khấu phải từ 0 đến 100%." : "discount must be between 0 and 100%.");
  });
  adjustments.forEach((item, index) => {
    if (item.value < 0 || item.valueDecimal !== undefined && !/^(0|[1-9][0-9]*)(\.[0-9]{1,6})?$/.test(item.valueDecimal)) issues.push({ target: `adjustment-${item.id}-value`, message: vi ? `Điều chỉnh ${index + 1}: nhập số không âm, tối đa sáu chữ số lẻ.` : `Adjustment ${index + 1}: enter a non-negative number with at most six decimal places.` });
  });
  return issues;
}

export function quoteBuilderServerIssues(fields: Readonly<Record<string, readonly string[]>> | undefined, lines: readonly QuoteLineItem[], vi: boolean): QuoteBuilderIssue[] {
  const known: Record<string, [string, string, string]> = {
    title: ["quote-title", "Tiêu đề báo giá", "Quote title"],
    recipientEmail: ["quote-recipient-email", "Email người nhận", "Recipient email"],
    currency: ["quote-currency", "Tiền tệ", "Currency"],
    validUntil: ["quote-valid-until", "Thời hạn báo giá", "Quote validity"],
    notes: ["quote-notes", "Điều khoản và ghi chú", "Terms and notes"],
    buyerRef: ["quote-buyer", "Người mua chưa đủ điều kiện tạo báo giá. Kiểm tra trạng thái và quyền truy cập hồ sơ nguồn", "The buyer is not eligible for this quote. Check source record status and access"],
    sourceDealId: ["referenced-deal-selector", "Cơ hội liên kết", "Linked opportunity"],
    paymentAgreement: ["quote-payment-terms", "Điều khoản thanh toán", "Payment terms"],
    lineItems: ["quote-lines", "Danh sách dòng hàng", "Line items"],
  };
  const issues: QuoteBuilderIssue[] = [];
  for (const rawKey of Object.keys(fields ?? {})) {
    const key = rawKey.replace(/^\$\./, "");
    let field = Object.hasOwn(known, key) ? known[key] : undefined;
    if (/^buyerRef[.\[]/.test(key)) field = known.buyerRef;
    if (/^paymentAgreement[.\[]/.test(key)) field = known.paymentAgreement;
    const match = /^lineItems\[(\d+)\]\.(productNameSnapshot|productId|quantity|unitPrice(?:\.amount)?|discountRate)$/.exec(key);
    if (match) {
      const line = lines[Number(match[1])];
      const part = match[2] === "quantity" ? "quantity" : match[2]?.startsWith("unitPrice") ? "price" : match[2] === "discountRate" ? "discount" : "name";
      if (line) field = [`line-${line.id}-${part}`, `Dòng hàng ${Number(match[1]) + 1}`, `Line item ${Number(match[1]) + 1}`];
    }
    if (field && !issues.some(issue => issue.target === field[0])) issues.push({ target: field[0], message: field[0] === "quote-buyer" ? `${field[vi ? 1 : 2]}.` : vi ? `${field[1]}: kiểm tra và cập nhật thông tin hợp lệ.` : `${field[2]}: review and enter valid information.` });
  }
  return issues;
}

/** Compare only the affected input; editing one field must not clear another field's error. */
export function quoteBuilderFieldBinding(target: string, quote: Partial<Quote>): string {
  const fields: Record<string, unknown> = {
    "quote-title": quote.title, "quote-recipient-email": quote.recipientEmail,
    "quote-currency": quote.currency, "quote-valid-until": quote.validUntil,
    "quote-notes": quote.notes,
    "quote-buyer": quote.buyerRef, "referenced-deal-selector": quote.sourceDealId,
    "quote-payment-terms": quote.paymentAgreement, "quote-lines": quote.lineItems,
  };
  if (Object.hasOwn(fields, target)) return JSON.stringify(fields[target]) ?? "";
  const adjustment = quote.adjustments?.find(item => target === `adjustment-${item.id}-value`);
  if (adjustment) return JSON.stringify(adjustment.valueDecimal ?? adjustment.value);
  const line = quote.lineItems?.find(item => target.startsWith(`line-${item.id}-`));
  if (!line) return "";
  const part = target.slice(`line-${line.id}-`.length);
  const value = part === "name" ? line.productNameSnapshot ?? line.productName
    : part === "quantity" ? line.inputDecimals?.quantity ?? line.quantity
    : part === "price" ? line.inputDecimals?.unitPrice ?? line.unitPriceSnapshot ?? line.unitPrice
    : line.inputDecimals?.discountRate ?? line.discountPercent;
  return JSON.stringify(value) ?? "";
}

export function focusFirstQuoteBuilderIssue(issues: readonly QuoteBuilderIssue[]): void {
  const targets = new Set(issues.map(issue => issue.target));
  const first = [...document.querySelectorAll<HTMLElement>("[data-quote-error-target]")].find(element => targets.has(element.dataset.quoteErrorTarget ?? "") && element.getClientRects().length > 0 && !element.hasAttribute("disabled"));
  const target = first?.dataset.quoteErrorTarget ?? issues[0]?.target;
  if (target) focusQuoteBuilderField(target);
}

export function quoteBuilderSubmissionIssues(error: ApplicationError, lines: readonly QuoteLineItem[], vi: boolean): QuoteBuilderIssue[] {
  const fields: Record<string, readonly string[]> = error.category === "VALIDATION" ? { ...error.fieldErrors } : {};
  const detail = error.details;
  if (error.code === "CONTRACT_VIOLATION" && detail && typeof detail === "object" && "direction" in detail && detail.direction === "request" && "issues" in detail && Array.isArray(detail.issues)) {
    for (const issue of detail.issues) {
      if (issue && typeof issue === "object" && "path" in issue && typeof issue.path === "string") fields[issue.path] = [];
    }
  }
  return quoteBuilderServerIssues(fields, lines, vi);
}

export function focusQuoteBuilderField(target: string): void {
  const identified = document.getElementById(target);
  const controls = [...document.querySelectorAll<HTMLElement>("[data-quote-error-target]")].filter(element => element.dataset.quoteErrorTarget === target);
  if (identified) controls.push(...identified.querySelectorAll<HTMLElement>("input, select, textarea, button"), identified);
  const control = controls.find(element => element.getClientRects().length > 0 && !element.hasAttribute("disabled"));
  control?.scrollIntoView({ block: "center", behavior: "auto" });
  control?.focus({ preventScroll: true });
}
