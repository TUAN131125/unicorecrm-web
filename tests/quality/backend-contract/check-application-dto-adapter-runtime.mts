import assert from "node:assert/strict";
import { mapLeadDocumentToApplication } from "../../../src/modules/leads/infrastructure/http/LeadApiMapper";
import { mapProductDocumentToApplication } from "../../../src/modules/products/infrastructure/openapi/productReadModelMapper";
import { mapShippingBookingReadModelToApplication } from "../../../src/modules/shipping/infrastructure/openapi/shippingReadModelMapper";
import { mapReturnReadModelToApplication } from "../../../src/modules/returns/infrastructure/openapi/returnReadModelMapper";

const lead = mapLeadDocumentToApplication({
  id: "lead-1",
  displayName: "Nguyễn Minh",
  source: "WEB",
  score: 88,
  leadWorkState: "NEW",
  relationshipRef: { type: "CONTACT", id: "contact-1" },
  ownerId: "user-1",
  interestedProducts: [{
    id: "interest-1",
    productId: "product-1",
    productNameSnapshot: "Gói CRM",
    interestLevel: "high",
    expectedBudget: { amount: "12500000.50", currency: "VND" },
    createdAt: "2026-07-25T00:00:00.000Z",
  }],
  activityProjection: "NOT_INCLUDED",
  estimatedValue: { amount: "25000000.75", currency: "VND" },
  tags: [],
  createdAt: "2026-07-25T00:00:00.000Z",
  updatedAt: "2026-07-25T00:00:00.000Z",
  version: 7,
});
assert.deepEqual(lead.estimatedValue, { amount: "25000000.75", currency: "VND" });
assert.equal(lead.resourceVersion, 7);
assert.equal(lead.activitiesAuthority, "NOT_INCLUDED");
assert.equal(lead.interestedProducts[0]?.expectedBudgetMoney?.amount, "12500000.50");

const product = mapProductDocumentToApplication({
  id: "product-1",
  sku: "CRM-001",
  name: "Gói CRM",
  type: "service",
  status: "ACTIVE",
  category: "CRM",
  unit: "license",
  unitPrice: { amount: "499000.25", currency: "VND" },
  taxRate: "10",
  taxMode: "exclusive",
  billingCycle: "monthly",
  isSubscription: true,
  isRenewable: true,
  tags: ["crm"],
  createdAt: "2026-07-25T00:00:00.000Z",
  updatedAt: "2026-07-25T00:00:00.000Z",
  version: 3,
});
assert.deepEqual(product.unitPrice, { amount: "499000.25", currency: "VND" });
assert.equal(product.resourceVersion, 3);
assert.equal(product.status, "active");

const shipping = mapShippingBookingReadModelToApplication({
  id: "shipping-1",
  code: "SHP-001",
  sourceType: "ORDER",
  sourceId: "order-1",
  purpose: "ORDER_OUTBOUND",
  providerId: "provider-1",
  providerName: "Carrier",
  bookingStatus: "BOOKED",
  externalStatus: "IN_TRANSIT",
  pickupLocation: { line1: "1 Nguyễn Huệ", city: "Hồ Chí Minh" },
  recipient: { name: "Khách hàng", phone: "0900000000", address: { line1: "2 Lê Lợi", city: "Hồ Chí Minh" } },
  packageSummary: { packageCount: 1, totalWeightGrams: 1500, declaredValue: { amount: "25000000.75", currency: "VND" } },
  codAmount: { amount: "500000.50", currency: "VND" },
  shipmentGroupId: "shipment-group-1",
  attemptNo: 1,
  createdAt: "2026-07-25T00:00:00.000Z",
  updatedAt: "2026-07-25T00:00:00.000Z",
  resourceVersion: 4,
});
assert.deepEqual(shipping.codAmount, { amount: "500000.50", currency: "VND" });
assert.equal(shipping.shipmentGroupId, "shipment-group-1");
assert.equal(shipping.resourceVersion, 4);

const returned = mapReturnReadModelToApplication({
  id: "return-1",
  code: "RET-001",
  orderId: "order-1",
  buyerRef: { type: "CONTACT", id: "contact-1" },
  ownerId: "user-1",
  items: [],
  reason: "DAMAGED",
  requestedResolution: "REFUND",
  status: "REQUESTED",
  requestedAt: "2026-07-25T00:00:00.000Z",
  eligibility: { eligible: true, reasonCode: "ELIGIBLE", explanation: "Within policy", evaluatedAt: "2026-07-25T00:00:00.000Z" },
  createdAt: "2026-07-25T00:00:00.000Z",
  updatedAt: "2026-07-25T00:00:00.000Z",
  resourceVersion: 5,
});
assert.equal(returned.version, 5);
assert.equal(returned.eligibilityResult.eligible, true);

assert.throws(
  () => mapReturnReadModelToApplication({
    id: "return-invalid",
    code: "RET-INVALID",
    orderId: "order-1",
    buyerRef: { type: "CONTACT", id: "contact-1" },
    ownerId: "user-1",
    items: [],
    reason: "OTHER",
    requestedResolution: "REFUND",
    status: "REQUESTED",
    requestedAt: "2026-07-25T00:00:00.000Z",
    eligibility: { eligible: true },
    createdAt: "2026-07-25T00:00:00.000Z",
    updatedAt: "2026-07-25T00:00:00.000Z",
    resourceVersion: 1,
  }),
  (error: unknown) => Boolean(error && typeof error === "object" && "code" in error && error.code === "CONNECTED_QUERY_CONTRACT_VIOLATION"),
);

console.log("Application DTO adapter runtime: PASS (Lead/Product/Shipping/Return Money, version and fail-closed projection checks).");
