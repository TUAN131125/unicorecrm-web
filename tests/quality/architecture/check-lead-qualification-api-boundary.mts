import assert from "node:assert/strict";
import fs from "node:fs";
import { LeadQualificationHttpAdapter } from "@/workflows/lead-qualification/infrastructure/http/LeadQualificationHttpAdapter";
import type { LeadQualificationWorkflowResponse } from "@/platform/api/generated/commercialApi";

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
};
const options = { idempotencyKey: "qualification-attempt-0001", expectedVersion: 3 };

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
const directSaleRequest = requests.find((item) => item.operationId === "qualifyLeadForDirectSale");
assert.deepEqual(((directSaleRequest?.body.lineItems as Array<{ unitPrice: unknown }>)[0]).unitPrice, { amount: "50000000", currency: "VND" });

const publicSource = fs.readFileSync("src/workflows/lead-qualification/public/leadQualification.ts", "utf8");
assert.match(publicSource, /getLeadQualificationApiRuntime/);
assert.match(publicSource, /api\.mode === "connected"/);
assert.doesNotMatch(publicSource, /executeMutationCommand\([\s\S]{0,120}api\.mode === "connected"/u);
const connectedSource = fs.readFileSync("src/workflows/lead-qualification/infrastructure/http/createLeadQualificationConnectedApiRuntime.ts", "utf8");
assert.match(connectedSource, /LeadQualificationHttpAdapter/);
const generic = fs.readFileSync("src/platform/api/contracts/generatedProductionCommandRegistry.ts", "utf8");
assert.doesNotMatch(generic, /lead\.qualify-(?:nurture|opportunity|direct-sale)/u);

console.log("[lead-qualification-api-boundary] PASS");
