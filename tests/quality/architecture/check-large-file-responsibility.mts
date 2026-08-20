import assert from "node:assert/strict";
import fs from "node:fs";
import { buildRepositoryInventory } from "../../../scripts/repository-inventory/repositoryInventory.mjs";

const read = (file: string): string => fs.readFileSync(file, "utf8");
const lines = (file: string): number => read(file).split(/\r?\n/).length;
const inventory = buildRepositoryInventory();

const budgets: Record<string, number> = {
  "src/modules/deals/presentation/views/DealDetailView.tsx": 80,
  "src/modules/deals/presentation/views/DealDetailHeaderSection.tsx": 260,
  "src/modules/deals/presentation/views/DealDetailPipelineWorkspace.tsx": 400,
  "src/modules/deals/presentation/views/DealDetailQuoteWorkspace.tsx": 300,
  "src/modules/deals/presentation/views/DealDetailActivityTimeline.tsx": 300,
  "src/modules/deals/presentation/views/DealDetailSidebarActions.tsx": 380,
  "src/modules/deals/presentation/views/DealDetailRelatedRecords.tsx": 300,
  "src/modules/deals/presentation/views/DealDetailDialogs.tsx": 360,
  "src/ai/aiMockEngine.ts": 30,
  "src/ai/askCrmAi.ts": 480,
  "src/ai/focusedCustomerAi.ts": 300,
  "src/ai/aiInsights.ts": 480,
  "src/modules/shipping/presentation/pages/ShippingBookingCreatePage.tsx": 40,
  "src/modules/shipping/presentation/create/useShippingBookingCreateController.ts": 600,
  "src/modules/shipping/presentation/create/ShippingBookingCreateView.tsx": 380,
  "src/modules/shipping/presentation/create/ShippingBookingCreatePresentation.tsx": 180,
  "src/modules/shipping/presentation/create/shippingBookingCreateModel.ts": 120,
  "src/modules/returns/presentation/pages/ReturnDetailPage.tsx": 500,
  "src/modules/returns/presentation/detail/returnDetailModel.ts": 200,
  "src/modules/returns/presentation/detail/ReturnDetailPrimitives.tsx": 60,
  "src/modules/returns/presentation/detail/ReturnDetailChrome.tsx": 80,
};
for (const [file, maxLines] of Object.entries(budgets)) {
  assert.ok(fs.existsSync(file), `${file} must exist.`);
  assert.ok(lines(file) <= maxLines, `${file} exceeds ${maxLines} lines.`);
}

const dealEntry = read("src/modules/deals/presentation/views/DealDetailView.tsx");
for (const component of [
  "DealDetailHeaderSection",
  "DealDetailCommercialWorkspace",
  "DealDetailActivityTimeline",
  "DealDetailSidebar",
  "DealDetailDialogs",
]) assert.ok(dealEntry.includes(component), `Deal detail entry must compose ${component}.`);
assert.doesNotMatch(dealEntry, /<Modal\b|<Table\b|navigator\.clipboard|ProductPickerModal/);

const aiBarrel = read("src/ai/aiMockEngine.ts");
assert.doesNotMatch(aiBarrel, /function\s+askCrmAi|function\s+generateGlobalInsights|const\s+makeId/);
for (const modulePath of ["./askCrmAi", "./aiMessageDrafts", "./aiInsights"]) {
  assert.ok(aiBarrel.includes(modulePath), `AI barrel must export ${modulePath}.`);
}

assert.ok(inventory.largeFiles.length <= 44, `Large-file count regressed beyond the reviewed 44-file baseline: ${inventory.largeFiles.length}.`);
assert.equal(inventory.circularDependencies.length, 0, "Responsibility cleanup must not introduce cycles.");
console.log(`Large-file responsibility PASS: ${inventory.largeFiles.length} large files, 0 cycles.`);
