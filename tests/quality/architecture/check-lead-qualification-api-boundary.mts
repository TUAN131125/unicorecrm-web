import assert from "node:assert/strict";
import fs from "node:fs";
import { LeadQualificationHttpAdapter } from "@/workflows/lead-qualification/infrastructure/http/LeadQualificationHttpAdapter";
import { createLeadQualificationConnectedApiRuntime } from "@/workflows/lead-qualification/infrastructure/http/createLeadQualificationConnectedApiRuntime";
import type { LeadQualificationWorkflowResponse } from "@/platform/api/generated/commercialApi";
import { presentOpportunityFieldErrors } from "@/workflows/lead-qualification/presentation/model/leadOpportunityFieldErrors";
import { canRetainOpportunityIntent, createLeadOpportunityIntent } from "@/workflows/lead-qualification/presentation/model/leadOpportunityIntent";

const requests: Array<{ operationId: string; leadId: string; body: Record<string, unknown>; options: Record<string, unknown> }> = [];

function response(operationId: string, outcome: "NURTURE" | "OPPORTUNITY" | "DIRECT_SALE", leadId: string): LeadQualificationWorkflowResponse {
  const suffix = operationId.replace(/^qualifyLeadFor/u, "").toLowerCase();
  const related = outcome === "NURTURE" ? { taskId: `task-${suffix}` }
    : outcome === "OPPORTUNITY" ? { dealId: `deal-${suffix}`, taskId: `task-${suffix}` }
    : { quoteId: `quote-${suffix}` };
  return {
    commandId: `command-${suffix}`,
    correlationId: `correlation-${suffix}`,
    aggregateId: leadId,
    aggregateType: "lead",
    version: 4,
    occurredAt: "2026-07-25T00:00:00.000Z",
    outcome: "COMMITTED",
    warnings: [],
    emittedEventIds: [`event-${suffix}`],
    auditEvidenceIds: [`audit-${suffix}`],
    result: {
      leadId,
      leadVersion: 4,
      qualificationOutcome: outcome,
      relationship: {
        relationshipRef: { type: "CONTACT", id: "contact-1" },
        displayName: "Buyer",
        contactId: "contact-1",
      },
      contactId: "contact-1",
      ...related,
      createdResources: [
        { resourceType: "CONTACT", resourceId: "contact-1", resourceVersion: 2 },
        ...(outcome === "OPPORTUNITY" ? [{ resourceType: "DEAL" as const, resourceId: `deal-${suffix}`, resourceVersion: 0 }] : []),
      ],
    },
  };
}

const api = {
  async qualifyLeadForNurture(leadId: string, body: Record<string, unknown>, options: Record<string, unknown>) {
    requests.push({ operationId: "qualifyLeadForNurture", leadId, body, options });
    return response("qualifyLeadForNurture", "NURTURE", leadId);
  },
  async qualifyLeadForOpportunity(leadId: string, body: Record<string, unknown>, options: Record<string, unknown>) {
    requests.push({ operationId: "qualifyLeadForOpportunity", leadId, body, options });
    return response("qualifyLeadForOpportunity", "OPPORTUNITY", leadId);
  },
  async qualifyLeadForDirectSale(leadId: string, body: Record<string, unknown>, options: Record<string, unknown>) {
    requests.push({ operationId: "qualifyLeadForDirectSale", leadId, body, options });
    return response("qualifyLeadForDirectSale", "DIRECT_SALE", leadId);
  },
};

const adapter = new LeadQualificationHttpAdapter(api as never);
const relationship = {
  kind: "CONTACT" as const,
  mode: "NEW" as const,
  contact: { name: "Buyer", email: "buyer@example.com" },
  organization: { displayName: "Dormant company default" },
};
const options = { idempotencyKey: "qualification-attempt-0001", expectedVersion: 3 };
const unresolved = createLeadOpportunityIntent({ leadId: "lead-1", relationship, dealsEnabled: true, currency: "VND", deal: { name: "Intent", ownerId: "user-1", interestedProductIds: [] } }, 3, "workspace-A", 2);
assert.equal(canRetainOpportunityIntent(unresolved, "workspace-A", 2, "lead-1"), true);
assert.equal(canRetainOpportunityIntent(unresolved, "workspace-B", 2, "lead-1"), false);
assert.equal(canRetainOpportunityIntent(unresolved, "workspace-A", 3, "lead-1"), false);
assert.equal(canRetainOpportunityIntent(unresolved, "workspace-A", 2, "lead-2"), false);
assert.equal(canRetainOpportunityIntent(undefined, "workspace-A", 2, "lead-1"), false);

const nurture = await adapter.qualifyForNurture({
  leadId: "lead-1",
  relationship,
  revisitAt: "2026-08-01T09:00:00+07:00",
  reason: "Not ready yet",
}, options);
assert.equal(nurture.result.taskId, "task-nurture");

const opportunity = await adapter.qualifyForOpportunity({
  leadId: "lead-1",
  relationship,
  dealsEnabled: true,
  currency: "VND",
  deal: {
    name: "CRM rollout",
    ownerId: "user-1",
    interestedProductIds: ["product-1"],
    estimatedValue: 125000000,
    followUpTask: { title: "Discovery call", dueAt: "2026-08-02T02:00:00.000Z" },
  },
}, options);
assert.equal(opportunity.result.dealId, "deal-opportunity");

const directSale = await adapter.qualifyForDirectSale({
  leadId: "lead-1",
  relationship,
  path: "QUOTE",
  quoteEnabled: true,
  orderEnabled: true,
  actorCanSellNow: true,
  currency: "VND",
  lineItems: [{ productId: "product-1", name: "CRM", quantity: 2, unitPrice: 50000000, taxRate: 10, taxMode: "exclusive" }],
}, options);
assert.equal(directSale.result.quoteId, "quote-directsale");

assert.equal(requests.length, 3);
for (const request of requests) {
  assert.equal(request.leadId, "lead-1");
  assert.equal(request.options.idempotencyKey, options.idempotencyKey);
  assert.equal(request.options.expectedVersion, 3);
  assert.equal(request.options.retry, "idempotent");
  assert.ok(!("now" in request.body));
  assert.ok(!("idSeed" in request.body));
  assert.ok(!("actorCanSellNow" in request.body));
  assert.ok(!("quoteEnabled" in request.body));
  assert.ok(!("orderEnabled" in request.body));
}
const opportunityRequest = requests.find((item) => item.operationId === "qualifyLeadForOpportunity");
assert.deepEqual((opportunityRequest?.body.deal as { estimatedValue: unknown }).estimatedValue, { amount: "125000000", currency: "VND" });
assert.ok(!("organization" in (opportunityRequest?.body.relationship as Record<string, unknown>)));
const directSaleRequest = requests.find((item) => item.operationId === "qualifyLeadForDirectSale");
assert.deepEqual(((directSaleRequest?.body.lineItems as Array<{ unitPrice: unknown }>)[0]).unitPrice, { amount: "50000000", currency: "VND" });

for (const value of [undefined, null, "0"] as const) {
  await adapter.qualifyForOpportunity({ leadId: "lead-1", relationship, dealsEnabled: true, currency: "VND",
    deal: { name: "Optional fields", ownerId: "member-1", needSummary: null, interestedProductIds: [], ...(value === undefined ? {} : { estimatedValue: value }) } }, options);
  const wire = requests.at(-1)?.body.deal as Record<string, unknown>;
  assert.equal(wire.needSummary, undefined);
  assert.deepEqual(wire.estimatedValue, value === "0" ? { amount: "0", currency: "VND" } : value);
}

const publicSource = fs.readFileSync("src/workflows/lead-qualification/public/leadQualification.ts", "utf8");
assert.match(publicSource, /getLeadQualificationApiRuntime/);
assert.match(publicSource, /api\.mode === "connected"/);
assert.doesNotMatch(publicSource, /executeMutationCommand\([\s\S]{0,120}api\.mode === "connected"/u);
const connectedSource = fs.readFileSync("src/workflows/lead-qualification/infrastructure/http/createLeadQualificationConnectedApiRuntime.ts", "utf8");
assert.match(connectedSource, /LeadQualificationHttpAdapter/);
assert.doesNotMatch(connectedSource, /qualifyForNurture:\s*unavailable/u);
assert.doesNotMatch(connectedSource, /qualifyForOpportunity:\s*unavailable/u);
const adapterSource = fs.readFileSync("src/workflows/lead-qualification/infrastructure/http/LeadQualificationHttpAdapter.ts", "utf8");
assert.doesNotMatch(adapterSource, /Existing relationship contact/u);

const connectedRequests: string[] = [];
const connectedRuntime = createLeadQualificationConnectedApiRuntime({
  async request(input: { operationId: string; path: string }) {
    connectedRequests.push(`${input.operationId}:${input.path}`);
    const outcome = input.operationId === "qualifyLeadForNurture" ? "NURTURE" : "OPPORTUNITY";
    return response(input.operationId, outcome, "lead-1");
  },
} as never);
await connectedRuntime.commands.qualifyForNurture({
  leadId: "lead-1",
  relationship,
  revisitAt: "2026-08-01T02:00:00.000Z",
  reason: "Not ready yet",
}, options);
await connectedRuntime.commands.qualifyForOpportunity({
  leadId: "lead-1",
  relationship,
  dealsEnabled: true,
  currency: "VND",
  deal: { name: "CRM rollout", ownerId: "member-1", interestedProductIds: ["product-1"] },
}, options);
assert.deepEqual(connectedRequests, [
  "qualifyLeadForNurture:/workflows/lead-qualification/lead-1/nurture",
  "qualifyLeadForOpportunity:/workflows/lead-qualification/lead-1/opportunity",
]);
await assert.rejects(
  connectedRuntime.commands.qualifyForDirectSale({
    leadId: "lead-1",
    relationship,
    path: "QUOTE",
    quoteEnabled: true,
    orderEnabled: true,
    actorCanSellNow: true,
    currency: "VND",
    lineItems: [{ productId: "product-1", name: "CRM", quantity: 1, unitPrice: 1 }],
  }, options),
  (error: unknown) => error instanceof Error && "code" in error && error.code === "LEAD_DIRECT_SALE_UNAVAILABLE",
);
const generic = fs.readFileSync("src/platform/api/contracts/generatedProductionCommandRegistry.ts", "utf8");
assert.doesNotMatch(generic, /lead\.qualify-(?:nurture|opportunity|direct-sale)/u);

// Stage-specific requirements retain actionable feedback without raw diagnostics.
const diagnostic = "SQL private provider exception: secret-value";
const missingEstimate = { name: "Missing estimate", ownerId: "member-1", interestedProductIds: [] };
for (const vi of [false, true]) {
  const fields = presentOpportunityFieldErrors({ amount: [diagnostic] }, missingEstimate, vi);
  assert.match(fields["deal.estimatedValue"] ?? "", vi ? /Giai đoạn.*lớn hơn 0/u : /stage.*greater than zero/u);
  assert.doesNotMatch(JSON.stringify(fields), /SQL|private|secret-value/u);
  const invalid = presentOpportunityFieldErrors({ "deal.estimatedValue.amount": [diagnostic] }, { ...missingEstimate, estimatedValue: "bad" }, vi);
  assert.match(invalid["deal.estimatedValue"] ?? "", /6/u);
  assert.notEqual(invalid["deal.estimatedValue"], fields["deal.estimatedValue"]);
  const currencyAndDate = presentOpportunityFieldErrors({ "deal.estimatedValue.currency": [diagnostic], "deal.expectedCloseDate": [diagnostic] }, missingEstimate, vi);
  assert.ok(currencyAndDate["deal.currency"]);
  assert.ok(currencyAndDate["deal.expectedCloseDate"]);
  assert.equal(currencyAndDate["deal.estimatedValue"], undefined);
  assert.deepEqual(presentOpportunityFieldErrors({ "unknown.privateField": [diagnostic] }, missingEstimate, vi), {});
}
assert.deepEqual(presentOpportunityFieldErrors(undefined, missingEstimate, false), {});

console.log("[lead-qualification-api-boundary] PASS");
