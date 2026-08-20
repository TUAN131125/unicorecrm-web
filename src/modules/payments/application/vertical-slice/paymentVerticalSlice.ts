import { createAuthoritativeResource, type AuthoritativeResource } from "@/shared/application";
import type { PaymentApiPort } from "../ports/PaymentApiPort";
import type { PaymentPlan, PaymentScheduleLine } from "../../domain/model/paymentPlan.types";
import type {
  CustomerCredit,
  InvoicePaymentAllocation,
  PaymentIntent,
  PaymentMethodCatalogItem,
  PaymentProviderCatalogItem,
  PaymentRecord,
  RefundIntent,
} from "../../domain/model/paymentCollection.types";
import type { PaymentRecordDetailDto } from "../queries/paymentRecordDetail";

export interface PaymentWorkspaceDto {
  plans: PaymentPlan[];
  scheduleLines: PaymentScheduleLine[];
  intents: PaymentIntent[];
  refundIntents: RefundIntent[];
  paymentRecords: PaymentRecord[];
  allocations: InvoicePaymentAllocation[];
  customerCredits: CustomerCredit[];
  methodCatalog: PaymentMethodCatalogItem[];
  providerCatalog: PaymentProviderCatalogItem[];
}

export interface PaymentVerticalSlice {
  workspace: AuthoritativeResource<PaymentWorkspaceDto>;
  detail(paymentRecordId: string): AuthoritativeResource<PaymentRecordDetailDto>;
  refreshAll(): Promise<void>;
  recordManualPayment(command: Parameters<PaymentApiPort["recordManualPayment"]>[0], signal?: AbortSignal): ReturnType<PaymentApiPort["recordManualPayment"]>;
  createIntent(command: Parameters<PaymentApiPort["createIntent"]>[0], signal?: AbortSignal): ReturnType<PaymentApiPort["createIntent"]>;
  cancelIntent(intentId: string, expectedVersion: number, signal?: AbortSignal): ReturnType<PaymentApiPort["cancelIntent"]>;
  retryIntent(intentId: string, command: Parameters<PaymentApiPort["retryIntent"]>[1], signal?: AbortSignal): ReturnType<PaymentApiPort["retryIntent"]>;
  refreshIntentStatus(intentId: string, signal?: AbortSignal): ReturnType<PaymentApiPort["getIntentStatus"]>;
  allocate(command: Parameters<PaymentApiPort["allocate"]>[0], signal?: AbortSignal): ReturnType<PaymentApiPort["allocate"]>;
  reverseAllocation(allocationId: string, input: Parameters<PaymentApiPort["reverseAllocation"]>[1], signal?: AbortSignal): ReturnType<PaymentApiPort["reverseAllocation"]>;
  createRefund(command: Parameters<PaymentApiPort["createRefundIntent"]>[0], signal?: AbortSignal): ReturnType<PaymentApiPort["createRefundIntent"]>;
  listRefundProviderAttempts(refundIntentId: string, signal?: AbortSignal): ReturnType<PaymentApiPort["listRefundProviderAttempts"]>;
  requestRefundCancellation(refundIntentId: string, command: Parameters<PaymentApiPort["requestRefundCancellation"]>[1], signal?: AbortSignal): ReturnType<PaymentApiPort["requestRefundCancellation"]>;
  retryRefund(refundIntentId: string, command: Parameters<PaymentApiPort["retryRefund"]>[1], signal?: AbortSignal): ReturnType<PaymentApiPort["retryRefund"]>;
  reconcileRecord(paymentRecordId: string, command: Parameters<PaymentApiPort["reconcilePaymentRecord"]>[1], signal?: AbortSignal): ReturnType<PaymentApiPort["reconcilePaymentRecord"]>;
  recordCodCustomerCollection(paymentRecordId: string, input: Parameters<PaymentApiPort["recordCodCustomerCollection"]>[1], signal?: AbortSignal): ReturnType<PaymentApiPort["recordCodCustomerCollection"]>;
  recordCodMerchantRemittance(paymentRecordId: string, input: Parameters<PaymentApiPort["recordCodMerchantRemittance"]>[1], signal?: AbortSignal): ReturnType<PaymentApiPort["recordCodMerchantRemittance"]>;
  recordRequestDelivery(intentId: string, command: Parameters<PaymentApiPort["recordPaymentRequestDelivery"]>[1], signal?: AbortSignal): ReturnType<PaymentApiPort["recordPaymentRequestDelivery"]>;
}

export interface PaymentVerticalSliceOptions {
  projectWorkspace?(workspace: PaymentWorkspaceDto): void;
}

export function createPaymentVerticalSlice(
  api: PaymentApiPort,
  options: PaymentVerticalSliceOptions = {},
): PaymentVerticalSlice {
  const details = new Map<string, AuthoritativeResource<PaymentRecordDetailDto>>();
  const workspace = createAuthoritativeResource(async (signal) => {
    const [catalog, plans, scheduleLines, intents, paymentRecords, refundIntents, customerCredits, allocations] = await Promise.all([
      api.getMethodCatalog(signal),
      api.listPlans(undefined, signal),
      api.listScheduleLines(undefined, signal),
      api.listIntents(undefined, signal),
      api.listPaymentRecords(undefined, signal),
      api.listRefundIntents(undefined, signal),
      api.listCustomerCredits(undefined, signal),
      api.listAllocations(undefined, signal),
    ]);
    const workspace = {
      plans,
      scheduleLines,
      intents,
      refundIntents,
      paymentRecords,
      allocations,
      customerCredits,
      methodCatalog: catalog.methods,
      providerCatalog: catalog.providers,
    };
    options.projectWorkspace?.(workspace);
    return workspace;
  });

  const detail = (paymentRecordId: string) => {
    const existing = details.get(paymentRecordId);
    if (existing) return existing;
    const resource = createAuthoritativeResource((signal) => api.getPaymentRecordDetail(paymentRecordId, signal));
    details.set(paymentRecordId, resource);
    return resource;
  };

  const refreshAfterMutation = async (paymentRecordId?: string) => {
    const tasks: Array<Promise<unknown>> = [workspace.refresh()];
    if (paymentRecordId) tasks.push(detail(paymentRecordId).refresh());
    await Promise.allSettled(tasks);
  };

  const mutate = async <T>(operation: () => Promise<T>, paymentRecordId?: string): Promise<T> => {
    const result = await operation();
    await refreshAfterMutation(paymentRecordId);
    return result;
  };

  return {
    workspace,
    detail,
    async refreshAll() {
      await Promise.allSettled([workspace.refresh(), ...[...details.values()].map((resource) => resource.refresh())]);
    },
    recordManualPayment: (command, signal) => mutate(() => api.recordManualPayment(command, signal)),
    createIntent: (command, signal) => mutate(() => api.createIntent(command, signal)),
    cancelIntent: (intentId, expectedVersion, signal) => mutate(() => api.cancelIntent(intentId, expectedVersion, signal)),
    retryIntent: (intentId, command, signal) => mutate(() => api.retryIntent(intentId, command, signal)),
    refreshIntentStatus: (intentId, signal) => mutate(() => api.getIntentStatus(intentId, signal)),
    allocate: (command, signal) => mutate(() => api.allocate(command, signal), command.paymentRecordId),
    reverseAllocation: (allocationId, input, signal) => mutate(() => api.reverseAllocation(allocationId, input, signal)),
    createRefund: (command, signal) => mutate(() => api.createRefundIntent(command, signal), command.paymentRecordId),
    listRefundProviderAttempts: (refundIntentId, signal) => api.listRefundProviderAttempts(refundIntentId, signal),
    requestRefundCancellation: (refundIntentId, command, signal) => mutate(() => api.requestRefundCancellation(refundIntentId, command, signal)),
    retryRefund: (refundIntentId, command, signal) => mutate(() => api.retryRefund(refundIntentId, command, signal)),
    reconcileRecord: (paymentRecordId, command, signal) => mutate(() => api.reconcilePaymentRecord(paymentRecordId, command, signal), paymentRecordId),
    recordCodCustomerCollection: (paymentRecordId, input, signal) => mutate(() => api.recordCodCustomerCollection(paymentRecordId, input, signal), paymentRecordId),
    recordCodMerchantRemittance: (paymentRecordId, input, signal) => mutate(() => api.recordCodMerchantRemittance(paymentRecordId, input, signal), paymentRecordId),
    recordRequestDelivery: (intentId, command, signal) => mutate(() => api.recordPaymentRequestDelivery(intentId, command, signal)),
  };
}
