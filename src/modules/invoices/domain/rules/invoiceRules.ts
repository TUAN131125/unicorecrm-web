import { addMoney, compareMoney, money, subtractMoney, sumMoney, type MoneyDto } from "@/shared/money";
import type { Invoice, ReceivableEntry } from "../model/invoice.types";

export interface ReceivableAllocationInput { invoiceId: string; amount: MoneyDto; state: "EFFECTIVE" | "REVERSED"; }
export interface ReceivableCreditInput { invoiceId: string; amount: MoneyDto; state: string; }

export function validateInvoiceDraft(invoice: Invoice): string[] {
  const blockers: string[] = [];
  if (!invoice.buyerRef?.id) blockers.push("INVOICE_BUYER_REQUIRED");
  if (!invoice.sellerSnapshot.displayName.trim()) blockers.push("INVOICE_SELLER_REQUIRED");
  if (!invoice.buyerSnapshot.displayName.trim()) blockers.push("INVOICE_BUYER_SNAPSHOT_REQUIRED");
  if (invoice.lines.length === 0) blockers.push("INVOICE_LINE_REQUIRED");
  if (!invoice.currency.trim()) blockers.push("INVOICE_CURRENCY_REQUIRED");
  for (const [index, line] of invoice.lines.entries()) {
    if (!line.id || !line.description.trim()) blockers.push(`INVOICE_LINE_INVALID:${index}`);
    const quantity = Number(line.quantity);
    const invoiceableQuantity = Number(line.invoiceableQuantity ?? line.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) blockers.push(`INVOICE_LINE_QUANTITY_INVALID:${index}`);
    if (Number.isFinite(invoiceableQuantity) && quantity > invoiceableQuantity) blockers.push(`INVOICE_LINE_OVER_INVOICED:${index}`);
    if ([line.unitPrice, line.discountAmount, line.taxAmount, line.lineTotal].some((value) => value.currency !== invoice.currency)) blockers.push(`INVOICE_LINE_CURRENCY_MISMATCH:${index}`);
    if ([line.unitPrice, line.discountAmount, line.taxAmount, line.lineTotal].some((value) => compareMoney(value, money("0", invoice.currency)) < 0)) blockers.push(`INVOICE_LINE_NEGATIVE_AMOUNT:${index}`);
  }
  const lineTotal = sumMoney(invoice.lines.map((line) => line.lineTotal), invoice.currency);
  const roundingAdjustment = invoice.totals.roundingAdjustment ?? money("0", invoice.currency);
  if (compareMoney(addMoney(lineTotal, roundingAdjustment), invoice.totals.grandTotal) !== 0) blockers.push("INVOICE_TOTAL_MISMATCH");
  return blockers;
}

export function assertInvoiceMutable(invoice: Invoice): void {
  if (invoice.lifecycleState !== "DRAFT" && invoice.lifecycleState !== "ISSUE_FAILED") throw new Error(`Invoice ${invoice.id} is immutable in state ${invoice.lifecycleState}.`);
}

export function invoiceCommercialFingerprint(invoice: Invoice): string {
  return JSON.stringify({
    buyerRef: invoice.buyerRef,
    sellerSnapshot: invoice.sellerSnapshot,
    buyerSnapshot: invoice.buyerSnapshot,
    currency: invoice.currency,
    lines: invoice.lines,
    totals: invoice.totals,
    sourceLinks: invoice.sourceLinks,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
  });
}

function agingBucket(dueDate: string | undefined, asOfDate: string, agingBuckets: readonly number[]): ReceivableEntry["agingBucket"] {
  if (!dueDate || dueDate >= asOfDate) return dueDate && dueDate > asOfDate ? "NOT_DUE" : "CURRENT";
  const days = Math.max(1, Math.floor((Date.parse(`${asOfDate}T00:00:00Z`) - Date.parse(`${dueDate}T00:00:00Z`)) / 86_400_000));
  const [first = 30, second = 60, third = 90] = agingBuckets;
  if (days <= first) return "1_30";
  if (days <= second) return "31_60";
  if (days <= third) return "61_90";
  return "90_PLUS";
}

export function projectReceivable(
  invoice: Invoice,
  allocations: readonly ReceivableAllocationInput[],
  credits: readonly ReceivableCreditInput[],
  asOfDate: string,
  agingBuckets: readonly number[] = [30, 60, 90],
): ReceivableEntry | undefined {
  if (invoice.lifecycleState !== "ISSUED" || !invoice.invoiceNumber || !invoice.issueDate) return undefined;
  const allocatedAmount = sumMoney(allocations.filter((item) => item.invoiceId === invoice.id && item.state === "EFFECTIVE").map((item) => item.amount), invoice.currency);
  const creditedAmount = sumMoney(credits.filter((item) => item.invoiceId === invoice.id && item.state === "ISSUED").map((item) => item.amount), invoice.currency);
  const totalReductions = addMoney(allocatedAmount, creditedAmount);
  const outstandingAmount = compareMoney(totalReductions, invoice.totals.grandTotal) >= 0 ? money("0", invoice.currency) : subtractMoney(invoice.totals.grandTotal, totalReductions);
  const bucket = agingBucket(invoice.dueDate, asOfDate, agingBuckets);
  const zero = money("0", invoice.currency);
  let settlementState: ReceivableEntry["settlementState"];
  if (compareMoney(outstandingAmount, zero) === 0) settlementState = compareMoney(creditedAmount, zero) > 0 && compareMoney(allocatedAmount, zero) === 0 ? "CREDITED" : "PAID";
  else if (compareMoney(allocatedAmount, zero) > 0 || compareMoney(creditedAmount, zero) > 0) settlementState = "PARTIAL";
  else if (invoice.dueDate && invoice.dueDate > asOfDate) settlementState = "NOT_DUE";
  else if (bucket !== "CURRENT" && bucket !== "NOT_DUE") settlementState = "OVERDUE";
  else settlementState = "UNPAID";
  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    buyerRef: invoice.buyerRef,
    buyerName: invoice.buyerSnapshot.displayName,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    originalAmount: invoice.totals.grandTotal,
    allocatedAmount,
    creditedAmount,
    outstandingAmount,
    settlementState,
    agingBucket: bucket,
    version: invoice.version,
  };
}
