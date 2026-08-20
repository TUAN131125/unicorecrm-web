import { walkAllFiles } from "../../../scripts/quality/core/filesystem.mjs";
import assert from "node:assert/strict";
import { LEAD_DEMO_SEED } from "../../../src/modules/leads/infrastructure/dev-memory/leadDemoSeed";
import {
  LeadWorkState,
  QualificationOutcome,
  validateCanonicalLeadLifecycle,
} from "../../../src/modules/leads/domain/model/leadLifecycle.canonical";
import { previewLeadMigration } from "../../../src/migrations/canonical-v1/leadMigrationPreview";
import { readPresentationComposition } from "../../../scripts/lib/presentationCompositionSource.mts";

for (const lead of LEAD_DEMO_SEED) {
  assert.equal("status" in lead, false, `Lead ${lead.id} must not keep a combined status field`);
  const errors = validateCanonicalLeadLifecycle({
    leadWorkState: lead.leadWorkState,
    qualificationOutcome: lead.qualificationOutcome,
    relationshipRef: lead.relationshipRef,
    dealRef: lead.dealRef,
  });
  assert.deepEqual(errors, [], `Lead ${lead.id} must satisfy canonical lifecycle invariants`);

  if (lead.migrationReview) {
    assert.equal(lead.leadWorkState, LeadWorkState.VERIFYING, `Review Lead ${lead.id} must remain in VERIFYING`);
    assert.equal(lead.qualificationOutcome, undefined, `Review Lead ${lead.id} must not invent an outcome`);
    assert.equal(lead.relationshipRef, undefined, `Review Lead ${lead.id} must not invent a relationship reference`);
    assert.equal(lead.dealRef, undefined, `Review Lead ${lead.id} must not invent a Deal reference`);
  }
}

assert.ok(LEAD_DEMO_SEED.some((lead) => lead.migrationReview?.legacyStatus === "QUALIFIED"), "Legacy QUALIFIED ambiguity must remain explicit migration-review metadata");
assert.ok(LEAD_DEMO_SEED.some((lead) => lead.migrationReview?.legacyStatus === "CONVERTED"), "Legacy CONVERTED ambiguity must remain explicit migration-review metadata");

assert.ok(
  validateCanonicalLeadLifecycle({ leadWorkState: LeadWorkState.CLOSED }).some((message) => message.includes("qualificationOutcome")),
  "CLOSED Lead without outcome must fail",
);
assert.ok(
  validateCanonicalLeadLifecycle({
    leadWorkState: LeadWorkState.CLOSED,
    qualificationOutcome: QualificationOutcome.NURTURE,
  }).some((message) => message.includes("relationshipRef")),
  "Positive outcome without relationshipRef must fail",
);
assert.ok(
  validateCanonicalLeadLifecycle({
    leadWorkState: LeadWorkState.CLOSED,
    qualificationOutcome: QualificationOutcome.OPPORTUNITY,
    relationshipRef: { type: "CONTACT", id: "contact-1" },
  }).some((message) => message.includes("dealRef")),
  "OPPORTUNITY without dealRef must fail",
);
assert.deepEqual(
  validateCanonicalLeadLifecycle({
    leadWorkState: LeadWorkState.CLOSED,
    qualificationOutcome: QualificationOutcome.OPPORTUNITY,
    relationshipRef: { type: "CONTACT", id: "contact-1" },
    dealRef: "deal-1",
  }),
  [],
  "Canonical OPPORTUNITY with relationshipRef and dealRef must pass",
);

const reviewLead = LEAD_DEMO_SEED.find((lead) => lead.migrationReview);
assert.ok(reviewLead, "Lead seed must contain at least one explicit migration-review record");
const unresolvedPreview = previewLeadMigration(reviewLead);
assert.equal(unresolvedPreview.disposition, "REVIEW");
assert.equal(unresolvedPreview.canonical.leadWorkState, LeadWorkState.VERIFYING);
assert.equal(unresolvedPreview.canonical.qualificationOutcome, undefined);

const opportunityPreview = previewLeadMigration(reviewLead, {
  relationshipRef: { type: "CONTACT", id: "contact-evidence" },
  linkedDealId: "deal-evidence",
});
assert.equal(opportunityPreview.disposition, "INFER");
assert.equal(opportunityPreview.canonical.qualificationOutcome, QualificationOutcome.OPPORTUNITY);
assert.deepEqual(opportunityPreview.canonical.relationshipRef, { type: "CONTACT", id: "contact-evidence" });
assert.equal(opportunityPreview.canonical.dealRef, "deal-evidence");

for (const file of walkAllFiles("src")) {
  if (!/\.(ts|tsx)$/.test(file)) continue;
  const source = readPresentationComposition(file, "utf8");
  assert.equal(/\bLeadStatus\b/.test(source), false, `${file} must not use the retired combined LeadStatus contract`);
  assert.equal(/\blead\.status\b/.test(source), false, `${file} must not read a combined Lead status field`);
}

const activeLeadLifecycleRoots = [
  "src/modules/leads/application",
  "src/modules/leads/domain/rules",
  "src/modules/leads/presentation",
  "src/workflows/lead-qualification",
];
for (const root of activeLeadLifecycleRoots) {
  for (const file of walkAllFiles(root)) {
    if (!/\.(ts|tsx)$/.test(file)) continue;
    const source = readPresentationComposition(file, "utf8");
    assert.equal(/\b(?:QUALIFIED|CONVERTED|CONTACTED)\b/.test(source), false, `${file} must not use legacy Lead lifecycle values in active Lead runtime logic`);
  }
}

const listSource = read("src/modules/leads/presentation/pages/LeadListPage.tsx");
const filterSource = read("src/modules/leads/presentation/hooks/useLeadFilters.ts");
const tableSource = read("src/modules/leads/presentation/components/LeadTable.tsx");
const detailSource = read("src/modules/leads/presentation/pages/LeadDetailPage.tsx");
assert.match(listSource, /leadWorkState/);
assert.match(listSource, /qualificationOutcome/);
assert.match(filterSource, /getLeadLifecycleDisplayKey/);
assert.match(tableSource, /getLeadBadgeVariant/);
assert.match(detailSource, /changeWorkState/);
assert.match(detailSource, /leadActions\.disqualify/);

console.log("Lead lifecycle contracts: OK");

function read(file: string): string {
  return readPresentationComposition(file, "utf8");
}

