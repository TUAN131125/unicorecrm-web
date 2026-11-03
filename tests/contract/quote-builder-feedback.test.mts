import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { quoteBuilderIssues, quoteBuilderFieldBinding, quoteBuilderFieldFeedback, quoteBuilderServerIssues, quoteBuilderSubmissionIssues, focusQuoteBuilderField } from "@/modules/quotes/presentation/model/quoteBuilderErrors";
import { quoteBuyerProblem } from "@/modules/quotes/presentation/components/QuoteBuyerField";
import { ApplicationError } from "@/shared/domain";
import type { QuoteLineItem } from "@/modules/quotes/domain/model/quote.types";
const valid: QuoteLineItem = { id: "line-one", productNameSnapshot: "Service", quantity: 2, unitPriceSnapshot: 100, discountPercent: 0 };
for (const vi of [true, false]) {
  assert.deepEqual(quoteBuilderIssues("Quote", [valid], vi), []);
  assert.deepEqual(quoteBuilderIssues("Quote", [valid], vi, [], ""), [], "Draft recipient email is optional");
  assert.equal(quoteBuilderIssues("Quote", [valid], vi, [], "invalid-email")[0]?.target, "quote-recipient-email");
  assert.equal(quoteBuilderFieldBinding("quote-title", { title: "A", recipientEmail: "first@example.test" }), quoteBuilderFieldBinding("quote-title", { title: "A", recipientEmail: "changed@example.test" }));
  assert.notEqual(quoteBuilderFieldBinding("quote-title", { title: "A" }), quoteBuilderFieldBinding("quote-title", { title: "B" }));
  const rejectedBuyer = { target: "quote-buyer", message: "Not eligible", buyerVersion: 0 };
  const buyerQuote = { buyerRef: { type: "ORGANIZATION_ACCOUNT" as const, id: "organization-one" } };
  for (const buyer of [{ version: 0, state: "READY", canReadStatus: true, status: "active" }, { version: 1, state: "LOADING", canReadStatus: true, status: "active" }, { version: 1, state: "READY", canReadStatus: false }, { version: 1, state: "READY", canReadStatus: true, status: "prospect" }]) {
    assert.ok(quoteBuilderFieldFeedback(buyerQuote, buyer).fieldIssueCurrent(rejectedBuyer), "A refresh alone cannot clear owner rejection");
  }
  assert.equal(quoteBuilderFieldFeedback(buyerQuote, { version: 1, state: "READY", canReadStatus: true, status: "active" }).fieldIssueCurrent(rejectedBuyer), false);
  assert.ok(quoteBuyerProblem("ORGANIZATION_ACCOUNT", { state: "READY", status: "prospect", canReadStatus: true }, vi));
  assert.equal(quoteBuyerProblem("ORGANIZATION_ACCOUNT", { state: "READY", status: "active", canReadStatus: true }, vi), undefined);
  assert.doesNotMatch(quoteBuyerProblem("ORGANIZATION_ACCOUNT", { state: "READY", status: undefined, canReadStatus: false }, vi) ?? "", /deleted|missing|bị xóa|thiếu dữ liệu/iu);
  assert.equal(quoteBuyerProblem("CONTACT", { state: "READY", status: undefined, canReadStatus: false }, vi), undefined, "Masked Contact fields do not establish ineligibility");
  const issues = quoteBuilderIssues("", [{ ...valid, productNameSnapshot: "", quantity: 0, inputDecimals: { unitPrice: "1.1234567" }, discountPercent: 101 }], vi);
  assert.deepEqual(issues.map(issue => issue.target), ["quote-title", "line-line-one-name", "line-line-one-quantity", "line-line-one-price", "line-line-one-discount"]);
  assert.ok(quoteBuilderIssues("Quote", [], vi).some(issue => issue.target === "quote-lines"));
  const server = quoteBuilderServerIssues({ recipientEmail: ["private SQL diagnostic"], "lineItems[0].quantity": ["secret DTO"], "unknown.private": ["token"] }, [valid], vi);
  assert.deepEqual(server.map(issue => issue.target), ["quote-recipient-email", "line-line-one-quantity"]);
  assert.doesNotMatch(JSON.stringify(server), /private|secret|SQL|DTO|token/);
  assert.deepEqual(quoteBuilderServerIssues({ constructor: ["private"], toString: ["private"] }, [valid], vi), []);
  const request = new ApplicationError({ code: "CONTRACT_VIOLATION", message: "private transport diagnostic", details: { direction: "request", issues: [{ path: "$.recipientEmail", message: "private schema detail" }] } });
  assert.deepEqual(quoteBuilderSubmissionIssues(request, [valid], vi).map(issue => issue.target), ["quote-recipient-email"]);
  const response = new ApplicationError({ code: "CONTRACT_VIOLATION", message: "bad server response", details: { direction: "response", issues: [{ path: "$.recipientEmail" }] } });
  assert.deepEqual(quoteBuilderSubmissionIssues(response, [valid], vi), [], "Broken response data must not be presented as user input errors");
  const denied = new ApplicationError({ code: "ACCESS_DENIED", category: "AUTHORIZATION", status: 403, message: "private policy", fieldErrors: { title: ["restricted"] } });
  assert.deepEqual(quoteBuilderSubmissionIssues(denied, [valid], vi), [], "A real authorization denial must retain its denial feedback");
}
const dom = new JSDOM('<!doctype html><div id="root"></div><input data-quote-error-target="email"><input data-quote-error-target="email">', { pretendToBeVisual: true });
for (const key of ["window", "document", "HTMLElement", "MutationObserver", "Event"] as const) Object.defineProperty(globalThis, key, { configurable: true, value: key === "window" ? dom.window : dom.window[key] });
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
const inputs = [...document.querySelectorAll("input")];const visible = inputs[1];assert.ok(visible);
Object.defineProperty(inputs[0], "getClientRects", { value: () => [] });
Object.defineProperty(visible, "getClientRects", { value: () => [new dom.window.DOMRect(0, 0, 100, 40)] });
let scrolled = false;visible.scrollIntoView = () => { scrolled = true; };
focusQuoteBuilderField("email");assert.equal(document.activeElement, visible);assert.ok(scrolled);
const React = await import("react"), { createRoot } = await import("react-dom/client");
const { useFloatingUtilityLayout } = await import("@/components/ai/useFloatingUtilityLayout");
let top = 700;const bar = document.createElement("div");bar.dataset.mobileActionBar = "true";bar.getBoundingClientRect = () => new dom.window.DOMRect(0, top, 1000, 80);document.body.append(bar);
Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
function Harness() { useFloatingUtilityLayout("/quotes/new");return null; }
const host = document.getElementById("root");assert.ok(host);const root = createRoot(host);
await React.act(async () => root.render(React.createElement(Harness)));
await new Promise(resolve => setTimeout(resolve, 60));assert.equal(document.documentElement.style.getPropertyValue("--crm-mobile-action-height"), "100px");
top = 620;document.dispatchEvent(new dom.window.Event("scroll"));await new Promise(resolve => setTimeout(resolve, 60));assert.equal(document.documentElement.style.getPropertyValue("--crm-mobile-action-height"), "180px");
top = 900;window.dispatchEvent(new dom.window.Event("resize"));await new Promise(resolve => setTimeout(resolve, 60));assert.equal(document.documentElement.style.getPropertyValue("--crm-mobile-action-height"), "0px");
await React.act(async () => root.unmount());assert.equal(document.documentElement.style.getPropertyValue("--crm-mobile-action-height"), "0px");
console.log("PASS Quote builder feedback: two locales, all affected fields, safe server mapping, visible-field focus; floating utility desktop clearance, scroll/resize and cleanup.");
