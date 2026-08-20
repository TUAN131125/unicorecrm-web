import process from "node:process";

const required = [
  "UNICORE_PROVIDER_BASE_URL",
  "UNICORE_PROVIDER_ACCESS_TOKEN",
  "UNICORE_PROVIDER_WORKSPACE_ID",
  "UNICORE_PROVIDER_QUOTE_ID",
  "UNICORE_PROVIDER_QUOTE_VERSION",
  "UNICORE_PROVIDER_ORDER_CONFIRM_ID",
  "UNICORE_PROVIDER_ORDER_CONFIRM_VERSION",
  "UNICORE_PROVIDER_ORDER_CANCEL_ID",
  "UNICORE_PROVIDER_ORDER_CANCEL_VERSION",
  "UNICORE_PROVIDER_PAYMENT_RECORD_ID",
  "UNICORE_PROVIDER_PAYMENT_RECORD_VERSION",
];
const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`[transaction-provider] BLOCKED_EXTERNAL missing ${missing.join(", ")}`);
  process.exit(2);
}

const baseUrl = process.env.UNICORE_PROVIDER_BASE_URL.replace(/\/$/u, "");
const headers = (idempotencyKey, version, workspace = process.env.UNICORE_PROVIDER_WORKSPACE_ID) => ({
  Authorization: `Bearer ${process.env.UNICORE_PROVIDER_ACCESS_TOKEN}`,
  "Content-Type": "application/json",
  "X-Workspace-Id": workspace,
  "X-Request-Id": `provider-${idempotencyKey}`,
  "X-Correlation-Id": `provider-${idempotencyKey}`,
  "Idempotency-Key": idempotencyKey,
  "If-Match": String(version),
});
async function command(operationId, path, body, idempotencyKey, version, expectedStatus = 200, workspace) {
  const response = await fetch(`${baseUrl}${path}`, { method: "POST", headers: headers(idempotencyKey, version, workspace), body: JSON.stringify(body) });
  const payload = await response.json();
  if (response.status !== expectedStatus) throw new Error(`${operationId}: expected ${expectedStatus}, received ${response.status}: ${JSON.stringify(payload)}`);
  return payload;
}
function assert(value, message) { if (!value) throw new Error(message); }

const quote = await command("acceptQuoteAndCloseDeal", `/workflows/quote-acceptance/${encodeURIComponent(process.env.UNICORE_PROVIDER_QUOTE_ID)}/accept-and-close-deal`, {}, "provider-quote-accept", process.env.UNICORE_PROVIDER_QUOTE_VERSION);
assert(quote.result?.quoteStatus === "ACCEPTED" && quote.result?.orderCreated === false, "Quote acceptance must not create an Order");
const quoteReplay = await command("acceptQuoteAndCloseDeal", `/workflows/quote-acceptance/${encodeURIComponent(process.env.UNICORE_PROVIDER_QUOTE_ID)}/accept-and-close-deal`, {}, "provider-quote-accept", process.env.UNICORE_PROVIDER_QUOTE_VERSION);
assert(quoteReplay.outcome === "REPLAYED", "Quote acceptance replay must return REPLAYED");

const confirmed = await command("confirmOrderWithPaymentPlan", `/workflows/order-confirmation/${encodeURIComponent(process.env.UNICORE_PROVIDER_ORDER_CONFIRM_ID)}/confirm-with-payment-plan`, {}, "provider-order-confirm", process.env.UNICORE_PROVIDER_ORDER_CONFIRM_VERSION);
assert(confirmed.result?.orderState === "CONFIRMED" && confirmed.result?.paymentPlanState === "ACTIVE", "Order confirmation transaction is incomplete");

const cancelled = await command("cancelOrder", `/orders/${encodeURIComponent(process.env.UNICORE_PROVIDER_ORDER_CANCEL_ID)}/cancel`, { reasonCode: "PROVIDER_TEST", reason: "Provider contract fixture" }, "provider-order-cancel", process.env.UNICORE_PROVIDER_ORDER_CANCEL_VERSION);
assert(cancelled.result?.orderState === "CANCELLED", "Order cancellation result is incomplete");

const reconciled = await command("reconcilePaymentRecord", `/payments/${encodeURIComponent(process.env.UNICORE_PROVIDER_PAYMENT_RECORD_ID)}/reconcile`, { state: "MATCHED", note: "Provider contract fixture" }, "provider-payment-reconcile", process.env.UNICORE_PROVIDER_PAYMENT_RECORD_VERSION);
assert(reconciled.result?.reconciliationState === "MATCHED", "Payment reconciliation result is incomplete");

// Negative providers must additionally prove VERSION_CONFLICT, CREDIT_APPROVAL_REQUIRED,
// ORDER_CANCELLATION_BLOCKED, IDEMPOTENCY_KEY_REUSED and WORKSPACE_MISMATCH without state changes.
console.log("[transaction-provider] PASS acceptQuoteAndCloseDeal, confirmOrderWithPaymentPlan, cancelOrder, reconcilePaymentRecord");
