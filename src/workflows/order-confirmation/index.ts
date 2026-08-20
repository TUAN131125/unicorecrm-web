import { MutationCommandError, createMutationMetadata, executeMutationCommand, type MutationCommandMetadata, type MutationOutcome } from "@/shared/application";
import {
  confirmOrderSnapshot,
  getOrderSnapshot,
  getOrdersSnapshot,
  replaceOrders,
  saveOrderSnapshot,
  type CustomerOrder,
} from "@/modules/orders";
import {
  closeDealWon,
  getDealSnapshot,
  getDealStagesSnapshot,
  getDealsSnapshot,
  isLostStage,
  isWonStage,
  replaceDeals,
} from "@/modules/deals";
import {
  activatePaymentPlanSnapshot,
  getPaymentPlansForOrderSnapshot,
  getPaymentsSnapshot,
  replacePaymentsSnapshot,
  type PaymentPlan,
} from "@/modules/payments";
import { createOrderPaymentInstructionSnapshot } from "@/workflows/order-creation";
import { canonicalPaymentMethodKindForCode } from "@/shared/order-to-cash";
import { getPaymentConfigurationSnapshot } from "@/modules/payments";
import { getReceivablesSnapshot } from "@/modules/invoices";

export interface ExecuteOrderConfirmationCommand {
  orderId: string;
  paymentAccountId?: string;
  creditApprovalId?: string;
}

interface DemoOrderConfirmationCommand extends ExecuteOrderConfirmationCommand {
  now?: string;
}

interface ExecuteOrderConfirmationResult {
  success: boolean;
  order?: CustomerOrder;
  paymentPlan?: PaymentPlan;
  message?: string;
  errorCode?: string;
  errorDetails?: unknown;
}

export interface OrderConfirmationTransactionResult {
  orderId: string;
  orderState: "CONFIRMED";
  confirmedAt: string;
  paymentPlanId: string;
  paymentPlanState: "ACTIVE";
  paymentPlanVersion: number;
  paymentInstructionCreated: boolean;
  dealId?: string;
  dealOutcome?: "WON";
  consumedCreditApprovalId?: string;
}

/**
 * Demo/local transaction simulation only. Connected mode delegates this entire
 * Order + Payment Plan + optional Deal transaction to the backend operation.
 * Snapshot rollback protects the browser demo runtime and is not a production
 * transaction, persistence, audit or compensation specification.
 */
function executeOrderConfirmation(command: DemoOrderConfirmationCommand): ExecuteOrderConfirmationResult {
  const now = command.now ?? new Date().toISOString();
  const current = getOrderSnapshot(command.orderId);
  if (!current) return { success: false, errorCode: "ORDER_NOT_FOUND", message: `Order ${command.orderId} not found.` };
  if (current.state === "CONFIRMED") {
    const active = getPaymentPlansForOrderSnapshot(current.id).find((plan) => plan.state === "ACTIVE");
    return { success: true, order: current, paymentPlan: active };
  }
  if (current.state !== "DRAFT") return { success: false, errorCode: "ORDER_CONFIRMATION_STATE_INVALID", message: `Only DRAFT Order can be confirmed; received ${current.state}.` };

  const agreementVersion = current.paymentAgreementSnapshot?.version;
  const draftPlan = getPaymentPlansForOrderSnapshot(current.id)
    .filter((plan) => plan.state === "DRAFT" && (agreementVersion === undefined || plan.version === agreementVersion))
    .sort((left, right) => right.version - left.version)[0];
  if (!draftPlan) return { success: false, errorCode: "PAYMENT_PLAN_DRAFT_REQUIRED", message: "A version-matched DRAFT Payment Plan is required before Order confirmation." };
  if (draftPlan.scheduleLineIds.length === 0) return { success: false, errorCode: "PAYMENT_PLAN_LINES_REQUIRED", message: "The Payment Plan has no schedule lines." };

  const paymentConfiguration = getPaymentConfigurationSnapshot();
  const creditPolicy = paymentConfiguration.creditPolicy;
  const postpaidAmount = draftPlan.agreementSnapshot.lines
    .filter((line) => line.dueRule.type === "EVENT_RELATIVE" && line.dueRule.event === "INVOICE_ISSUED")
    .reduce((sum, line) => sum + Number(line.previewAmount.amount), 0);
  if (creditPolicy.enabled && postpaidAmount > 0) {
    const buyerReceivables = getReceivablesSnapshot().filter((entry) => entry.buyerRef.type === current.buyerRef.type && entry.buyerRef.id === current.buyerRef.id);
    const overdueAmount = buyerReceivables.filter((entry) => entry.settlementState === "OVERDUE").reduce((sum, entry) => sum + Number(entry.outstandingAmount.amount), 0);
    const hasExcessiveOverdueDays = buyerReceivables.some((entry) => entry.settlementState === "OVERDUE" && (entry.agingBucket === "61_90" || entry.agingBucket === "90_PLUS") && creditPolicy.maximumOverdueDays > 0);
    const requiresApproval = postpaidAmount > creditPolicy.approvalThreshold || postpaidAmount > creditPolicy.defaultCreditLimit || overdueAmount > creditPolicy.maximumOverdueAmount || hasExcessiveOverdueDays || creditPolicy.creditHoldEnabled;
    if (requiresApproval) {
      return {
        success: false,
        errorCode: "CREDIT_APPROVAL_REQUIRED",
        message: "Postpaid credit approval is required before Order confirmation.",
        errorDetails: {
          amount: postpaidAmount,
          currency: current.currency ?? "VND",
          approverRole: creditPolicy.approverRoleLabel,
        },
      };
    }
  }

  const sourceDeal = current.sourceDealId ? getDealSnapshot(current.sourceDealId) : undefined;
  if (current.sourceDealId && !sourceDeal) {
    return { success: false, errorCode: "SOURCE_DEAL_NOT_FOUND", message: `Source Deal ${current.sourceDealId} was not found.` };
  }
  if (sourceDeal && isLostStage(sourceDeal.stage, getDealStagesSnapshot())) {
    return { success: false, errorCode: "SOURCE_DEAL_CLOSED_LOST", message: `Source Deal ${sourceDeal.name} is Closed Lost.` };
  }

  const orderSnapshot = getOrdersSnapshot();
  const paymentSnapshot = getPaymentsSnapshot();
  const dealSnapshot = getDealsSnapshot();
  try {
    const instructionLines = current.paymentAgreementSnapshot?.lines.map((line) => {
      const resolvedKind = canonicalPaymentMethodKindForCode(line.preferredMethodCode ?? line.allowedMethodCodes[0] ?? "");
      const method: "BANK_TRANSFER" | "COD" | "OTHER" = resolvedKind === "BANK_TRANSFER" || resolvedKind === "COD"
        ? resolvedKind
        : "OTHER";
      return { method, amountDue: Number(line.previewAmount.amount) };
    }) ?? [];
    const preparedOrder = saveOrderSnapshot({
      ...current,
      creditApproval: current.creditApproval,
      paymentInstruction: createOrderPaymentInstructionSnapshot({
        order: current,
        paymentPlan: instructionLines,
        paymentAccountId: command.paymentAccountId,
        generatedAt: now,
      }),
      updatedAt: now,
    });
    const paymentPlan = activatePaymentPlanSnapshot(draftPlan.id, { expectedVersion: draftPlan.version, now });
    const confirmation = confirmOrderSnapshot(preparedOrder.id, now);
    if (!confirmation.success || !confirmation.order) throw new Error(confirmation.message || "Order confirmation failed.");
    if (sourceDeal && !isWonStage(sourceDeal.stage, getDealStagesSnapshot())) {
      const closed = closeDealWon(sourceDeal.id, {
        type: "ORDER_CONFIRMED",
        sourceId: confirmation.order.id,
        occurredAt: confirmation.order.confirmedAt ?? now,
      }, {
        id: `deal-order-confirmed:${confirmation.order.id}`,
        type: "won",
        title: "Order confirmed",
        description: `Order ${confirmation.order.orderNumber} confirmed and closed the Deal as Won.`,
        createdAt: confirmation.order.confirmedAt ?? now,
        author: "system",
      });
      if (!closed) throw new Error(`Deal ${sourceDeal.id} could not be closed as Won.`);
    }
    return { success: true, order: confirmation.order, paymentPlan };
  } catch (error) {
    replaceOrders(orderSnapshot);
    replacePaymentsSnapshot(paymentSnapshot);
    replaceDeals(dealSnapshot);
    return { success: false, errorCode: "ORDER_CONFIRMATION_FAILED", message: error instanceof Error ? error.message : "Order confirmation failed." };
  }
}

export function executeOrderConfirmationCommand(command: ExecuteOrderConfirmationCommand, metadata: Partial<MutationCommandMetadata> = {}): Promise<MutationOutcome<OrderConfirmationTransactionResult>> {
  return executeMutationCommand(
    { commandType: "order.confirm-with-payment-plan", aggregateType: "order", aggregateId: command.orderId, payload: command },
    createMutationMetadata(`order.confirm:${command.orderId}`, metadata),
    () => {
      const result = executeOrderConfirmation(command);
      if (!result.success) {
        throw new MutationCommandError({
          code: result.errorCode ?? "ORDER_CONFIRMATION_FAILED",
          message: result.message ?? "Order confirmation failed.",
          ...(result.errorDetails === undefined ? {} : { details: result.errorDetails }),
        });
      }
      if (!result.order || !result.paymentPlan) {
        throw new MutationCommandError({ code: "ORDER_CONFIRMATION_BLOCKED", message: "Order confirmation did not return authoritative demo projections." });
      }
      const sourceDeal = result.order.sourceDealId ? getDealSnapshot(result.order.sourceDealId) : undefined;
      return {
        orderId: result.order.id,
        orderState: "CONFIRMED",
        confirmedAt: result.order.confirmedAt ?? new Date().toISOString(),
        paymentPlanId: result.paymentPlan.id,
        paymentPlanState: "ACTIVE",
        paymentPlanVersion: result.paymentPlan.version,
        paymentInstructionCreated: Boolean(result.order.paymentInstruction),
        ...(sourceDeal === undefined || !isWonStage(sourceDeal.stage, getDealStagesSnapshot()) ? {} : { dealId: sourceDeal.id, dealOutcome: "WON" as const }),
        ...(command.creditApprovalId ? { consumedCreditApprovalId: command.creditApprovalId } : {}),
      };
    },
  );
}
