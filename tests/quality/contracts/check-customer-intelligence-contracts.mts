import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import path from "node:path";
import { readPresentationComposition } from "../../../scripts/lib/presentationCompositionSource.mts";

const root = repositoryRoot;
const read = (relativePath: string) =>
  readPresentationComposition(path.join(root, relativePath), "utf8");

const assertIncludes = (source: string, marker: string, context: string) => {
  if (!source.includes(marker)) throw new Error(`${context}: missing ${marker}`);
};
const assertExcludes = (source: string, marker: string, context: string) => {
  if (source.includes(marker)) throw new Error(`${context}: forbidden ${marker}`);
};

const readModel = [
  read("src/modules/customers/presentation/model/customer360ReadModel.ts"),
  read("src/modules/customers/presentation/model/customer360ReadModel.types.ts"),
].join("\n");
const assessment = [
  read("src/modules/customers/presentation/model/customerOverviewAssessment.ts"),
  read("src/modules/customers/presentation/model/customerAssessment.types.ts"),
  read("src/modules/customers/presentation/model/customerAssessmentReturnSignals.ts"),
  read("src/modules/customers/presentation/model/customerAssessmentHelpers.ts"),
].join("\n");
const overview = read(
  "src/modules/customers/presentation/detail/CustomerOverviewTab.tsx",
);
const tabs = read(
  "src/modules/customers/presentation/detail/CustomerDetailTabs.tsx",
);
const sharedTabs = read("src/components/crm/relationship-detail/RelationshipDetailTabs.tsx");
const sharedWorkspace = read("src/components/crm/relationship-detail/RelationshipWorkspace.tsx");
const tabContent = read(
  "src/modules/customers/presentation/detail/CustomerDetailTabContent.tsx",
);
const aiContext = read(
  "src/workspaces/crm/ai-context/application/aiContextBuilder.ts",
);
const aiHook = read(
  "src/workspaces/crm/ai-context/presentation/useGlobalAiContext.ts",
);
const shell = read("src/app/shell/CrmApplicationShell.tsx");
const aiEngine = read("src/ai/aiMockEngine.ts");

for (const marker of [
  "returnIntents: ReturnResolutionIntent[]",
  "activeReturnCount",
  "returnAttentionCount",
  "overdueTaskCount",
  "supportRiskCount",
]) {
  assertIncludes(readModel, marker, "Customer 360 operational metrics");
}

for (const marker of [
  'category: "RETURN"',
  'id: "return-resolution-failed"',
  'id: "return-received-unresolved"',
  'id: "return-awaiting-decision"',
  'id: "return-awaiting-close"',
  'id: "return-awaiting-item"',
  "evidence: CustomerSignalEvidence[]",
  "recommendedAction?: CustomerRecommendedAction",
  "primaryAction?: CustomerRecommendedAction",
]) {
  assertIncludes(assessment, marker, "Explainable Customer intelligence");
}

for (const marker of [
  'data-customer-overview="ai-first"',
  'data-customer-ai-brief="canonical"',
  "AI tổng quan khách hàng",
  "Đề xuất hoạt động tiếp theo",
  "Nhận xét chính từ AI",
  "Rủi ro vận hành",
  "Thông tin khách hàng",
  "assessment.confidence",
  "primarySignal.evidence",
]) {
  assertIncludes(overview, marker, "Customer overview intelligence surface");
}
for (const marker of [
  "sm:grid-cols-2",
  "xl:grid-cols-4",
  "lg:grid-cols-3",
]) {
  assertIncludes(overview, marker, "Customer overview responsive layout");
}

for (const removedOverviewDuplicate of [
  "Hoạt động gần đây",
  "Recent activity",
  "RecentChangeRow",
]) {
  assertExcludes(overview, removedOverviewDuplicate, "Customer overview must not duplicate the right-side interaction timeline");
}

for (const heavyWeight of ["font-black", "font-extrabold"]) {
  assertExcludes(overview, heavyWeight, "Customer overview restrained typography");
}
assertExcludes(overview, "RelationshipIntelligenceHero", "Customer overview must own its AI-first reading order instead of using the generic report hero");
for (const removedDuplicate of [
  "Ưu tiên quan hệ",
  "Thương mại gần đây",
  "Mua hàng và hành động tiếp theo",
]) {
  assertExcludes(overview, removedDuplicate, "Customer overview duplicate removal");
}

assertIncludes(sharedTabs, '| "transactions"', "Shared relationship transactions workspace");
assertExcludes(sharedTabs, '| "returns"', "Returns must not return as a duplicate top-level tab");
assertIncludes(tabContent, 'workspaceKey="transactions"', "Customer transactions workspace routing");
assertIncludes(tabContent, 'id: "returns"', "Customer returns nested navigation");
assertIncludes(tabContent, "const ReturnsTab", "Customer returns tab content");
assertIncludes(tabContent, "returnAttentionCount", "Customer returns attention KPI");
for (const removedTopLevel of ["opportunities", "quotations", "orders", "payments", "purchaseHistory", "purchasedProducts", "care", "support", "activeTasks", "more"]) {
  assertExcludes(sharedTabs, `| "${removedTopLevel}"`, `Duplicate relationship top-level tab ${removedTopLevel}`);
}
for (const marker of ["CustomerWorkspace", 'workspaceKey="sales"']) {
  assertIncludes(tabContent, marker, "Customer grouped workspace routing");
}
assertIncludes(sharedWorkspace, 'layoutId={`${workspaceKey}-relationship-subtab`}', "Shared relationship workspace motion");
assertIncludes(tabs, "RelationshipDetailTabs", "Customer must use the shared relationship-detail tab rail");
assertExcludes(tabContent, "AnimatePresence", "Customer grouped workspaces must keep one tab-indicator animation without a competing content transition");

for (const marker of [
  "buildCustomer360ReadModel(customer)",
  "buildCustomerRelationshipAssessment(readModel)",
  "returnIntents: readModel.returnIntents",
]) {
  assertIncludes(aiContext, marker, "AI unified Customer context");
}
assertExcludes(
  aiContext,
  "relationshipRefKey(customer.relationshipRef)",
  "AI must not rebuild Customer relationships independently",
);

for (const marker of [
  'pattern: /^\\/customers\\/([^/]+)$/',
  "return buildCustomerAiContext(focus.id, state)",
]) {
  assertIncludes(aiHook, marker, "Route-aware Customer AI");
}
assertIncludes(shell, "useGlobalAiContext(pathname)", "Shell passes current route to AI");

for (const marker of [
  "answerFocusedCustomerQuestion",
  "buildFocusedCustomerReturnAnswer",
  "buildFocusedCustomerEvidenceAnswer",
  "generateCustomerInsights",
]) {
  assertIncludes(aiEngine, marker, "Focused Customer AI behavior");
}
for (const hallucination of [
  ".lifetimeValue",
  "healthy usage frequency",
  "thời cơ vàng",
  "up-sell score",
  "Sản phẩm sở hữu vận hành trơn tru",
]) {
  assertExcludes(aiEngine, hallucination, "Customer AI evidence discipline");
}

console.log("Customer intelligence contracts: PASS");
