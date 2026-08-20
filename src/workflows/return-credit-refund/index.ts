import {
  createCreditNoteSnapshot,
  getInvoicesSnapshot,
  getReceivablesSnapshot,
  replaceInvoicesSnapshot,
  type CreditNote,
  type Invoice,
} from "@/modules/invoices";
import {
  allocatePaymentToInvoicesSnapshot,
  createRefundIntentAuthoritative,
  getPaymentsSnapshot,
  replacePaymentsSnapshot,
  reverseInvoiceAllocationSnapshot,
  type InvoicePaymentAllocation,
  type PaymentRecord,
  type RefundIntent,
} from "@/modules/payments";
import {
  completeReturnResolutionSnapshot,
  getReturnSnapshot,
  getReturnsSnapshot,
  linkReturnIntentExternalReferencesSnapshot,
  replaceReturnsSnapshot,
  requestCreditNoteResolutionSnapshot,
  requestRefundResolutionSnapshot,
  type ReturnRequest,
} from "@/modules/returns";
import { syncReturnResolutionIntentFromEvidence } from "@/workflows/return-resolution-evidence";
import { createDurableId } from "@/shared/ids";
import {
  addMoney,
  compareMoney,
  minMoney,
  money,
  subtractMoney,
  sumMoney,
  type MoneyDto,
} from "@/shared/money";
import {
  createMutationMetadata,
  executeMutationCommand,
  type MutationCommandMetadata,
  type MutationOutcome,
} from "@/shared/application";

export interface ExecuteReturnCreditRefundInput {
  returnId: string;
  amount: MoneyDto;
  reasonCode: string;
  reason: string;
  actorId: string;
  actorName?: string;
  now?: string;
}

export interface ReturnCreditRefundResult {
  request: ReturnRequest;
  creditNotes: CreditNote[];
  refundIntents: RefundIntent[];
  refundPaymentRecords: PaymentRecord[];
  creditedAmount: MoneyDto;
  refundedAmount: MoneyDto;
}

interface CreditPlanLine {
  invoice: Invoice;
  creditAmount: MoneyDto;
  cashRefundAmount: MoneyDto;
}

function assertReturnReady(request: ReturnRequest | undefined): asserts request is ReturnRequest {
  if (!request) throw new Error("Return not found.");
  if (request.status === "RESOLVED" || request.status === "CLOSED") {
    if (request.resolution?.type === "REFUND") return;
    throw new Error("Return is already resolved by another resolution type.");
  }
  if (request.status !== "RECEIVED" || !request.inspection) throw new Error("Return must be RECEIVED and inspected before credit/refund resolution.");
}

function buildCreditPlan(request: ReturnRequest, requestedAmount: MoneyDto): CreditPlanLine[] {
  const invoiceSnapshot = getInvoicesSnapshot();
  const receivables = getReceivablesSnapshot();
  const zero = money("0", requestedAmount.currency);
  let remaining = requestedAmount;
  const candidates = invoiceSnapshot.invoices
    .filter((invoice) => invoice.lifecycleState === "ISSUED" && invoice.sourceLinks.orderId === request.orderId && invoice.currency === requestedAmount.currency)
    .filter((invoice) => invoice.buyerRef.type === request.buyerRef.type && invoice.buyerRef.id === request.buyerRef.id)
    .sort((left, right) => (left.issueDate ?? left.createdAt).localeCompare(right.issueDate ?? right.createdAt));
  const plan: CreditPlanLine[] = [];
  for (const invoice of candidates) {
    if (compareMoney(remaining, zero) <= 0) break;
    const alreadyCredited = sumMoney(invoiceSnapshot.creditNotes
      .filter((note) => note.invoiceId === invoice.id && note.state === "ISSUED")
      .map((note) => note.total), invoice.currency);
    const creditable = subtractMoney(invoice.totals.grandTotal, alreadyCredited);
    if (compareMoney(creditable, zero) <= 0) continue;
    const creditAmount = minMoney(remaining, creditable);
    const outstandingBeforeCredit = receivables.find((entry) => entry.invoiceId === invoice.id)?.outstandingAmount ?? invoice.totals.grandTotal;
    const cashRefundAmount = compareMoney(creditAmount, outstandingBeforeCredit) > 0
      ? subtractMoney(creditAmount, outstandingBeforeCredit)
      : zero;
    plan.push({ invoice, creditAmount, cashRefundAmount });
    remaining = subtractMoney(remaining, creditAmount);
  }
  if (compareMoney(remaining, zero) > 0) throw new Error("RETURN_CREDIT_EXCEEDS_ISSUED_INVOICE_VALUE");
  return plan;
}

function currentSourceVersion(allocation: InvoicePaymentAllocation): number {
  const snapshot = getPaymentsSnapshot();
  if (allocation.paymentRecordId) {
    const payment = snapshot.paymentRecords.find((item) => item.id === allocation.paymentRecordId);
    if (!payment) throw new Error(`Payment source ${allocation.paymentRecordId} not found.`);
    return payment.version;
  }
  if (allocation.customerCreditId) {
    const credit = snapshot.customerCredits.find((item) => item.id === allocation.customerCreditId);
    if (!credit) throw new Error(`Customer Credit source ${allocation.customerCreditId} not found.`);
    return credit.version;
  }
  throw new Error("Allocation has no canonical source.");
}

function releasePaidAmountForInvoice(invoiceId: string, releaseAmount: MoneyDto, now: string): Map<string, MoneyDto> {
  const zero = money("0", releaseAmount.currency);
  let remaining = releaseAmount;
  const releasedByPayment = new Map<string, MoneyDto>();
  const allocations = getPaymentsSnapshot().allocations
    .filter((item) => item.invoiceId === invoiceId && item.state === "EFFECTIVE")
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

  for (const allocation of allocations) {
    if (compareMoney(remaining, zero) <= 0) break;
    if (allocation.amount.currency !== releaseAmount.currency) throw new Error("RETURN_ALLOCATION_CURRENCY_MISMATCH");
    if (allocation.customerCreditId) {
      // P0.6 production policy: the backend saga persists MANUAL_REVIEW_REQUIRED.
      // The demo simulator refuses to auto-reverse or consume Customer Credit.
      throw new Error("RETURN_CUSTOMER_CREDIT_ALLOCATION_MANUAL_REVIEW_REQUIRED");
    }
    if (!allocation.paymentRecordId) throw new Error("Return refund requires a Payment-backed allocation.");
    const release = minMoney(remaining, allocation.amount);
    const reallocateAmount = subtractMoney(allocation.amount, release);
    reverseInvoiceAllocationSnapshot(allocation.id, { expectedVersion: allocation.version, now, reasonCode: "PAYMENT_REVERSED", reason: `Return refund requires allocation reversal for invoice ${invoiceId}.` });

    if (compareMoney(reallocateAmount, zero) > 0) {
      const invoice = getInvoicesSnapshot().invoices.find((item) => item.id === invoiceId);
      const receivable = getReceivablesSnapshot().find((item) => item.invoiceId === invoiceId);
      if (!invoice || !receivable) throw new Error("Invoice/Receivable disappeared during return reallocation.");
      allocatePaymentToInvoicesSnapshot({
        paymentRecordId: allocation.paymentRecordId,
        expectedSourceVersion: currentSourceVersion(allocation),
        now,
        allocations: [{
          id: createDurableId("return_reallocation"),
          invoice: { invoiceId, buyerRef: invoice.buyerRef, outstandingAmount: receivable.outstandingAmount, version: invoice.version },
          amount: reallocateAmount,
          scheduleLineId: allocation.scheduleLineId,
          idempotencyKey: `return-reallocation:${allocation.id}:${release.amount}`,
        }],
      });
    }

    const currentReleased = releasedByPayment.get(allocation.paymentRecordId) ?? zero;
    releasedByPayment.set(allocation.paymentRecordId, addMoney(currentReleased, release));
    remaining = subtractMoney(remaining, release);
  }
  if (compareMoney(remaining, zero) > 0) throw new Error("RETURN_REFUND_EXCEEDS_EFFECTIVE_PAYMENT_ALLOCATIONS");
  return releasedByPayment;
}

function mergeReleased(target: Map<string, MoneyDto>, source: Map<string, MoneyDto>): void {
  for (const [paymentId, amount] of source) {
    const current = target.get(paymentId);
    target.set(paymentId, current ? addMoney(current, amount) : amount);
  }
}

export interface PreparedReturnCreditRefundEvidence extends Omit<ReturnCreditRefundResult, "request"> {
  request: ReturnRequest;
  creditIntentId: string;
  returnRefundIntentId?: string;
  returnIntentIds: string[];
}

function getExistingReturnEvidence(request: ReturnRequest, amount: MoneyDto): PreparedReturnCreditRefundEvidence | undefined {
  const invoiceSnapshot = getInvoicesSnapshot();
  const paymentSnapshot = getPaymentsSnapshot();
  const returnSnapshot = getReturnsSnapshot();
  const creditNotes = invoiceSnapshot.creditNotes.filter((note) => note.sourceReturnId === request.id && note.state === "ISSUED");
  if (!creditNotes.length) return undefined;
  const creditedAmount = sumMoney(creditNotes.map((note) => note.total), amount.currency);
  if (compareMoney(creditedAmount, amount) !== 0) throw new Error("RETURN_EXISTING_CREDIT_NOTE_AMOUNT_MISMATCH");
  const creditIntent = returnSnapshot.intents.find((intent) => intent.returnId === request.id && intent.target === "INVOICE" && intent.action === "CREDIT_NOTE" && intent.status === "SUCCEEDED");
  if (!creditIntent) throw new Error("RETURN_CREDIT_NOTE_INTENT_EVIDENCE_MISSING");
  const refundIntents = paymentSnapshot.refundIntents.filter((intent) => (intent.idempotencyKey ?? "").startsWith(`return-refund:${request.id}:`) && intent.state === "SUCCEEDED");
  const refundPaymentRecords = paymentSnapshot.paymentRecords.filter((record) => refundIntents.some((intent) => intent.refundPaymentRecordId === record.id) && record.kind === "REFUND" && record.state === "SUCCEEDED");
  const refundedAmount = sumMoney(refundPaymentRecords.map((record) => record.amount), amount.currency);
  const returnRefundIntent = returnSnapshot.intents.find((intent) => intent.returnId === request.id && intent.target === "PAYMENT" && intent.action === "REFUND" && intent.status === "SUCCEEDED");
  if (compareMoney(refundedAmount, money("0", amount.currency)) > 0 && !returnRefundIntent) throw new Error("RETURN_REFUND_INTENT_EVIDENCE_MISSING");
  return {
    request,
    creditNotes,
    refundIntents,
    refundPaymentRecords,
    creditedAmount,
    refundedAmount,
    creditIntentId: creditIntent.id,
    returnRefundIntentId: returnRefundIntent?.id,
    returnIntentIds: [creditIntent.id, ...(returnRefundIntent ? [returnRefundIntent.id] : [])],
  };
}

export async function prepareReturnCreditRefundEvidence(input: ExecuteReturnCreditRefundInput): Promise<PreparedReturnCreditRefundEvidence> {
  const invoiceBefore = getInvoicesSnapshot();
  const paymentBefore = getPaymentsSnapshot();
  const returnBefore = getReturnsSnapshot();
  const request = getReturnSnapshot(input.returnId);
  assertReturnReady(request);
  if (compareMoney(input.amount, money("0", input.amount.currency)) <= 0) throw new Error("Return credit amount must be greater than zero.");
  if (!input.reason.trim()) throw new Error("Return credit/refund reason is required.");
  const replay = getExistingReturnEvidence(request, input.amount);
  if (replay) return replay;
  const now = input.now ?? new Date().toISOString();

  try {
    const plan = buildCreditPlan(request, input.amount);
    const creditNotes: CreditNote[] = [];
    for (const line of plan) {
      creditNotes.push(await createCreditNoteSnapshot({
        invoiceId: line.invoice.id,
        sourceReturnId: request.id,
        expectedInvoiceVersion: line.invoice.version,
        reasonCode: "RETURN_ACCEPTED",
        reason: input.reason.trim(),
        amount: line.creditAmount,
        idempotencyKey: `return-credit-note:${request.id}:${line.invoice.id}`,
      }));
    }

    const creditIntent = requestCreditNoteResolutionSnapshot(request.id, {
      amount: input.amount,
      invoiceIds: creditNotes.map((note) => note.invoiceId),
      actorId: input.actorId,
      actorName: input.actorName,
      now,
    });
    linkReturnIntentExternalReferencesSnapshot(creditIntent.intent.id, { externalReferences: creditNotes.map((note) => note.id), actorId: input.actorId, actorName: input.actorName, now });
    syncReturnResolutionIntentFromEvidence(creditIntent.intent.id, { actorId: input.actorId, actorName: input.actorName, now });

    const releasedByPayment = new Map<string, MoneyDto>();
    for (const line of plan) {
      if (compareMoney(line.cashRefundAmount, money("0", line.cashRefundAmount.currency)) > 0) {
        mergeReleased(releasedByPayment, releasePaidAmountForInvoice(line.invoice.id, line.cashRefundAmount, now));
      }
    }

    const refundIntents: RefundIntent[] = [];
    const refundPaymentRecords: PaymentRecord[] = [];
    for (const [paymentRecordId, amount] of releasedByPayment) {
      const payment = getPaymentsSnapshot().paymentRecords.find((item) => item.id === paymentRecordId);
      if (!payment) throw new Error(`Payment ${paymentRecordId} not found after allocation release.`);
      const refundIntent = await createRefundIntentAuthoritative({
        id: createDurableId("refund_intent"),
        sourceReturnId: request.id,
        buyerRef: request.buyerRef,
        orderId: request.orderId,
        invoiceIds: plan.map((item) => item.invoice.id),
        paymentRecordId,
        expectedSourceVersion: payment.version,
        amount,
        reasonCode: "RETURN_ACCEPTED",
        reason: input.reason.trim(),
        idempotencyKey: `return-refund:${request.id}:${paymentRecordId}:${amount.amount}`,
        now,
      });
      if (refundIntent.state !== "SUCCEEDED" || !refundIntent.refundPaymentRecordId) throw new Error("Refund owner did not return SUCCEEDED evidence.");
      const refundRecord = getPaymentsSnapshot().paymentRecords.find((item) => item.id === refundIntent.refundPaymentRecordId);
      if (!refundRecord || refundRecord.kind !== "REFUND" || refundRecord.state !== "SUCCEEDED") throw new Error("Refund Payment record evidence is missing.");
      refundIntents.push(refundIntent);
      refundPaymentRecords.push(refundRecord);
    }

    const refundedAmount = sumMoney(refundPaymentRecords.map((record) => record.amount), input.amount.currency);
    const returnIntentIds = [creditIntent.intent.id];
    let returnRefundIntentId: string | undefined;
    if (compareMoney(refundedAmount, money("0", refundedAmount.currency)) > 0) {
      const paymentIntent = requestRefundResolutionSnapshot(request.id, {
        amount: refundedAmount,
        actorId: input.actorId,
        actorName: input.actorName,
        now,
      });
      returnRefundIntentId = paymentIntent.intent.id;
      linkReturnIntentExternalReferencesSnapshot(paymentIntent.intent.id, { externalReferences: refundPaymentRecords.map((record) => record.id), actorId: input.actorId, actorName: input.actorName, now });
      syncReturnResolutionIntentFromEvidence(paymentIntent.intent.id, { actorId: input.actorId, actorName: input.actorName, now });
      returnIntentIds.push(paymentIntent.intent.id);
    }

    return {
      request: getReturnSnapshot(request.id) ?? request,
      creditNotes,
      refundIntents,
      refundPaymentRecords,
      creditedAmount: input.amount,
      refundedAmount,
      creditIntentId: creditIntent.intent.id,
      returnRefundIntentId,
      returnIntentIds,
    };
  } catch (error) {
    replaceInvoicesSnapshot(invoiceBefore);
    replacePaymentsSnapshot(paymentBefore);
    replaceReturnsSnapshot(returnBefore);
    throw error;
  }
}

/** DEMO_ONLY local saga simulator. Connected production uses the typed backend saga operation. */
export async function executeReturnCreditRefund(input: ExecuteReturnCreditRefundInput): Promise<ReturnCreditRefundResult> {
  const request = getReturnSnapshot(input.returnId);
  assertReturnReady(request);
  if (request.resolution?.type === "REFUND") {
    const invoiceSnapshot = getInvoicesSnapshot();
    const paymentSnapshot = getPaymentsSnapshot();
    const creditNotes = invoiceSnapshot.creditNotes.filter((note) => request.resolution?.type === "REFUND" && request.resolution.creditNoteIds.includes(note.id));
    const refundIntents = paymentSnapshot.refundIntents.filter((intent) => request.resolution?.type === "REFUND" && request.resolution.refundIntentIds?.includes(intent.id));
    const refundPaymentRecords = paymentSnapshot.paymentRecords.filter((record) => request.resolution?.type === "REFUND" && request.resolution.refundPaymentRecordIds?.includes(record.id));
    return { request, creditNotes, refundIntents, refundPaymentRecords, creditedAmount: request.resolution.creditedAmount, refundedAmount: request.resolution.refundedAmount };
  }

  const invoiceBefore = getInvoicesSnapshot();
  const paymentBefore = getPaymentsSnapshot();
  const returnBefore = getReturnsSnapshot();
  try {
    const prepared = await prepareReturnCreditRefundEvidence(input);
    const now = input.now ?? new Date().toISOString();
    const resolved = completeReturnResolutionSnapshot(prepared.request.id, {
      resolution: {
        type: "REFUND",
        creditNoteIds: prepared.creditNotes.map((note) => note.id),
        refundIntentId: prepared.returnRefundIntentId,
        refundIntentIds: prepared.refundIntents.map((intent) => intent.id),
        refundPaymentRecordIds: prepared.refundPaymentRecords.map((record) => record.id),
        creditedAmount: prepared.creditedAmount,
        refundedAmount: prepared.refundedAmount,
      },
      intentIds: prepared.returnIntentIds,
      actorId: input.actorId,
      actorName: input.actorName,
      now,
    });
    return { ...prepared, request: resolved };
  } catch (error) {
    replaceInvoicesSnapshot(invoiceBefore);
    replacePaymentsSnapshot(paymentBefore);
    replaceReturnsSnapshot(returnBefore);
    throw error;
  }
}

export function executeReturnCreditRefundCommand(
  input: ExecuteReturnCreditRefundInput,
  metadata: Partial<MutationCommandMetadata> = {},
): Promise<MutationOutcome<ReturnCreditRefundResult>> {
  return executeMutationCommand(
    {
      commandType: "return.resolve-credit-refund",
      aggregateType: "return",
      aggregateId: input.returnId,
      payload: input,
    },
    createMutationMetadata(`return.credit-refund:${input.returnId}`, {
      ...metadata,
      expectedVersion: metadata.expectedVersion,
      actor: metadata.actor ?? { id: input.actorId, name: input.actorName },
    }),
    () => executeReturnCreditRefund(input),
  );
}
