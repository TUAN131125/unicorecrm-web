import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import path from "node:path";
import { LeadWorkState } from "@/modules/leads/domain/model/leadLifecycle.canonical";
import { validateLeadProgressiveProfile } from "@/modules/leads/domain/rules/leadProgressiveProfile";
import { validateContactProgressiveProfile } from "@/modules/contacts/domain/rules/contactProgressiveProfile";
import { DealStage, type Deal } from "@/modules/deals/domain/model/deal.types";
import { validateDealProgressiveProfile } from "@/modules/deals/domain/rules/dealProgressiveProfile";
import {
  createDealForecastHistoryEntry,
  deriveDealForecastCategory,
  getDealPipelineHealth,
} from "@/modules/deals/domain/rules/dealPipelineHealth";
import { readPresentationComposition } from "../../../scripts/lib/presentationCompositionSource.mts";

const root = repositoryRoot;
const source = (relativePath: string) => readPresentationComposition(path.join(root, relativePath), "utf8");

assert.deepEqual(
  validateLeadProgressiveProfile({ name: "Lan", phone: "0900000000", ownerId: "u3" }, LeadWorkState.NEW, "QUICK"),
  ["source", "nextFollowUpAt"],
  "Lead Quick Create must require source and a next follow-up in addition to identity, contact channel, and owner.",
);
assert.deepEqual(
  validateLeadProgressiveProfile({
    name: "Lan",
    phone: "0900000000",
    ownerId: "u3",
    source: "Website",
    nextFollowUpAt: "2026-07-15T09:00:00.000Z",
  }, LeadWorkState.NEW, "QUICK"),
  [],
);
assert.ok(
  validateLeadProgressiveProfile(
    { name: "Lan", phone: "0900000000", ownerId: "u3" },
    LeadWorkState.VERIFYING,
    "COMPLETE",
    { requiredFieldsByState: { [LeadWorkState.VERIFYING]: ["painPoint"] } },
  ).includes("painPoint"),
  "Lead transition requirements must be configurable without hardcoding optional enrichment fields.",
);

assert.deepEqual(
  validateContactProgressiveProfile({ fullName: "Minh", email: "minh@example.com", ownerId: "u3" }, "active", "QUICK"),
  ["nextFollowUpAt"],
);
assert.ok(
  validateContactProgressiveProfile({ fullName: "Minh", email: "minh@example.com", ownerId: "u3", nextFollowUpAt: "2026-07-15T09:00:00.000Z" }, "has_open_opportunity", "COMPLETE").includes("organizationName"),
  "A Contact with an open opportunity must identify the related organization when required by lifecycle.",
);

const baseDeal: Deal = {
  id: "deal-health-contract",
  name: "CRM renewal",
  buyerRef: { type: "CONTACT", id: "contact-1" },
  customerName: "Customer One",
  stage: DealStage.PROPOSAL,
  amount: 100_000_000,
  opportunityScore: 65,
  ownerId: "u3",
  expectedCloseDate: "2026-08-01",
  forecastCategory: "BEST_CASE",
  stageEnteredAt: "2026-06-20T00:00:00.000Z",
  nextActionAt: "2026-07-01T09:00:00.000Z",
  nextActionSummary: "Review proposal",
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-25T00:00:00.000Z",
  interestedProducts: [],
  lineItems: [],
  activities: [],
};

assert.deepEqual(validateDealProgressiveProfile(baseDeal, DealStage.PROPOSAL, "QUICK"), []);
assert.deepEqual(
  validateDealProgressiveProfile({ ...baseDeal, nextActionAt: undefined, nextActionSummary: undefined }, DealStage.PROPOSAL, "QUICK"),
  [],
  "A follow-up task is useful but must not block Deal creation or editing.",
);
assert.ok(validateDealProgressiveProfile({ ...baseDeal, amount: 0 }, DealStage.PROPOSAL, "COMPLETE").includes("amount"));
assert.equal(deriveDealForecastCategory({ stage: DealStage.NEGOTIATION, opportunityScore: 60 }), "COMMIT");
assert.equal(deriveDealForecastCategory({ stage: DealStage.PROPOSAL, opportunityScore: 55 }), "BEST_CASE");
assert.equal(deriveDealForecastCategory({ stage: DealStage.DISCOVERY, opportunityScore: 30 }), "PIPELINE");

const health = getDealPipelineHealth(baseDeal, new Date("2026-07-15T12:00:00.000Z"));
assert.equal(health.daysInStage, 25);
assert.equal(health.nextStepStatus, "OVERDUE");
assert.equal(health.stale, true);
assert.equal(health.forecastCategory, "BEST_CASE");

const history = createDealForecastHistoryEntry(baseDeal, {
  expectedCloseDate: "2026-08-15",
  opportunityScore: 80,
  forecastCategory: "COMMIT",
  actor: "Sales Manager",
  occurredAt: "2026-07-15T12:00:00.000Z",
});
assert.ok(history);
assert.equal(history?.previousExpectedCloseDate, "2026-08-01");
assert.equal(history?.nextExpectedCloseDate, "2026-08-15");
assert.equal(history?.previousProbability, 65);
assert.equal(history?.nextProbability, 80);
assert.equal(history?.nextCategory, "COMMIT");
assert.equal(createDealForecastHistoryEntry(baseDeal, { occurredAt: "2026-07-15T12:00:00.000Z" }), null, "No-op forecast edits must not pollute history.");

const leadForm = source("src/components/LeadForm.tsx");
const contactForm = source("src/modules/contacts/presentation/components/ContactFormModal.tsx");
const contactList = source("src/modules/contacts/presentation/pages/ContactListPage.tsx");
const dealModal = source("src/modules/deals/presentation/components/DealFormModal.tsx");
const dealController = source("src/modules/deals/presentation/hooks/useDealPipelineController.ts");
const pipelinePage = source("src/modules/deals/presentation/pages/DealPipelinePage.tsx");
const dealDetail = source("src/modules/deals/presentation/pages/DealDetailPage.tsx");
const dealCommands = source("src/modules/deals/application/commands/dealCommands.ts");

for (const [name, fileSource, targets] of [
  ["Lead", leadForm, ["leads.form.quick-create", "leads.form.progressive-profile", "leads.form.advanced-toggle"]],
  ["Contact", contactForm, ["contacts.form.canonical", "contacts.form.progressive-profile", "contacts.form.advanced-toggle"]],
  ["Deal", dealModal, ["deals.form.quick-create", "deals.form.progressive-profile", "deals.form.advanced-toggle", "deals.form.next-step", "deals.form.forecast-category"]],
] as const) {
  for (const target of targets) assert.match(fileSource, new RegExp(`data-guidance-id=["']${target}["']`), `${name} Quick Create must retain ${target}.`);
}
assert.match(contactList, /createContactViaApi\(\{[\s\S]*fullName: data\.name/, "Contact Quick Create must submit the admitted backend Create contract.");
assert.doesNotMatch(contactList, /id: `contact_\$\{crypto\.randomUUID\(\)\}`/, "Contact Quick Create must not manufacture a local aggregate identity.");
assert.match(dealController, /validateDealProgressiveProfile/, "Deal create and edit commands must enforce lifecycle requirements outside HTML attributes.");
assert.match(dealController, /updateDealForecastCommand/, "Deal forecast edits must use the typed forecast command boundary.");
assert.match(dealCommands, /forecastHistory/, "Deal commands must persist forecast history.");
assert.match(pipelinePage, /DealPipelineHealthBadges/, "Pipeline cards and rows must expose health indicators.");
assert.match(dealDetail, /DealForecastHistoryPanel/, "Deal Detail must expose forecast change history.");

console.log("Sales Quick Create contracts: PASS — Lead, Contact, Deal progressive profiles and pipeline health verified.");
