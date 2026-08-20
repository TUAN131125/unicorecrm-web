import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import path from "node:path";
import {
  QuoteApprovalStatus,
  QuoteStatus,
  applyQuoteApprovalAssessment,
  canQuoteBeSent,
  evaluateQuoteApproval,
  isQuoteApprovalCurrent,
  type Quote,
} from "@/modules/quotes";
import { normalizePdfColorValue } from "@/modules/quotes/presentation/services/quotePdfExport";
import { readPresentationComposition } from "../../../scripts/lib/presentationCompositionSource.mts";

const root = repositoryRoot;
const read = (file: string) => readPresentationComposition(path.join(root, file), "utf8");

const policy = {
  policyVersion: "quote-policy-contract-v1",
  alwaysRequireApproval: false,
  maxLineDiscountPercentWithoutApproval: 10,
  maxTotalDiscountPercentWithoutApproval: 10,
  maxGrandTotalWithoutApproval: 100_000_000,
  maxPostpaidDaysWithoutApproval: 30,
  requireApprovalForCustomPaymentTerms: true,
  approverRoleLabel: "Quản lý kinh doanh",
};

const standard = createQuote();
assert.equal(evaluateQuoteApproval(standard, policy).required, false, "Standard Quote must be eligible for direct customer delivery");
const standardAssessed = applyQuoteApprovalAssessment(standard, policy);
assert.equal(standardAssessed.approvalStatus, QuoteApprovalStatus.NOT_REQUIRED);
assert.equal(canQuoteBeSent(standardAssessed), true);

const discounted = applyQuoteApprovalAssessment(createQuote({
  lineItems: [{ id: "line-1", productName: "CRM", quantity: 1, unitPrice: 10_000_000, discountPercent: 15 }],
  subtotal: 8_500_000,
  grandTotal: 8_500_000,
}), policy);
assert.equal(discounted.approvalRequired, true);
assert.equal(discounted.approvalStatus, QuoteApprovalStatus.PENDING);
assert.equal(discounted.approvalReasons?.some((reason) => reason.code === "LINE_DISCOUNT_LIMIT"), true);
assert.equal(canQuoteBeSent(discounted), false);

const postpaid = applyQuoteApprovalAssessment(createQuote({ paymentTiming: "POSTPAID", paymentDueDays: 60 }), policy);
assert.equal(postpaid.approvalReasons?.some((reason) => reason.code === "POSTPAID_DAYS_LIMIT"), true);
const customTerms = applyQuoteApprovalAssessment(createQuote({ paymentTiming: "CUSTOM" }), policy);
assert.equal(customTerms.approvalReasons?.some((reason) => reason.code === "CUSTOM_PAYMENT_TERMS"), true);
const largeQuote = applyQuoteApprovalAssessment(createQuote({ subtotal: 150_000_000, grandTotal: 150_000_000 }), policy);
assert.equal(largeQuote.approvalReasons?.some((reason) => reason.code === "GRAND_TOTAL_LIMIT"), true);

const approved = {
  ...discounted,
  approvalStatus: QuoteApprovalStatus.APPROVED,
  approvalContentFingerprint: discounted.approvalContentFingerprint,
  approvedAt: "2026-07-10T12:00:00.000Z",
  approvedBy: "manager-1",
};
assert.equal(isQuoteApprovalCurrent(approved), true);
assert.equal(canQuoteBeSent(approved), true);
const changedAfterApproval = applyQuoteApprovalAssessment({
  ...approved,
  lineItems: approved.lineItems.map((line) => ({ ...line, unitPrice: (line.unitPrice ?? 0) + 500_000 })),
  subtotal: approved.subtotal + 500_000,
  grandTotal: approved.grandTotal + 500_000,
}, policy);
assert.equal(isQuoteApprovalCurrent(changedAfterApproval), false, "Commercial edits must invalidate approval fingerprint");
assert.equal(canQuoteBeSent(changedAfterApproval), false, "Edited approved Quote must be re-approved before delivery");

const model = read("src/modules/quotes/domain/model/quote.types.ts");
for (const marker of [
  "QuoteApprovalStatus",
  "approvalRequired?: boolean",
  "approvalReasons?: QuoteApprovalReason[]",
  "recipientEmail?: string",
  "QuoteDeliveryChannel",
  '"ZALO"',
  '"CHAT_APP"',
  "paymentTiming?: QuotePaymentTiming",
  "deliveryHistory?: QuoteDeliveryRecord[]",
]) {
  assert.ok(model.includes(marker), `Quote model must retain ${marker}`);
}

const approvalPolicy = read("src/modules/quotes/domain/rules/quoteApprovalPolicy.ts");
for (const marker of [
  "maxLineDiscountPercentWithoutApproval",
  "maxTotalDiscountPercentWithoutApproval",
  "maxGrandTotalWithoutApproval",
  "maxPostpaidDaysWithoutApproval",
  "requireApprovalForCustomPaymentTerms",
]) {
  assert.ok(approvalPolicy.includes(marker), `Approval policy must retain ${marker}`);
}

const commands = read("src/modules/quotes/application/commands/quoteCommands.ts");
assert.ok(commands.includes("canQuoteBeSent(current)"), "Send command must enforce approval readiness");
assert.ok(commands.includes("recordQuoteDelivery"), "Customer delivery must have a canonical command");
assert.ok(commands.includes("deliveryHistory"), "Customer delivery must preserve delivery evidence");

const builder = read("src/modules/quotes/presentation/pages/QuoteBuilderPage.tsx");
for (const marker of [
  'data-quote-approval-assessment="v1"',
  "handleRequestApproval",
  "handleSendGmail",
  "handleOpenDeliveryConfirmation",
  "handleExportPdf",
  "deliveryConfirmation",
  "recordQuoteDeliverySnapshot",
  "recipientEmail",
  "paymentTiming",
]) {
  assert.ok(builder.includes(marker), `Quote Builder must retain ${marker}`);
}
assert.ok(builder.includes("canQuoteBeSent(saved)"), "Builder must block Gmail delivery until approval is satisfied");

const preview = read("src/modules/quotes/presentation/components/QuoteBuilderPreview.tsx");
assert.ok(preview.includes('data-quote-pdf-source="true"'), "PDF capture must target the Quote document only");
assert.ok(preview.includes("onExportPdf") && preview.includes("onSendGmail") && preview.includes("onConfirmSent"), "Preview must expose PDF, Gmail and channel-neutral delivery actions");

const confirmationModal = read("src/modules/quotes/presentation/components/QuoteDeliveryConfirmationModal.tsx");
for (const marker of ["ZALO", "CHAT_APP", "SMS", "sentAt", "recipient", "quotes.delivery.confirm"]) {
  assert.ok(confirmationModal.includes(marker), `Delivery confirmation must retain ${marker}`);
}

const pdfService = read("src/modules/quotes/presentation/services/quotePdfExport.ts");
assert.ok(pdfService.includes('import("html2canvas")'));
assert.ok(pdfService.includes('import("jspdf")'));
assert.ok(pdfService.includes('pdf.output("blob")'), "PDF export must return a Blob for download/share");
assert.ok(pdfService.includes("normalizePdfColorValue") && pdfService.includes("onclone"), "PDF export must normalize modern CSS colors before html2canvas capture");
assert.equal(normalizePdfColorValue("oklch(62.3% 0.214 259.8)"), "rgb(43, 127, 255)");
assert.equal(normalizePdfColorValue("oklab(50% none none / 50%)").includes("oklab"), false);

const gmailService = read("src/modules/quotes/presentation/services/quoteGmailDelivery.ts");
assert.ok(gmailService.includes("navigator.canShare") && gmailService.includes("navigator.share"), "Supported browsers should share the generated PDF attachment");
assert.ok(gmailService.includes("https://mail.google.com/mail/"), "Desktop fallback must open Gmail compose");
assert.ok(gmailService.includes("downloadQuotePdf"), "Gmail fallback must make the PDF available for attachment");

const dealDetail = read("src/modules/deals/presentation/pages/DealDetailPage.tsx");
assert.ok(dealDetail.includes("action=gmail") && dealDetail.includes("action=pdf") && dealDetail.includes("action=confirm"));
assert.ok(dealDetail.includes("QuoteApprovalStatus"));

console.log("Quote approval, Gmail delivery and PDF contracts: PASS");

function createQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: "quote-contract",
    quoteNumber: "Q-CONTRACT",
    version: 1,
    rootQuoteId: "quote-contract",
    buyerRef: { type: "CONTACT", id: "contact-1" },
    sourcePath: "DIRECT_SALE",
    status: QuoteStatus.DRAFT,
    title: "Quote approval contract",
    lineItems: [{ id: "line-1", productName: "CRM", quantity: 1, unitPrice: 10_000_000, discountPercent: 0 }],
    subtotal: 10_000_000,
    grandTotal: 10_000_000,
    recipientEmail: "customer@example.com",
    paymentTiming: "PREPAID",
    paymentMethod: "BANK_TRANSFER",
    createdAt: "2026-07-10T00:00:00.000Z",
    ...overrides,
  };
}
