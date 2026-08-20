import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ALL_CAPABILITIES } from "@/platform/access-control";
import { getCustomersSnapshot } from "@/modules/customers";
import { getDealsSnapshot } from "@/modules/deals";
import { getLeadsSnapshot } from "@/modules/leads";
import { getOrderListSnapshot } from "@/modules/orders";
import { getQuotesSnapshot } from "@/modules/quotes";
import { getSupportCasesSnapshot } from "@/modules/support";
import { buildCohortFunnel, buildCrmMetric, CRM_METRIC_CATALOG, CRM_METRIC_IDS, type CrmMetricId } from "@/workspaces/crm/metrics";

const root = repositoryRoot;
const definitions = Object.values(CRM_METRIC_CATALOG);
assert.equal(new Set(definitions.map((item) => item.id)).size, definitions.length, "Metric IDs must be unique.");
assert.ok(definitions.length >= 8, "Mốc 3 requires a usable metric catalog.");
for (const definition of definitions) {
  assert.ok(definition.title.vi && definition.title.en, `${definition.id} must have bilingual title.`);
  assert.ok(definition.description.vi && definition.description.en, `${definition.id} must have bilingual description.`);
  assert.ok(definition.formula.vi && definition.formula.en, `${definition.id} must have bilingual formula.`);
  assert.ok(definition.dateField.vi && definition.dateField.en, `${definition.id} must identify its business date field.`);
  assert.ok(definition.sourceModules.length > 0, `${definition.id} must declare source modules.`);
  assert.ok(definition.includedStates.length > 0, `${definition.id} must declare included states.`);
  assert.ok(definition.requiredCapabilities.every((capability) => ALL_CAPABILITIES.includes(capability)), `${definition.id} references an unknown capability.`);
  assert.ok(definition.owner && definition.version >= 1, `${definition.id} must be owned and versioned.`);
}

const dataset = {
  leads: getLeadsSnapshot(),
  deals: getDealsSnapshot(),
  quotes: getQuotesSnapshot(),
  orders: getOrderListSnapshot(),
  customers: getCustomersSnapshot(),
  cases: getSupportCasesSnapshot(),
};
const now = new Date("2026-05-31T12:00:00.000Z");
const timezone = "Asia/Ho_Chi_Minh";
for (const metricId of Object.keys(CRM_METRIC_CATALOG) as CrmMetricId[]) {
  const metric = buildCrmMetric({ ...dataset, metricId, periodKey: "current_month", timezone, now });
  assert.equal(metric.definition.id, metricId);
  assert.equal(metric.timezone, timezone);
  assert.ok(Number.isFinite(metric.value) && metric.value >= 0, `${metricId} must return a finite non-negative value.`);
  assert.ok(metric.records.every((record) => record.id && record.route && record.module), `${metricId} source rows must be navigable.`);
  if (metric.definition.periodMode === "SNAPSHOT") assert.equal(metric.period.key, "all_time", `${metricId} snapshot metrics must not pretend to be period cohorts.`);
}

const revenue = buildCrmMetric({ ...dataset, metricId: CRM_METRIC_IDS.MONTHLY_COMPLETED_REVENUE, periodKey: "current_month", timezone, now });
assert.ok(revenue.value > 0, "May fixture must have completed-order revenue.");
assert.equal(revenue.comparison?.status, "UNAVAILABLE", "Growth must be unavailable when the previous period denominator is zero.");
assert.equal(revenue.comparison?.deltaPercent, undefined, "The system must not display a fabricated growth percentage.");
assert.ok(revenue.records.every((record) => record.status === "COMPLETED"), "Completed revenue drill-down must contain only completed orders.");

const customRevenue = buildCrmMetric({ ...dataset, metricId: CRM_METRIC_IDS.MONTHLY_COMPLETED_REVENUE, periodKey: "custom", timezone, startDate: "2026-05-01", endDate: "2026-05-31", now });
assert.equal(customRevenue.period.key, "custom", "Custom reports must retain their explicit period identity.");
assert.equal(customRevenue.value, revenue.value, "An equivalent custom range must reconcile with the catalog month period.");

const qualification = buildCrmMetric({ ...dataset, metricId: CRM_METRIC_IDS.LEAD_QUALIFICATION_RATE, periodKey: "all_time", timezone, now });
assert.equal(qualification.denominator, dataset.leads.length, "All-time Lead rate denominator must reconcile to source Lead count.");
assert.equal(qualification.value, qualification.denominator ? Math.round(((qualification.numerator ?? 0) / qualification.denominator) * 100) : 0);

const funnel = buildCohortFunnel({ ...dataset, periodKey: "all_time", timezone, now });
assert.equal(funnel.mode, "COHORT");
assert.equal(funnel.stages[0].count, dataset.leads.length, "All-time cohort starts with all source Leads.");
const stageById = new Map(funnel.stages.map((stage) => [stage.id, stage]));
for (const stage of funnel.stages) {
  assert.ok(stage.count <= dataset.leads.length, `${stage.id} must count unique cohort Leads, not unrelated records.`);
  assert.ok(stage.percentageOfCohort <= 100, `${stage.id} cohort percentage must not exceed 100%.`);
}
for (const stageId of ["deals", "quotes", "orders"] as const) {
  assert.ok(stageById.get(stageId)?.sourceRecordIds.every(Boolean), `${stageId} cohort stage must retain source record IDs.`);
}

const reportsSource = fs.readFileSync(path.join(root, "src/workspaces/crm/presentation/pages/ReportsPage.tsx"), "utf8");
const dashboardSource = fs.readFileSync(path.join(root, "src/workspaces/crm/presentation/pages/DashboardPage.tsx"), "utf8");
assert.match(reportsSource, /buildCohortFunnel/, "Reports must use a traceable cohort funnel.");
assert.doesNotMatch(reportsSource, /calculateFunnelMetrics\(/, "Reports must not render independent totals as a funnel.");
assert.match(reportsSource, /reports\.period\.selector/, "Reports must expose a period selector.");
assert.match(reportsSource, /value="custom"/, "Reports must support a user-selected date range.");
assert.match(reportsSource, /<Input label=\{isVi \? "Từ ngày"/, "Reports custom ranges must reuse the canonical styled temporal input.");
assert.doesNotMatch(reportsSource, /<input type="date"/, "Reports must not fall back to the browser-native date picker.");
assert.match(reportsSource, /ReportAnalysisTable/, "Reports must expose grouping, search and sorting over report results.");
assert.match(reportsSource, /MetricDrilldownDrawer/, "Reports must expose metric formula and source records.");
assert.match(dashboardSource, /buildCrmMetric/, "Dashboard and Reports must share the metric engine.");
assert.match(dashboardSource, /title="Dashboard"/, "The CRM landing page must use the Dashboard product name.");
assert.doesNotMatch(dashboardSource, /mrrSub/, "Dashboard must not show a hard-coded growth percentage.");
assert.match(dashboardSource, /returnTo=dashboard/, "Dashboard drill-down must preserve a return path.");
assert.match(dashboardSource, /data-dashboard-kpi-layout="snapshot-ribbon"/, "Dashboard KPIs must use the operational snapshot ribbon.");
assert.doesNotMatch(dashboardSource, /<(?:AreaChart|BarChart|PieChart)[\s>]|from "recharts"/, "Dashboard must not duplicate report visualization charts.");
assert.doesNotMatch(dashboardSource, /bg-slate-950|from-slate-950|to-violet-950/, "Dashboard overview must not use a black hero background.");

console.log(`Metric catalog contracts: PASS — ${definitions.length} definitions, ${funnel.stages.length} cohort stages, revenue sources=${revenue.records.length}.`);
