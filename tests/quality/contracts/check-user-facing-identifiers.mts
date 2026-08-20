import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import path from "node:path";
import { readPresentationComposition } from "../../../scripts/lib/presentationCompositionSource.mts";

const root = repositoryRoot;
const read = (relative: string) => readPresentationComposition(path.join(root, relative), "utf8");

const memberDirectory = read("src/platform/member-directory/index.ts");
assert.equal(/displayName\s*\|\|\s*memberId\b/.test(memberDirectory), false, "Member resolver must never fall back to a technical member ID");
assert.ok(memberDirectory.includes("resolveWorkspaceMemberLabel"), "A localized unresolved-member label must exist");

const leadForm = read("src/components/LeadForm.tsx");
assert.equal(leadForm.includes('initialLead?.ownerId || "System"'), false, "Lead form must not expose owner ID");
assert.equal(leadForm.includes('>{initialLead.createdBy}</p>'), false, "Lead form must resolve creator identity");
assert.equal(leadForm.includes('>{initialLead.updatedBy}</p>'), false, "Lead form must resolve updater identity");
assert.ok(leadForm.includes("resolveWorkspaceMemberLabel"), "Lead form must use the workspace member resolver");

const quoteBuilder = read("src/modules/quotes/presentation/pages/QuoteBuilderPage.tsx");
assert.equal(quoteBuilder.includes(': referencedDeal.ownerId}'), false, "Quote Builder must not display a raw owner ID");
assert.ok(quoteBuilder.includes("resolveWorkspaceMemberLabel(referencedDeal.ownerId, locale)"));

const leadTable = read("src/modules/leads/presentation/components/LeadTable.tsx");
assert.equal(leadTable.includes('{lead.createdBy || "System"}'), false, "Lead table must resolve creator IDs");
assert.equal(leadTable.includes('{lead.updatedBy || "System"}'), false, "Lead table must resolve updater IDs");

const targetedSurfaces = [leadForm, quoteBuilder, leadTable, read("src/modules/customers/presentation/detail/CustomerDetailTabContent.tsx")];
for (const source of targetedSurfaces) {
  assert.equal(/>\s*\{[^}]*\.(ownerId|assigneeId|createdBy|updatedBy)\}\s*</.test(source), false, "User-facing identity fields must pass through a display resolver");
}

console.log("User-facing identifiers: PASS — member, owner, creator, updater, and status IDs are resolved before display");
