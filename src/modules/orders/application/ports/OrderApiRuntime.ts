import type { AuthoritativePage, ModuleListQuery } from "@/shared/application";
import type { MoneyDto } from "@/shared/money";
import type { CustomerOrder, OrderDeliveryRecord } from "../../domain/model/order.types";
export type OrderApiRuntimeMode = "demo" | "connected" | "test";
export interface OrderListQuery extends ModuleListQuery { filters?: { state?: CustomerOrder["state"]; sourceQuoteId?: string; sourceDealId?: string; buyerType?: CustomerOrder["buyerRef"]["type"]; buyerId?: string; }; }
export interface OrderEligibility { orderId: string; eligible: boolean; blockerCodes: readonly string[]; resourceVersion: number; evaluatedAt: string; }
export interface OrderPaymentProjection { orderId: string; grandTotal: MoneyDto; paidAmount: MoneyDto; outstandingAmount: MoneyDto; currency: string; paymentReady: boolean; blockerCodes: readonly string[]; resourceVersion: number; evaluatedAt: string; }
export interface OrderCommandOptions { idempotencyKey: string; correlationId?: string; signal?: AbortSignal; }
export interface OrderVersionedCommandOptions extends OrderCommandOptions { expectedVersion: number; }
export interface OrderMutationEvidence { authority: "backend" | "demo" | "test"; commandId: string; correlationId: string; aggregateId: string; aggregateType: string; version: number; occurredAt: string; outcome: "COMMITTED" | "REPLAYED" | "DEMO_COMMITTED"; warnings: readonly string[]; emittedEventIds: readonly string[]; auditEvidenceIds: readonly string[]; }
export interface OrderMutationResult { order: CustomerOrder; evidence: OrderMutationEvidence; }
export interface DirectOrderDraftAuthorityResult extends OrderMutationResult { paymentPlan: { agreementSnapshot: { version: number } }; commercialSnapshotFingerprint: string; }
export interface OrderBatchMutationResult { orders: readonly CustomerOrder[]; evidence: OrderMutationEvidence; }
export interface OrderVersionItem { orderId: string; expectedVersion: number; }
export type RecordOrderSendEvidenceInput = Omit<OrderDeliveryRecord, "contentFingerprint" | "sentBy"> & { sentBy?: string };
export interface OrderQueryPort { list(query?: OrderListQuery, signal?: AbortSignal): Promise<AuthoritativePage<CustomerOrder>>; get(orderId: string, signal?: AbortSignal): Promise<CustomerOrder>; getFulfillmentEligibility(orderId: string, signal?: AbortSignal): Promise<OrderEligibility>; getInvoiceEligibility(orderId: string, signal?: AbortSignal): Promise<OrderEligibility>; getPaymentProjection(orderId: string, signal?: AbortSignal): Promise<OrderPaymentProjection>; }
export interface OrderCommandPort { createDraft(order: CustomerOrder, options: OrderCommandOptions): Promise<DirectOrderDraftAuthorityResult>; replaceDraft(orderId: string, order: CustomerOrder, options: OrderVersionedCommandOptions): Promise<OrderMutationResult>; repriceDraft(orderId: string, options: OrderVersionedCommandOptions): Promise<OrderMutationResult>; recordSendEvidence(orderId: string, input: RecordOrderSendEvidenceInput, options: OrderVersionedCommandOptions): Promise<OrderMutationResult>; archive(orderId: string, reason: string, options: OrderVersionedCommandOptions): Promise<OrderMutationResult>; archiveBatch(items: readonly OrderVersionItem[], reason: string, options: OrderCommandOptions): Promise<OrderBatchMutationResult>; duplicateDraft(orderId: string, title: string | undefined, options: OrderVersionedCommandOptions): Promise<OrderMutationResult>; }
export interface OrderApiRuntime { mode: OrderApiRuntimeMode; queries: OrderQueryPort; commands: OrderCommandPort; }
