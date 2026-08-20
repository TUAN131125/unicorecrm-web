import assert from "node:assert/strict";
import type { Deal } from "@/modules/deals";
import { buildAdvancedForecastSnapshot, buildForecastTrend, reconcileForecastAccuracy } from "@/workspaces/crm/forecast/advancedForecast";
const base = { buyerRef: { type: "CONTACT", id: "c1" }, customerId: "cus", customerName: "Customer", interestedProducts: [], lineItems: [], createdAt: "2026-01-01", updatedAt: "2026-01-01", expectedCloseDate: "2026-09-15", stageEnteredAt: "2026-01-01", nextActionAt: "2026-08-01" };
const deals = [
  { ...base, id: "d1", name: "Commit", stage: "NEGOTIATION", amount: 100, opportunityScore: 90, ownerId: "u1", forecastCategory: "COMMIT" },
  { ...base, id: "d2", name: "Best", stage: "PROPOSAL", amount: 200, opportunityScore: 60, ownerId: "u1", forecastCategory: "BEST_CASE" },
  { ...base, id: "d3", name: "Pipeline", stage: "DISCOVERY", amount: 300, opportunityScore: 20, ownerId: "u2", forecastCategory: "PIPELINE" },
  { ...base, id: "d4", name: "Won", stage: "WON", amount: 80, opportunityScore: 100, ownerId: "u1", forecastCategory: "COMMIT", actualCloseDate: "2026-08-20", wonAt: "2026-08-20" },
] as unknown as Deal[];
const snapshot = reconcileForecastAccuracy(buildAdvancedForecastSnapshot({ workspaceId: "ws", deals, periodStart: "2026-07-01", periodEnd: "2026-09-30", capturedAt: "2026-07-10T00:00:00Z" }), deals);
assert.equal(snapshot.categories.find((item) => item.category === "COMMIT")?.amount, 100);
assert.equal(snapshot.weightedAmount, 270);
assert.equal(snapshot.actualWonAmount, 80);
assert.equal(snapshot.accuracyPercent, 80);
assert.equal(snapshot.owners.length, 2);
assert.equal(buildForecastTrend([snapshot])[0].commit, 100);
console.log("Advanced forecast analytics: PASS — category totals, weighted value, owner split, snapshots and accuracy verified");
