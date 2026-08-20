export * from "./orders";

export type { CustomerOrder, OrderCancellationAudit, OrderCompletionAudit, OrderDeliveryChannel, OrderDeliveryRecord, OrderItem, OrderLineItem, OrderAdjustment, OrderPaymentInstruction } from "../domain/model/order.types";

export { OrderState } from "../domain/model/order.types";

export type { OrderCollection, OrderRepository } from "../application/ports/OrderRepository";

export { flattenOrders, getOrderById, getOrdersForCustomer, getOrdersForQuote, getCompletedOrders, getOrdersForDeal, getOrdersForContact, getDisplayOrdersForContact, queryOrders, getOrderStats, normalizeSourceLineItemToOrderItem, normalizeQuoteAdjustmentToOrderAdjustment, resolveOrderSourceFromQuote } from "../application/queries/orderQueries";

export { assertOrderCommercialMutationAllowed } from "../domain/rules/orderCommercialIntegrity";

export { canTransitionOrderState, applyOrderStateTransition, applyOrderConfirmation, applyOrderCompletion, applyOrderCancellation, assertCanonicalOrderInvariant, assertConfirmedOrderPrerequisites, hasConfirmedOrderPrerequisites, hasDraftOrderPrerequisites } from "../domain/rules/orderLifecycle";

export type { OrderStateDefinition } from "../domain/rules/orderLifecycle";

export { calculateOrderLineTotals, calculateOrderPricing, normalizeOrderItem, withCanonicalOrderPricing } from "../domain/rules/orderCalculations";

export type { OrderPricingResult } from "../domain/rules/orderCalculations";

export { assertOrderFulfillmentPrerequisites, getOrderFulfillmentFieldErrors, orderRequiresShipping, resolveOrderLineFulfillmentKind, OrderFulfillmentValidationError } from "../domain/rules/orderFulfillment";

export type { OrderFulfillmentFieldErrors } from "../domain/rules/orderFulfillment";

export type { OrderCreditApprovalDocument, OrderCreditApprovalMutationResult, OrderCreditApprovalState } from "../application/credit-approval/orderCreditApproval.types";
export type { DecideOrderCreditApprovalCommand, OrderCreditApprovalApiPort, RequestOrderCreditApprovalCommand, RevokeOrderCreditApprovalCommand } from "../application/ports/OrderCreditApprovalApiPort";
export { approveOrderCreditApprovalCommand, rejectOrderCreditApprovalCommand, requestOrderCreditApprovalCommand, revokeOrderCreditApprovalCommand } from "../application/commands/orderCreditApprovalCommands";

export { projectOrderReadModel } from "../application/read-models/orderReadModel";
export type { OrderReadModel } from "../application/read-models/orderReadModel";
