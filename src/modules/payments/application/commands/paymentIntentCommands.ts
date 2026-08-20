import { CAPABILITIES, assertRuntimeCapability } from "@/platform/access-control";
import { isPositiveMoney } from "@/shared/money";
import type { PaymentRepository } from "../ports/PaymentRepository";
import type { PaymentIntent } from "../../domain/model/paymentCollection.types";
import { getEffectivePaymentMethodCatalog } from "../queries/effectivePaymentMethodCatalog";
import type { PaymentConfiguration } from "../../domain/model/paymentConfiguration.types";


export interface RetryPaymentIntentCommand {
  id: string;
  expectedVersion: number;
  expiresAt: string;
  idempotencyKey: string;
  now: string;
  checkoutUrl?: string;
}

export interface CreatePaymentIntentCommand {
  id: string;
  buyerRef: PaymentIntent["buyerRef"];
  orderId?: string;
  invoiceIds?: string[];
  scheduleLineIds?: string[];
  amount: PaymentIntent["amount"];
  methodCode: string;
  providerCode: string;
  returnContext: { routeKey: string };
  checkoutUrl?: string;
  clientPayload?: Record<string, unknown>;
  expiresAt: string;
  idempotencyKey: string;
  now: string;
}

function validateCheckoutUrl(repository: PaymentRepository, providerCode: string, checkoutUrl?: string): void {
  if (!checkoutUrl) return;
  const provider = repository.listPaymentProviders().find((item) => item.code === providerCode && item.enabled);
  if (!provider) throw new Error("PAYMENT_PROVIDER_UNAVAILABLE");
  const url = new URL(checkoutUrl);
  if (!(provider.checkoutOrigins ?? []).includes(url.origin)) throw new Error("Payment checkout origin is not approved by the provider catalog.");
}

export function createPaymentIntent(repository: PaymentRepository, command: CreatePaymentIntentCommand, configuration?: PaymentConfiguration): PaymentIntent {
  assertRuntimeCapability(CAPABILITIES.PAYMENTS_INTENT_CREATE);
  const replay = repository.listIntents().find((intent) => intent.idempotencyKey === command.idempotencyKey);
  if (replay) return replay;
  if (!isPositiveMoney(command.amount)) throw new Error("Payment Intent amount must be greater than zero.");
  const method = getEffectivePaymentMethodCatalog(repository.listPaymentMethods(), configuration).find((item) => item.code === command.methodCode && item.enabled && item.supportsIntent);
  if (!method) throw new Error("PAYMENT_METHOD_DISABLED");
  if (!method.supportedCurrencies.includes(command.amount.currency)) throw new Error("PAYMENT_METHOD_CURRENCY_UNSUPPORTED");
  if (!method.providerCodes?.includes(command.providerCode)) throw new Error("PAYMENT_PROVIDER_UNAVAILABLE");
  validateCheckoutUrl(repository, command.providerCode, command.checkoutUrl);
  return repository.saveIntent({
    id: command.id,
    buyerRef: command.buyerRef,
    orderId: command.orderId,
    invoiceIds: [...new Set(command.invoiceIds ?? [])],
    scheduleLineIds: [...new Set(command.scheduleLineIds ?? [])],
    amount: command.amount,
    methodCode: command.methodCode,
    providerCode: command.providerCode,
    state: command.checkoutUrl ? "REQUIRES_ACTION" : "CREATED",
    checkoutUrl: command.checkoutUrl,
    clientPayload: command.clientPayload,
    expiresAt: command.expiresAt,
    version: 1,
    idempotencyKey: command.idempotencyKey,
    createdAt: command.now,
    updatedAt: command.now,
  });
}

/** Apply only a backend/provider-authoritative response. Redirect query parameters are not accepted by this command. */
export function applyAuthoritativePaymentIntentSnapshot(repository: PaymentRepository, snapshot: PaymentIntent): PaymentIntent {
  const current = repository.listIntents().find((intent) => intent.id === snapshot.id);
  if (current && snapshot.version < current.version) return current;
  return repository.saveIntent(structuredClone(snapshot));
}

export function cancelPaymentIntent(repository: PaymentRepository, intentId: string, input: { expectedVersion: number; now: string }): PaymentIntent {
  assertRuntimeCapability(CAPABILITIES.PAYMENTS_INTENT_CANCEL);
  const current = repository.listIntents().find((intent) => intent.id === intentId);
  if (!current) throw new Error(`Payment Intent ${intentId} not found.`);
  if (current.version !== input.expectedVersion) throw new Error("PAYMENT_INTENT_VERSION_CONFLICT");
  if (["SUCCEEDED", "FAILED", "CANCELLED", "EXPIRED"].includes(current.state)) throw new Error("PAYMENT_INTENT_ALREADY_TERMINAL");
  return repository.saveIntent({ ...current, state: "CANCELLED", version: current.version + 1, updatedAt: input.now });
}

export function retryPaymentIntent(repository: PaymentRepository, intentId: string, command: RetryPaymentIntentCommand): PaymentIntent {
  assertRuntimeCapability(CAPABILITIES.PAYMENTS_INTENT_CREATE);
  const current = repository.listIntents().find((intent) => intent.id === intentId);
  if (!current) throw new Error(`Payment Intent ${intentId} not found.`);
  if (current.version !== command.expectedVersion) throw new Error("PAYMENT_INTENT_VERSION_CONFLICT");
  if (!["FAILED", "EXPIRED"].includes(current.state)) throw new Error("PAYMENT_INTENT_RETRY_NOT_ALLOWED");
  return createPaymentIntent(repository, {
    id: command.id,
    buyerRef: current.buyerRef,
    orderId: current.orderId,
    invoiceIds: current.invoiceIds,
    scheduleLineIds: current.scheduleLineIds,
    amount: current.amount,
    methodCode: current.methodCode,
    providerCode: current.providerCode,
    returnContext: { routeKey: current.clientPayload?.returnRouteKey as string || "payments" },
    checkoutUrl: command.checkoutUrl,
    clientPayload: { ...current.clientPayload, retryOfIntentId: current.id },
    expiresAt: command.expiresAt,
    idempotencyKey: command.idempotencyKey,
    now: command.now,
  });
}
