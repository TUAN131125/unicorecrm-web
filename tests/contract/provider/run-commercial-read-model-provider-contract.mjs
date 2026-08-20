import process from "node:process";

const required = [
  "UNICORE_PROVIDER_BASE_URL",
  "UNICORE_PROVIDER_ACCESS_TOKEN",
  "UNICORE_PROVIDER_WORKSPACE_ID",
  "UNICORE_PROVIDER_DEAL_ID",
  "UNICORE_PROVIDER_QUOTE_ID",
  "UNICORE_PROVIDER_ORDER_CONFIRM_ID",
  "UNICORE_PROVIDER_SECONDARY_ACCESS_TOKEN",
  "UNICORE_PROVIDER_SECONDARY_WORKSPACE_ID",
];
const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`[commercial-read-provider] BLOCKED_EXTERNAL missing ${missing.join(", ")}`);
  process.exit(2);
}
const baseUrl = process.env.UNICORE_PROVIDER_BASE_URL.replace(/\/$/u, "");
function headers(token = process.env.UNICORE_PROVIDER_ACCESS_TOKEN, workspace = process.env.UNICORE_PROVIDER_WORKSPACE_ID) {
  return { Authorization: `Bearer ${token}`, "X-Workspace-Id": workspace, "X-Request-Id": `provider-read-${crypto.randomUUID()}`, "X-Correlation-Id": `provider-read-${crypto.randomUUID()}` };
}
async function get(operationId, path, expectedStatus = 200, token, workspace) {
  const response = await fetch(`${baseUrl}${path}`, { headers: headers(token, workspace) });
  const body = await response.json();
  if (response.status !== expectedStatus) throw new Error(`${operationId}: expected ${expectedStatus}, received ${response.status}: ${JSON.stringify(body)}`);
  return body;
}
function assert(value, message) { if (!value) throw new Error(message); }
function assertMoney(value, at) { assert(typeof value?.amount === "string" && /^[A-Z]{3}$/u.test(value?.currency ?? ""), `${at}: canonical Money required`); }
function assertVersion(record, at) { assert(Number.isInteger(record?.resourceVersion) && record.resourceVersion >= 0, `${at}: authoritative resourceVersion required`); }

const dealList = await get("listDeals", "/deals?limit=1");
assert(Array.isArray(dealList.items), "listDeals.items missing");
if (dealList.items[0]) { assertVersion(dealList.items[0], "Deal list"); assertMoney(dealList.items[0].amount, "Deal amount"); }
const deal = await get("getDeal", `/deals/${encodeURIComponent(process.env.UNICORE_PROVIDER_DEAL_ID)}`);
assertVersion(deal, "Deal detail"); assertMoney(deal.amount, "Deal amount");

const quoteList = await get("listQuotes", "/quotes?limit=1");
assert(Array.isArray(quoteList.items), "listQuotes.items missing");
if (quoteList.items[0]) { assertVersion(quoteList.items[0], "Quote list"); assert(Number.isInteger(quoteList.items[0].quoteRevision), "Quote business revision missing"); }
const quote = await get("getQuote", `/quotes/${encodeURIComponent(process.env.UNICORE_PROVIDER_QUOTE_ID)}`);
assertVersion(quote, "Quote detail"); assertMoney(quote.grandTotal, "Quote grandTotal"); assert(typeof quote.actions?.accept?.allowed === "boolean", "Quote acceptance availability missing");

const orderList = await get("listOrders", "/orders?limit=1");
assert(Array.isArray(orderList.items), "listOrders.items missing");
if (orderList.items[0]) assertVersion(orderList.items[0], "Order list");
const order = await get("getOrder", `/orders/${encodeURIComponent(process.env.UNICORE_PROVIDER_ORDER_CONFIRM_ID)}`);
assertVersion(order, "Order detail"); assertMoney(order.grandTotal, "Order grandTotal"); assert(typeof order.actions?.confirm?.allowed === "boolean", "Order confirmation availability missing");

const denied = await get("getQuote-cross-workspace", `/quotes/${encodeURIComponent(process.env.UNICORE_PROVIDER_QUOTE_ID)}`, 403, process.env.UNICORE_PROVIDER_SECONDARY_ACCESS_TOKEN, process.env.UNICORE_PROVIDER_SECONDARY_WORKSPACE_ID);
assert(denied.code === "WORKSPACE_MISMATCH" || denied.code === "RESOURCE_NOT_FOUND", "Cross-workspace read must not disclose the Quote");
console.log("[commercial-read-provider] PASS Deal/Quote/Order list/detail projections and workspace denial");
