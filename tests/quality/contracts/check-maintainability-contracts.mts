import assert from "node:assert/strict";
import fs from "node:fs";

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
assert.ok(packageJson.devDependencies?.["@types/react"], "@types/react must stay in devDependencies");
assert.ok(packageJson.devDependencies?.["@types/react-dom"], "@types/react-dom must stay in devDependencies");

const pageLineBudgets: Record<string, number> = {
  "src/modules/contacts/presentation/pages/ContactDetailPage.tsx": 1600,
  "src/modules/orders/presentation/pages/OrderListPage.tsx": 1500,
  "src/modules/leads/presentation/pages/LeadDetailPage.tsx": 1450,
  "src/modules/customers/presentation/pages/Customer360Page.tsx": 900,
  "src/modules/customers/presentation/detail/CustomerDetailSections.tsx": 20,
  "src/modules/customers/presentation/detail/CustomerRelationshipSections.tsx": 240,
  "src/modules/customers/presentation/detail/CustomerCommercialSections.tsx": 480,
  "src/modules/customers/presentation/detail/CustomerOperationsSections.tsx": 400,
  "src/modules/customers/presentation/detail/CustomerDetailSectionPrimitives.tsx": 300,
  "src/modules/customers/presentation/model/customerOverviewAssessment.ts": 500,
  "src/modules/customers/presentation/model/customerAssessment.types.ts": 100,
  "src/modules/customers/presentation/model/customerAssessmentReturnSignals.ts": 220,
  "src/modules/customers/presentation/model/customerAssessmentHelpers.ts": 180,
  "src/modules/customers/presentation/model/customer360ReadModel.ts": 500,
  "src/modules/customers/presentation/model/customer360ReadModel.types.ts": 140,
  "src/modules/deals/presentation/views/DealDetailView.tsx": 80,
  "src/modules/deals/presentation/views/DealDetailHeaderSection.tsx": 260,
  "src/modules/deals/presentation/views/DealDetailCommercialWorkspace.tsx": 30,
  "src/modules/deals/presentation/views/DealDetailPipelineWorkspace.tsx": 400,
  "src/modules/deals/presentation/views/DealDetailQuoteWorkspace.tsx": 300,
  "src/modules/deals/presentation/views/DealDetailActivityTimeline.tsx": 300,
  "src/modules/deals/presentation/views/DealDetailSidebar.tsx": 30,
  "src/modules/deals/presentation/views/DealDetailSidebarActions.tsx": 380,
  "src/modules/deals/presentation/views/DealDetailRelatedRecords.tsx": 300,
  "src/modules/deals/presentation/views/DealDetailDialogs.tsx": 360,
  "src/ai/aiMockEngine.ts": 30,
  "src/ai/askCrmAi.ts": 480,
  "src/ai/focusedCustomerAi.ts": 300,
  "src/ai/aiInsights.ts": 480,
  "src/ai/aiMessageDrafts.ts": 80,
  "src/ai/aiMockEngine.shared.ts": 80,
};

for (const [file, maxLines] of Object.entries(pageLineBudgets)) {
  const lineCount = fs.readFileSync(file, "utf8").split(/\r?\n/).length;
  assert.ok(lineCount <= maxLines, `${file} must stay at or below ${maxLines} lines; received ${lineCount}`);
}

console.log("Maintainability contracts: OK");
