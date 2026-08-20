import {
  MutationCommandError,
  createMutationMetadata,
  executeMutationCommand,
  readMutationVersion,
  runBackendProjection,
  type MutationCommandMetadata,
  type MutationOutcome,
} from "@/shared/application";
import {
  assertOrderCommercialMutationAllowed,
  getOrderSnapshot,
  getOrderListSnapshot,
  getOrdersSnapshot,
  normalizeQuoteAdjustmentToOrderAdjustment,
  orderRequiresShipping,
  projectOrderReadModel,
  replaceOrders,
  saveOrderSnapshot,
  createDirectOrderDraftCommandBoundary,
  saveOrderDraftCommand,
  isOrderConnectedMode,
  type CustomerOrder,
  type OrderReadModel,
  type OrderPaymentInstruction,
  withCanonicalOrderPricing,
} from "@/modules/orders";
import { assertQuoteConvertible, getQuoteSnapshot, type Quote } from "@/modules/quotes";
import { getDealSnapshot, getDealStagesSnapshot, isLostStage, isWonStage } from "@/modules/deals";
import { relationshipRefKey } from "@/platform/identity";
import { applyFrontendRequestScenario } from "@/platform/request-simulation";
import {
  cancelPaymentPlanSnapshot,
  getPaymentObligationsForOrderSnapshot,
  getPaymentPlansForOrderSnapshot,
  getPaymentsSnapshot,
  replacePaymentsSnapshot,
  savePaymentPlanDraftSnapshot,
  savePaymentPlanSnapshot,
  type PaymentFulfillmentGate,
  type PaymentObligation,
  type PaymentMethod,
  type PaymentPlanType,
  type PaymentPurpose,
  type PaymentTerm,
  type PaymentTiming,
} from "@/modules/payments";
import { money } from "@/shared/money";
import { canonicalPaymentMethodCodeForKind, type PaymentAgreementSnapshot } from "@/shared/order-to-cash";
import { buildLocalVietQrPayload, getPaymentConfigurationSnapshot, renderPaymentTransferContent } from "@/modules/payments";

export interface OrderCreationPaymentLine {
  id: string;
  label?: string;
  amountDue: number;
  currency: string;
  method: PaymentMethod;
  term: PaymentTerm;
  planType?: PaymentPlanType;
  sequence?: number;
  purpose?: PaymentPurpose;
  timing?: PaymentTiming;
  fulfillmentGate?: PaymentFulfillmentGate;
  dueDate?: string;
  idempotencyKey: string;
}

export interface ExecuteOrderCreationCommand {
  order: CustomerOrder;
  paymentPlan: OrderCreationPaymentLine[];
  actorId: string;
  actorName?: string;
  paymentAccountId?: string;
  now?: string;
}

export interface ExecuteOrderDraftUpdateCommand extends ExecuteOrderCreationCommand {
  expectedVersion?: number | string;
}

export interface ExecuteOrderCreationResult {
  order: CustomerOrder;
  orderCreated: boolean;
  paymentPlan: PaymentObligation[];
  paymentAgreementVersion: number;
}

export interface CreateOrderPaymentInstructionInput {
  order: CustomerOrder;
  paymentPlan: readonly Pick<OrderCreationPaymentLine, "method" | "amountDue">[];
  paymentAccountId?: string;
  generatedAt?: string;
}

export function createOrderPaymentInstructionSnapshot(input: CreateOrderPaymentInstructionInput): OrderPaymentInstruction {
  const configuration = getPaymentConfigurationSnapshot();
  const activeAccounts = configuration.receivingAccounts.filter((account) => account.active);
  const selectedAccount = activeAccounts.find((account) => account.id === input.paymentAccountId)
    ?? activeAccounts.find((account) => account.isDefaultForCurrency && account.currency === input.order.currency)
    ?? activeAccounts[0];
  const plannedMethod = input.paymentPlan[0]?.method;
  const method: OrderPaymentInstruction["method"] = plannedMethod === "BANK_TRANSFER" || plannedMethod === "COD"
    ? plannedMethod
    : "EXTERNAL_GATEWAY";
  const amount = input.paymentPlan.reduce((sum, line) => sum + Math.max(0, Number(line.amountDue) || 0), 0)
    || input.order.totalAmount;
  const transferContent = renderPaymentTransferContent(configuration.qrPolicy.transferContentTemplate, input.order.orderNumber);
  const bankAccount = method === "BANK_TRANSFER" && selectedAccount ? {
    sourceAccountId: selectedAccount.id,
    bankCode: selectedAccount.bankCode,
    bankBin: selectedAccount.bankBin,
    bankName: selectedAccount.bankName,
    accountNumber: selectedAccount.accountNumber,
    accountName: selectedAccount.accountHolder,
  } : undefined;
  const qrPayload = bankAccount && configuration.qrPolicy.enabled
    ? buildLocalVietQrPayload({
        bankBin: bankAccount.bankBin,
        accountNumber: bankAccount.accountNumber,
        amount: configuration.qrPolicy.amountMode === "EMPTY" ? undefined : amount,
        transferContent,
      })
    : undefined;
  return {
    method,
    bankAccount,
    amount,
    transferContent,
    qrPayload,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    configurationVersion: configuration.revision,
  };
}

function agreementFromLegacyLines(
  order: CustomerOrder,
  lines: readonly OrderCreationPaymentLine[],
  version: number,
): PaymentAgreementSnapshot {
  return {
    version,
    kind: lines[0]?.planType ?? (lines.length > 1 ? "INSTALLMENT" : "FULL_PAYMENT"),
    currency: order.currency ?? "VND",
    sourceQuoteId: order.sourceQuoteId,
    policyVersion: "order-draft-payment-agreement/v2",
    lines: lines.map((line, index) => {
      const methodCode = canonicalPaymentMethodCodeForKind(line.method);
      return {
        id: `schedule:${order.id}:v${version}:${index + 1}`,
        sequence: index + 1,
        label: line.label || `Đợt ${index + 1}`,
        purpose: line.purpose ?? "OTHER",
        amountRule: index === lines.length - 1
          ? { type: "REMAINDER" as const }
          : { type: "FIXED" as const, amount: money(String(line.amountDue), line.currency) },
        previewAmount: money(String(line.amountDue), line.currency),
        dueRule: line.timing === "ON_DELIVERY"
          ? { type: "EVENT_RELATIVE" as const, event: "DELIVERY_CONFIRMED" as const, offsetDays: 0, dayBasis: "CALENDAR" as const }
          : line.timing === "POSTPAID"
            ? { type: "EVENT_RELATIVE" as const, event: "INVOICE_ISSUED" as const, offsetDays: 0, dayBasis: "CALENDAR" as const }
            : { type: "EVENT_RELATIVE" as const, event: "ORDER_CONFIRMED" as const, offsetDays: 0, dayBasis: "CALENDAR" as const },
        allowedMethodCodes: [methodCode],
        preferredMethodCode: methodCode,
        fulfillmentGate: line.method === "COD" ? "NONE" : line.fulfillmentGate ?? "NONE",
        invoicePolicyCode: line.purpose === "DEPOSIT" ? "DEPOSIT_INVOICE_ALLOWED" : "STANDARD_ORDER_INVOICE",
      };
    }),
  };
}

function withAgreementVersion(agreement: PaymentAgreementSnapshot, version: number): PaymentAgreementSnapshot {
  return {
    ...structuredClone(agreement),
    version,
    policyVersion: agreement.policyVersion || "order-draft-payment-agreement/v2",
    lines: agreement.lines.map((line, index) => ({
      ...line,
      id: `schedule:${agreement.sourceQuoteId ?? "order"}:v${version}:${index + 1}`,
      sequence: index + 1,
    })),
  };
}

function assertQuoteOrderMapping(quote: Quote, order: CustomerOrder): void {
  if (order.sourceQuoteNumber !== quote.quoteNumber) throw new Error("Order source Quote number does not match the selected Quote.");
  if (relationshipRefKey(order.buyerRef) !== relationshipRefKey(quote.buyerRef)) throw new Error("Order buyer does not match the selected Quote.");
  if ((order.currency || "VND") !== (quote.currency || "VND")) throw new Error("Order currency does not match the selected Quote.");
  if ((order.sourceDealId || "") !== (quote.sourceDealId || quote.dealId || "")) throw new Error("Order Deal reference does not match the selected Quote.");
  if ((order.contactId || "") !== (quote.contactId || "")) throw new Error("Order Contact reference does not match the selected Quote.");
  if ((order.ownerId || "") !== (quote.ownerId || "")) throw new Error("Order owner does not match the selected Quote.");
  const expectedNotes = quote.notes || quote.termsAndNotes || "";
  if ((order.notes || "").trim() !== expectedNotes.trim()) throw new Error("Order notes and terms do not match the selected Quote.");
  const expectedAdjustments = (quote.adjustments ?? []).map(normalizeQuoteAdjustmentToOrderAdjustment);
  const actualAdjustments = order.adjustments ?? [];
  const adjustmentFingerprint = (items: typeof actualAdjustments) => JSON.stringify(items.map((item) => ({
    id: item.id, label: item.label, type: item.type, calculation: item.calculation, value: item.value, amount: item.amount,
  })));
  if (adjustmentFingerprint(actualAdjustments) !== adjustmentFingerprint(expectedAdjustments)) throw new Error("Order adjustments do not match the selected Quote.");
  if (quote.recipientEmail && (order.recipientEmail || "") !== quote.recipientEmail) throw new Error("Order recipient email does not match the selected Quote.");
  if (order.items.length !== quote.lineItems.length) throw new Error("Order lines do not match the selected Quote.");
  quote.lineItems.forEach((quoteLine, index) => {
    const orderLine = order.items[index];
    const equal = orderLine
      && orderLine.productId === (quoteLine.productId || "")
      && orderLine.quantity === quoteLine.quantity
      && orderLine.unitPriceSnapshot === (quoteLine.unitPriceSnapshot ?? quoteLine.unitPrice)
      && orderLine.discountPercent === (quoteLine.discountPercent ?? 0)
      && (orderLine.taxRateSnapshot ?? 0) === (quoteLine.taxRateSnapshot ?? 0)
      && (orderLine.taxModeSnapshot ?? "none") === (quoteLine.taxModeSnapshot ?? "none")
      && Math.abs(orderLine.lineTotal - (quoteLine.lineTotal ?? 0)) < 0.01;
    if (!equal) throw new Error(`Order line ${index + 1} does not preserve the Quote commercial snapshot.`);
  });
  if (Math.abs((order.grandTotal ?? order.totalAmount) - quote.grandTotal) > 0.01) throw new Error("Order total does not match the selected Quote.");
}

function orderCommercialFingerprint(order: CustomerOrder): string {
  const canonical = withCanonicalOrderPricing(order);
  return JSON.stringify({
    orderNumber: canonical.orderNumber,
    buyerRef: canonical.buyerRef,
    sourceQuoteId: canonical.sourceQuoteId,
    sourceDealId: canonical.sourceDealId,
    items: canonical.items,
    adjustments: canonical.adjustments ?? [],
    subtotal: canonical.subtotal ?? 0,
    discountTotal: canonical.discountTotal ?? 0,
    taxTotal: canonical.taxTotal ?? 0,
    grandTotal: canonical.grandTotal ?? canonical.totalAmount,
    totalAmount: canonical.totalAmount,
    currency: canonical.currency || "VND",
    recipientName: canonical.recipientName,
    recipientPhone: canonical.recipientPhone,
    recipientEmail: canonical.recipientEmail,
    shippingAddress: canonical.shippingAddress,
    ownerId: canonical.ownerId,
    notes: canonical.notes,
    internalNotes: canonical.internalNotes,
  });
}

function assertSourceRelationship(order: CustomerOrder, now?: string): Quote | undefined {
  const sourceQuote = order.sourceQuoteId ? getQuoteSnapshot(order.sourceQuoteId) : undefined;
  const sourceDealId = order.sourceDealId || sourceQuote?.sourceDealId || sourceQuote?.dealId;
  if (sourceDealId) {
    const sourceDeal = getDealSnapshot(sourceDealId);
    if (!sourceDeal) throw new Error(`Source Deal ${sourceDealId} was not found.`);
    if (isLostStage(sourceDeal.stage, getDealStagesSnapshot())) {
      throw new MutationCommandError({
        code: "DEAL_CLOSED_LOST",
        message: `The source Deal ${sourceDeal.name} is Closed Lost and cannot create an Order.`,
        category: "BUSINESS_RULE",
        details: { dealId: sourceDeal.id, dealName: sourceDeal.name },
      });
    }
    if (sourceQuote && !isWonStage(sourceDeal.stage, getDealStagesSnapshot())) {
      throw new MutationCommandError({
        code: "DEAL_NOT_WON",
        message: `The source Deal ${sourceDeal.name} must be Won before creating an Order.`,
        category: "BUSINESS_RULE",
        details: { dealId: sourceDeal.id, dealName: sourceDeal.name, stage: sourceDeal.stage },
      });
    }
    if (order.currency && sourceDeal.currency && order.currency !== sourceDeal.currency) {
      throw new Error("Order currency does not match the source Deal currency.");
    }
  }
  if (sourceQuote) {
    assertQuoteConvertible(sourceQuote, now);
    assertQuoteOrderMapping(sourceQuote, order);
  }
  return sourceQuote;
}

function nextAgreementVersion(orderId: string, order: CustomerOrder): number {
  const versions = [
    order.paymentAgreementSnapshot?.version ?? 0,
    ...getPaymentPlansForOrderSnapshot(orderId).map((plan) => plan.version),
  ];
  return Math.max(0, ...versions) + 1;
}

function persistOrderDraftTransaction(
  command: ExecuteOrderCreationCommand,
  options: { mode: "create" | "update"; agreementVersion: number },
): ExecuteOrderCreationResult {
  const orderSnapshot = getOrdersSnapshot();
  const paymentSnapshot = getPaymentsSnapshot();
  const now = command.now ?? new Date().toISOString();
  try {
    const sourceAgreement = command.order.paymentAgreementSnapshot;
    const agreementSnapshot = sourceAgreement
      ? withAgreementVersion(sourceAgreement, options.agreementVersion)
      : agreementFromLegacyLines(command.order, command.paymentPlan, options.agreementVersion);
    const orderDraft: CustomerOrder = {
      ...command.order,
      state: "DRAFT",
      paymentAgreementSnapshot: agreementSnapshot,
      paymentInstruction: undefined,
      confirmedAt: undefined,
      updatedAt: now,
    };

    if (options.mode === "update") {
      for (const plan of getPaymentPlansForOrderSnapshot(orderDraft.id).filter((item) => item.state === "DRAFT")) {
        cancelPaymentPlanSnapshot(plan.id, {
          expectedVersion: plan.version,
          reason: `Superseded by Order draft payment agreement v${agreementSnapshot.version}`,
          now,
        });
      }
    }

    const order = saveOrderSnapshot(orderDraft);
    const planId = `plan:${order.id}:v${agreementSnapshot.version}`;
    savePaymentPlanDraftSnapshot({
      id: planId,
      orderId: order.id,
      buyerRef: order.buyerRef,
      version: agreementSnapshot.version,
      agreementSnapshot,
      orderAmount: money(String(order.grandTotal ?? order.totalAmount), order.currency ?? "VND"),
      requiresPhysicalShipping: orderRequiresShipping(order),
      idempotencyKey: `order-payment-plan-draft:${order.id}:v${agreementSnapshot.version}`,
      now,
    });
    const paymentPlan = savePaymentPlanSnapshot({
      orderId: order.id,
      buyerRef: order.buyerRef,
      planId,
      planVersion: agreementSnapshot.version,
      planType: command.paymentPlan[0]?.planType,
      lines: command.paymentPlan.map((line, index) => ({
        ...line,
        id: options.mode === "update" ? `obl_${order.id}_v${agreementSnapshot.version}_${index + 1}` : line.id,
        idempotencyKey: options.mode === "update"
          ? `order-payment-plan:${order.id}:v${agreementSnapshot.version}:${index + 1}`
          : line.idempotencyKey,
      })),
      fulfillmentContext: { requiresPhysicalShipping: orderRequiresShipping(order) },
      actorId: command.actorId,
      actorName: command.actorName,
      now,
    });

    return {
      order,
      orderCreated: options.mode === "create",
      paymentPlan,
      paymentAgreementVersion: agreementSnapshot.version,
    };
  } catch (error) {
    replaceOrders(orderSnapshot);
    replacePaymentsSnapshot(paymentSnapshot);
    throw error;
  }
}

/** Local demo executor retained for compatibility and contract tests. */
export async function executeOrderCreation(command: ExecuteOrderCreationCommand): Promise<ExecuteOrderCreationResult> {
  await applyFrontendRequestScenario("orders.create");
  if (command.order.state !== "DRAFT") throw new Error("New Order must be created as DRAFT and confirmed through the Order confirmation workflow.");
  const existing = getOrderSnapshot(command.order.id);
  if (existing) {
    if (orderCommercialFingerprint(existing) !== orderCommercialFingerprint(command.order)) {
      throw new Error("Order creation idempotency key was reused with different commercial content.");
    }
    return {
      order: existing,
      orderCreated: false,
      paymentPlan: getPaymentObligationsForOrderSnapshot(existing.id),
      paymentAgreementVersion: existing.paymentAgreementSnapshot?.version ?? 1,
    };
  }

  const sourceQuote = assertSourceRelationship(command.order, command.now);
  if (sourceQuote) {
    const converted = getOrderListSnapshot().find((order) => order.sourceQuoteId === sourceQuote.id);
    if (converted) throw new Error(`Quote ${sourceQuote.quoteNumber} has already been converted to Order ${converted.orderNumber}.`);
  }
  return persistOrderDraftTransaction(command, { mode: "create", agreementVersion: 1 });
}

export async function executeOrderDraftUpdate(command: ExecuteOrderDraftUpdateCommand): Promise<ExecuteOrderCreationResult> {
  await applyFrontendRequestScenario("orders.update-draft");
  const existing = getOrderSnapshot(command.order.id);
  if (!existing) throw new Error(`Order ${command.order.id} was not found.`);
  if (existing.state !== "DRAFT") throw new Error(`Only a DRAFT Order can be edited; received ${existing.state}.`);
  if (command.expectedVersion !== undefined && readMutationVersion(existing) !== command.expectedVersion) {
    throw new MutationCommandError({
      code: "ORDER_VERSION_CONFLICT",
      message: "The Order changed after this form was opened. Reload before saving again.",
      category: "CONFLICT",
    });
  }
  assertOrderCommercialMutationAllowed(existing, command.order);
  assertSourceRelationship(command.order, command.now);
  const version = nextAgreementVersion(existing.id, existing);
  return persistOrderDraftTransaction(command, { mode: "update", agreementVersion: version });
}

interface AuthoritativeDirectOrderDraftResult {
  order: OrderReadModel;
  paymentPlan: { agreementSnapshot: { version: number } };
  commercialSnapshotFingerprint: string;
}

function isAuthoritativeDirectOrderDraftResult(
  result: ExecuteOrderCreationResult | AuthoritativeDirectOrderDraftResult,
): result is AuthoritativeDirectOrderDraftResult {
  return !Array.isArray(result.paymentPlan) && "commercialSnapshotFingerprint" in result;
}

function projectAuthoritativeResult(
  result: ExecuteOrderCreationResult | AuthoritativeDirectOrderDraftResult,
): ExecuteOrderCreationResult {
  if (isAuthoritativeDirectOrderDraftResult(result)) {
    const order = projectOrderReadModel(result.order);
    runBackendProjection("orders", () => saveOrderSnapshot(order));
    return {
      order,
      orderCreated: true,
      paymentPlan: [],
      paymentAgreementVersion: result.paymentPlan.agreementSnapshot.version,
    };
  }
  runBackendProjection("orders", () => saveOrderSnapshot(result.order));
  return result;
}

export async function executeOrderDraftCreationCommand(
  command: ExecuteOrderCreationCommand,
  metadata: Partial<MutationCommandMetadata> = {},
): Promise<MutationOutcome<ExecuteOrderCreationResult>> {
  if (isOrderConnectedMode()) {
    const outcome = await createDirectOrderDraftCommandBoundary(command.order, { ...metadata, actor: metadata.actor ?? { id: command.actorId, name: command.actorName } });
    const result = outcome.data;
    return { ...outcome, data: { order: result.order, orderCreated: true, paymentPlan: [], paymentAgreementVersion: result.paymentPlan.agreementSnapshot.version } };
  }
  return executeMutationCommand(
    { commandType: "order.create", aggregateType: "order", aggregateId: command.order.id, payload: command },
    createMutationMetadata(`order.create:${command.order.id}`, { ...metadata, actor: metadata.actor ?? { id: command.actorId, name: command.actorName } }),
    () => executeOrderCreation(command),
  ).then((outcome) => ({ ...outcome, data: projectAuthoritativeResult(outcome.data as ExecuteOrderCreationResult | AuthoritativeDirectOrderDraftResult) }));
}

export async function executeOrderDraftUpdateCommand(
  command: ExecuteOrderDraftUpdateCommand,
  metadata: Partial<MutationCommandMetadata> = {},
): Promise<MutationOutcome<ExecuteOrderCreationResult>> {
  const current = getOrderSnapshot(command.order.id);
  const expectedVersion = command.expectedVersion ?? readMutationVersion(current);
  if (isOrderConnectedMode()) {
    const outcome = await saveOrderDraftCommand(command.order, { ...metadata, expectedVersion, actor: metadata.actor ?? { id: command.actorId, name: command.actorName } });
    return { ...outcome, data: { order: outcome.data, orderCreated: false, paymentPlan: [], paymentAgreementVersion: outcome.data.paymentAgreementSnapshot?.version ?? 1 } };
  }
  return executeMutationCommand(
    { commandType: "order.update-draft", aggregateType: "order", aggregateId: command.order.id, payload: command },
    createMutationMetadata(`order.update-draft:${command.order.id}`, { ...metadata, expectedVersion, actor: metadata.actor ?? { id: command.actorId, name: command.actorName } }),
    () => executeOrderDraftUpdate({ ...command, expectedVersion }),
  ).then((outcome) => ({ ...outcome, data: projectAuthoritativeResult(outcome.data) }));
}
