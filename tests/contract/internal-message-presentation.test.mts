import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import type { EffectiveRecordAccess } from "@/platform/access-control/application/effectiveRecordAccess";
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: "http://localhost", pretendToBeVisual: true });
for (const key of ["window", "document", "navigator", "localStorage", "HTMLElement", "Element", "Node", "Event", "CustomEvent", "EventTarget", "MutationObserver"] as const) Object.defineProperty(globalThis, key, { value: key === "window" ? dom.window : dom.window[key], configurable: true });
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { value: true, configurable: true });
Object.defineProperty(dom.window, "matchMedia", { value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) });
const React = await import("react"), { act } = React;
const { createRoot } = await import("react-dom/client");
const auth = await import("@/platform/identity-auth");
assert.ok(auth.signIn({ email: "admin@unicorecrm.local", password: "admin123" }).ok);
const { initializeApplicationComposition } = await import("@/app/composition");
await initializeApplicationComposition({ mode: "demo" });
const ac = await import("@/platform/access-control");
const { configureEffectiveRecordAccessAuthority } = await import("@/platform/access-control/application/effectiveRecordAccessBinding");
const ws = await import("@/platform/workspace-context");
await ac.loadAccessGovernance(ws.getWorkspaceContextSnapshot().workspaceId);
const { I18nProvider } = await import("@/i18n");
const { EffectiveFieldAccessScope } = await import("@/platform/access-control/react/EffectiveFieldAccessScope");
const { DealDetailField } = await import("@/modules/deals/presentation/views/DealDetailField");
const { ApplicationError } = await import("@/shared/domain");
const { formatApplicationError } = await import("@/shared/operations");
const { presentAiProviderFailure } = await import("@/ai");
const { orderCompletionBlockersMessage } = await import("@/modules/orders/presentation/model/orderActionPolicy");
const host = document.getElementById("root"); assert.ok(host); const root = createRoot(host);
let fail = false, mounts = 0;
let decision: EffectiveRecordAccess = {
  workspaceId: ws.getWorkspaceContextSnapshot().workspaceId, resourceKey: "deals", recordId: "presentation-fixture",
  canRead: true, canUpdate: true, canDelete: false, canExport: false, canApprove: false,
  allowedCommands: ["deal.update"], fieldAccess: { name: "READ_WRITE", notes: "READ_WRITE" },
  decisionReasons: [], evaluatedAt: "2026-11-01T00:00:00Z", authority: "backend",
};
configureEffectiveRecordAccessAuthority({ source: "backend", async evaluate() { if (fail) throw new ApplicationError({ code: "ACCESS_DENIED", status: 403, message: "internal policy detail", category: "AUTHORIZATION" }); return decision; } });
function SensitiveValue() { mounts++; return React.createElement("span", null, "protected-secret"); }
function Actions() { const access = ac.useEffectiveRecordAccessDecision(); return access?.canUpdate && access.allowedCommands.includes("deal.update") ? React.createElement("button", null, "Edit") : null; }
let cycle = 0;
async function render(locale: "vi" | "en", command?: string) {
  localStorage.setItem("centrix_locale", locale);
  const children = React.createElement(React.Fragment, null,
    React.createElement(DealDetailField, { field: "name", children: "Visible name" }),
    React.createElement(EffectiveFieldAccessScope, { fieldKey: "notes", children: React.createElement(SensitiveValue) }),
    React.createElement(Actions));
  await act(async () => root.render(React.createElement(I18nProvider, { key: ++cycle, children: React.createElement(ac.EffectiveRecordAccessBoundary, { resourceKey: "deals", recordId: "presentation-fixture", requestedFields: ["name", "notes"], ...(command ? { requiredCommand: command } : {}), children }) })));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
}
for (const locale of ["vi", "en"] as const) {
  assert.doesNotMatch(orderCompletionBlockersMessage(["SQL DTO failed: request-internal-secret"], locale), /SQL|DTO|request-internal-secret/);
  assert.match(orderCompletionBlockersMessage(["Deposit has 100 VND outstanding before Order completion."], locale), /Thanh toán|Payments/);
  assert.match(orderCompletionBlockersMessage(["Required outbound ShippingBooking does not exist."], locale), /Giao hàng|Delivery/);
  decision = { ...decision, canRead: true, canUpdate: true, allowedCommands: ["deal.update"], fieldAccess: { name: "READ_WRITE", notes: "READ_WRITE" } };
  await render(locale); assert.match(host.textContent ?? "", /Visible name/); assert.ok(host.querySelector("button"));
  decision = { ...decision, canUpdate: false, allowedCommands: [], fieldAccess: { name: "READ_ONLY", notes: "MASKED" } };
  mounts = 0; await render(locale);
  assert.match(host.textContent ?? "", /Visible name/); assert.match(host.textContent ?? "", /—/);
  assert.equal(mounts, 0, "Masked children must not render or mount, even without a custom fallback");
  assert.equal(host.querySelector("button"), null);
  assert.doesNotMatch(host.textContent ?? "", /protected-secret|read.only|restricted|chỉ có quyền|giới hạn/iu);
  await render(locale); assert.doesNotMatch(host.textContent ?? "", /protected-secret|read.only|restricted|chỉ có quyền|giới hạn/iu);
  decision = { ...decision, fieldAccess: { name: "HIDDEN", notes: "HIDDEN" } };
  await render(locale); assert.doesNotMatch(host.textContent ?? "", /Visible name|protected-secret/);
  decision = { ...decision, canRead: false };
  await render(locale); assert.ok(host.querySelector('[data-effective-access="denied"]')); assert.doesNotMatch(host.textContent ?? "", /Visible name|protected-secret/);
  decision = { ...decision, canRead: true };
  await render(locale, "deal.update"); assert.ok(host.querySelector('[data-effective-access="denied"]'));
  fail = true; await render(locale); assert.ok(host.querySelector('[data-access-verification-state="error"]')); assert.ok(host.querySelector("button")); assert.doesNotMatch(host.textContent ?? "", /internal policy|protected-secret/); fail = false;
  const message = formatApplicationError(new ApplicationError({ code: "ACCESS_DENIED", status: 403, message: "FLS DTO secret", category: "AUTHORIZATION" }), { locale });
  assert.ok(message); assert.doesNotMatch(message, /FLS|DTO|secret/);
  const provider = new ApplicationError({ code: "AI_PROVIDER_UNAVAILABLE", message: "Provider unavailable", fieldErrors: { provider: ["CREDENTIAL_REJECTED"] } });
  assert.doesNotMatch(presentAiProviderFailure(provider, locale) ?? "", /API key|Studio|khóa/);
  assert.match(presentAiProviderFailure(provider, locale, "ADMIN") ?? "", /API key/);
}
await act(async () => root.unmount());
// Optional document/configuration failures must not replace an otherwise readable Order.
const { OrderCustomerDocument } = await import("@/modules/orders/presentation/components/OrderCustomerDocument");
const { OrderState } = await import("@/modules/orders");
const configuration = await import("@/platform/workspace-config/workspaceOperationalConfigurationRuntime");
const documentOrder: import("@/modules/orders").CustomerOrder = {
  id: "document-denial-fixture", orderNumber: "ORD-TEST", orderDate: "2026-11-01",
  buyerRef: { type: "CONTACT", id: "contact-fixture" }, state: OrderState.DRAFT, items: [], totalAmount: 0,
  createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-01T00:00:00Z",
};
const documentRoot = createRoot(host);
configuration.configureWorkspaceOperationalConfigurationLoader(async () => { throw new ApplicationError({ code: "ACCESS_DENIED", message: "private configuration diagnostic", status: 403, category: "AUTHORIZATION" }); });
const documentRef = React.createRef<HTMLDivElement>();
await act(async () => documentRoot.render(React.createElement(React.Fragment, null,
  React.createElement("p", null, "Core order remains visible"),
  React.createElement(React.Suspense, { fallback: "Loading document", children: React.createElement(OrderCustomerDocument, { ref: documentRef, order: documentOrder, customerLabel: "Customer", locale: "vi" }) }))));
await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
assert.match(host.textContent ?? "", /Core order remains visible/);
assert.match(host.textContent ?? "", /Không thể tải tài liệu đơn hàng/);
assert.doesNotMatch(host.textContent ?? "", /private configuration diagnostic/);
assert.equal(documentRef.current, null, "A denied document must never become a printable success artifact");
await act(async () => documentRoot.unmount());
configuration.configureWorkspaceOperationalConfigurationLoader();
// Preserve the explicit attachment-reference workflow without rendering internal identifiers.
const { default: QuoteProofScanCard } = await import("@/modules/quotes/presentation/components/QuoteProofScanCard");
const proof: import("@/modules/quotes/public/proofs").AcceptanceProof = {
  proofId: "private-proof-reference", caseId: "private-case", quoteId: "quote-fixture", uploadedBy: "private-member",
  evidenceType: "CUSTOMER_CONSENT", fileName: "consent.pdf", mediaType: "application/pdf", fileSize: 128,
  sha256: "private-file-hash", storageStatus: "QUARANTINED", scanStatus: "CLEAN", uploadedAt: "2026-11-01",
  resourceVersion: 12, retention: "test", contentAvailable: false, structuralStatus: "VALID",
  malwareVerdict: "CLEAN", scanReasonCode: "CLEAN", reviewable: true,
};
const proofRoot = createRoot(host);
let copied = "", clipboardDenied = false;
Object.defineProperty(navigator, "clipboard", { configurable: true, value: { async writeText(value: string) {
  if (clipboardDenied) throw new Error("private clipboard diagnostic");
  copied = value;
} } });
for (const vi of [true, false]) {
  await act(async () => proofRoot.render(React.createElement(QuoteProofScanCard, { proof, workspaceId: decision.workspaceId, vi })));
  assert.doesNotMatch(host.textContent ?? "", /private-proof|private-case|private-member|private-file-hash/);
  const copy = [...host.querySelectorAll("button")].find(button => /Sao chép|Copy file/.test(button.textContent ?? ""));
  assert.ok(copy);
  clipboardDenied = false;
  await act(async () => copy.click());
  assert.equal(copied, proof.proofId);
  assert.match(host.querySelector('[role="status"]')?.textContent ?? "", /Đã sao chép|copied/);
  clipboardDenied = true;
  await act(async () => copy.click());
  assert.match(host.querySelector('[role="status"]')?.textContent ?? "", /Vui lòng thử lại|Please try again/);
  assert.doesNotMatch(host.textContent ?? "", /private clipboard diagnostic|private-proof-reference/);
}
await act(async () => proofRoot.unmount());
console.log("PASS internal message presentation: two locales; read/write, read-only, masked, hidden, denied, denied command, error/retry and remount; AI admin guidance remains separate.");
