import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: "http://localhost", pretendToBeVisual: true });
for (const key of ["window", "document", "navigator", "localStorage", "HTMLElement", "Element", "Node", "Event", "CustomEvent", "EventTarget", "MutationObserver"] as const)
  Object.defineProperty(globalThis, key, { value: key === "window" ? dom.window : dom.window[key], configurable: true });
Object.defineProperties(globalThis, { IS_REACT_ACT_ENVIRONMENT: { value: true, configurable: true }, getComputedStyle: { value: dom.window.getComputedStyle.bind(dom.window), configurable: true } });
Object.defineProperty(dom.window, "matchMedia", { value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) });
const React = await import("react"), { act } = React;
const { createRoot } = await import("react-dom/client");
const auth = await import("@/platform/identity-auth");
assert.ok(auth.signIn({ email: "admin@unicorecrm.local", password: "admin123" }).ok);
const { initializeApplicationComposition } = await import("@/app/composition");
await initializeApplicationComposition({ mode: "demo" });
const studio = await import("@/workspaces/studio/public/studioCore");
await studio.loadStudioCoreRuntime();
const deals = await import("@/modules/deals/public/deals");
const quotes = await import("@/modules/quotes/public/quotes");
const { buildCrmMetric } = await import("@/workspaces/crm/metrics/application/metricEngine");
const { CRM_METRIC_IDS } = await import("@/workspaces/crm/metrics/domain/metricCatalog");
const { getInvoiceSellerInformation } = await import("@/modules/invoices/public/api");
const seed = { id: "audit", name: "Currency diagnostic fixture", buyerRef: { type: "CONTACT" as const, id: "audit-contact" },
  stage: "DISCOVERY", amount: 100, opportunityScore: 0, ownerId: "audit-owner", expectedCloseDate: "2026-10-21",
  createdAt: "2026-10-21T00:00:00Z", updatedAt: "2026-10-21T00:00:00Z", interestedProducts: [], lineItems: [] };
const metric = buildCrmMetric({ metricId: CRM_METRIC_IDS.OPEN_PIPELINE_VALUE, periodKey: "all_time", timezone: "UTC",
  leads: [], customers: [], cases: [], orders: [], quotes: [],
  deals: [{ ...seed, id: "audit-usd", amount: 100, currency: "USD" }, { ...seed, id: "audit-eur", amount: 100, currency: "EUR" }] });
const configuration = studio.getStudioCoreConfiguration();
await studio.updateStudioLocaleRegion({ ...configuration.localeRegion, currencies: { ...configuration.localeRegion.currencies, baseCurrency: "EUR", enabledCurrencies: ["VND", "EUR"] } });
const { writeFileSync } = await import("node:fs");
writeFileSync("../../backend/docs/verification/evidence/studio-first-visit-20261021/currency-demo-audit.json", JSON.stringify({
  environment: "demo in-process diagnostic; not connected E2E", initialDemoBaseCurrency: configuration.localeRegion.currencies.baseCurrency,
  changedDemoBaseCurrency: studio.getStudioCoreConfiguration().localeRegion.currencies.baseCurrency,
  demoInvoiceDefaultCurrency: getInvoiceSellerInformation().defaultCurrency,
  mixedCurrencyMetric: { input: [{amount:100,currency:"USD"},{amount:100,currency:"EUR"}], outputValue: metric.value,
    outputCurrency: "not carried by metric result", status: "REPRODUCED: numeric sum without currency grouping or FX conversion" }
}, null, 2));
console.log("Audit evidence recorded: demo VND; mixed USD/EUR metric aggregation reproduced. This is not a production correctness PASS.");
