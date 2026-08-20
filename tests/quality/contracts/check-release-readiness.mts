import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import path from "node:path";
import { readPresentationComposition } from "../../../scripts/lib/presentationCompositionSource.mts";

const root = repositoryRoot;
const surfaces = [
  "src/app/router/redirects/CanonicalRouteRedirects.tsx",
  "src/app/shell/layout/Sidebar.tsx",
  "src/modules/orders/presentation/pages/OrderFormPage.tsx",
  "src/modules/orders/presentation/pages/OrderDetailPage.tsx",
  "src/modules/quotes/presentation/pages/QuoteDetailPage.tsx",
  "src/modules/shipping/presentation/pages/ShippingBookingListPage.tsx",
  "src/components/ai/AiAssistantDrawer.tsx",
  "src/components/ai/AiAssistantButton.tsx",
];
const forbidden = [
  /centrixcrm/i,
  /Demo Viewer/i,
  /commercial proposal/i,
  /không tự động quay về Dashboard/i,
  /deep link này/i,
  /product space này/i,
  /khối lượng kiện thực tế/i,
  /map tự động/i,
  /shipment group/i,
  /booking context/i,
  /fulfillment evidence/i,
  /Order closing policy/i,
];
for (const file of surfaces) {
  const source = readPresentationComposition(path.join(root, file), "utf8");
  for (const pattern of forbidden) assert.equal(pattern.test(source), false, `${file} contains release-blocking copy: ${pattern}`);
}
const sidebar = readPresentationComposition(path.join(root, "src/app/shell/layout/Sidebar.tsx"), "utf8");
assert.ok(sidebar.includes('label("QUAN HỆ KHÁCH HÀNG", "CUSTOMER RELATIONSHIPS")'));
assert.ok(sidebar.includes('label("Hồ sơ khách hàng", "Customer profiles")'));
console.log(`Release readiness copy guard: PASS (${surfaces.length} critical surfaces)`);
