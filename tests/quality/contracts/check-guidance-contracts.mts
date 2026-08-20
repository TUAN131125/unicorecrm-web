import { walkAllFiles } from "../../../scripts/quality/core/filesystem.mjs";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { ROUTE_METADATA } from "../../../src/app/routes/routeMeta";
import { ROUTE_KEYS } from "../../../src/platform/navigation/routeKeys";
import { STUDIO_SECTIONS } from "../../../src/workspaces/studio/navigation/studioSectionRegistry";
import { ALL_CAPABILITIES } from "../../../src/platform/access-control/domain/capabilityCatalog";
import {
  CHECKLISTS,
  GUIDANCE_FIELDS,
  GUIDANCE_WORKFLOWS,
  SCREEN_GUIDANCE,
  SCREEN_GUIDANCE_BY_ID,
  WORKFLOW_GUIDANCE_BY_ID,
} from "../../../src/guidance/application/guidanceRegistry";
import { validateGuidanceRegistry } from "../../../src/guidance/domain/guidance.validation";
import type { GuidanceLocaleText } from "../../../src/guidance/domain/guidance.types";

const root = repositoryRoot;
const srcRoot = path.join(root, "src");
const errors: string[] = [];
const sourceFiles = walkAllFiles(srcRoot).filter((file) => /\.(ts|tsx)$/.test(file));
const targetLiterals = new Set<string>();
const targetPatterns: RegExp[] = [];
const fieldHelpKeys = new Set<string>();

for (const file of sourceFiles) {
  const source = fs.readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  visit(sourceFile);

  function visit(node: ts.Node): void {
    if (ts.isJsxAttribute(node) && node.name.getText(sourceFile) === "data-guidance-id" && node.initializer) {
      if (ts.isStringLiteral(node.initializer)) targetLiterals.add(node.initializer.text);
      if (ts.isJsxExpression(node.initializer) && node.initializer.expression && ts.isTemplateExpression(node.initializer.expression)) {
        const prefix = escapeRegex(node.initializer.expression.head.text);
        const suffix = escapeRegex(node.initializer.expression.templateSpans.at(-1)?.literal.text || "");
        targetPatterns.push(new RegExp(`^${prefix}.+${suffix}$`));
      }
    }
    if (ts.isJsxAttribute(node) && node.name.getText(sourceFile) === "helpKey" && node.initializer && ts.isStringLiteral(node.initializer)) {
      fieldHelpKeys.add(node.initializer.text);
    }
    ts.forEachChild(node, visit);
  }
}

errors.push(...validateGuidanceRegistry({ screens: SCREEN_GUIDANCE, workflows: GUIDANCE_WORKFLOWS, fields: GUIDANCE_FIELDS, checklists: CHECKLISTS }));

const routeKeys = new Set(Object.keys(ROUTE_METADATA));
const allRouteKeys = new Set(Object.keys(ROUTE_KEYS));
const nonContextualRouteKeys = [...allRouteKeys].filter((routeKey) => !routeKeys.has(routeKey));
const expectedNonContextualRouteKeys = new Set([
  "LOGIN",
  "MFA_VERIFICATION",
  "FORGOT_PASSWORD",
  "REGISTER",
  "VERIFY_EMAIL",
  "RESET_PASSWORD",
  "INVITATION_ACCEPTANCE",
  "WORKSPACE_SELECTION",
  "SESSION_EXPIRED",
  "ACCESS_DENIED",
  "ACCOUNT_SUSPENDED",
]);
const routeGuidanceIds = new Set(Object.values(ROUTE_METADATA).map((meta) => meta.guidanceId));
const routeAliasCount = routeKeys.size - routeGuidanceIds.size;
const screenCountByProduct = SCREEN_GUIDANCE.reduce<Record<string, number>>((counts, screen) => {
  counts[screen.productSpace] = (counts[screen.productSpace] ?? 0) + 1;
  return counts;
}, {});
const crmRouterSource = fs.readFileSync(path.join(root, "src", "app", "router", "workspaces", "crmWorkspaceRoutes.tsx"), "utf8");
const crmRouteKeys = new Set([...crmRouterSource.matchAll(/ROUTE_KEYS\.([A-Z0-9_]+)/g)].map((match) => match[1]));
const capabilityCatalog = new Set<string>(ALL_CAPABILITIES);
const referencedTargets = new Set<string>();
const referencedCapabilities = new Set<string>();

for (const [routeKey, meta] of Object.entries(ROUTE_METADATA)) {
  if (!meta.guidanceId) errors.push(`Route ${routeKey} must declare guidanceId`);
  else if (!SCREEN_GUIDANCE_BY_ID.has(meta.guidanceId)) errors.push(`Route ${routeKey} references missing guidanceId ${meta.guidanceId}`);
}

if (nonContextualRouteKeys.length !== expectedNonContextualRouteKeys.size) {
  errors.push(`Expected ${expectedNonContextualRouteKeys.size} non-contextual access/system routes but found ${nonContextualRouteKeys.length}`);
}
for (const routeKey of nonContextualRouteKeys) {
  if (!expectedNonContextualRouteKeys.has(routeKey)) errors.push(`Route ${routeKey} is outside contextual guidance without an explicit access/system classification`);
}
for (const routeKey of expectedNonContextualRouteKeys) {
  if (!nonContextualRouteKeys.includes(routeKey)) errors.push(`Expected access/system route ${routeKey} is missing from the non-contextual route inventory`);
}

if (SCREEN_GUIDANCE.length !== routeGuidanceIds.size) {
  errors.push(`Guidance must cover every unique routed screen exactly once: ${SCREEN_GUIDANCE.length} guidance entries for ${routeGuidanceIds.size} routed screens`);
}
for (const guidanceId of routeGuidanceIds) {
  if (!SCREEN_GUIDANCE_BY_ID.has(guidanceId)) errors.push(`Routed screen ${guidanceId} is missing from the guidance catalog`);
}
for (const screen of SCREEN_GUIDANCE) {
  if (!routeGuidanceIds.has(screen.id)) errors.push(`${screen.id} is orphan guidance without an active routed screen`);
}

for (const routeKey of crmRouteKeys) {
  if (!ROUTE_METADATA[routeKey]?.guidanceId) errors.push(`CRM route ${routeKey} is missing route metadata guidance`);
}

for (const section of STUDIO_SECTIONS) {
  const pathValue = `/${section.routePath}`;
  const linked = Object.entries(ROUTE_METADATA).find(([, meta]) => meta.path === pathValue && Boolean(meta.guidanceId));
  if (!linked) errors.push(`Studio section ${section.id} (${pathValue}) is missing guidance metadata`);
}

for (const guidanceId of ["people.members.access", "people.roles.access", "people.audit.access"]) {
  if (!SCREEN_GUIDANCE_BY_ID.has(guidanceId)) errors.push(`People & Access route is missing ${guidanceId}`);
}

for (const screen of SCREEN_GUIDANCE) {
  if (!routeKeys.has(screen.routeKey)) errors.push(`${screen.id} references unknown routeKey ${screen.routeKey}`);
  const linkedMeta = ROUTE_METADATA[screen.routeKey];
  if (screen.productSpace !== "people" && linkedMeta?.guidanceId !== screen.id) {
    errors.push(`${screen.id} is not linked from ROUTE_METADATA.${screen.routeKey}`);
  }
  if (screen.primaryTasks.length < 2) errors.push(`${screen.id} must provide at least two primary tasks`);
  if (!screen.steps?.length) errors.push(`${screen.id} must provide a walkthrough`);
  if (!screen.prerequisites?.length) errors.push(`${screen.id} must explain prerequisites`);
  if (!screen.commonMistakes?.length) errors.push(`${screen.id} must explain common mistakes`);
  const requiredWalkthroughIds = [
    "guide-overview",
    "guide-prerequisites",
    ...screen.primaryTasks.map((task) => `guide-task-${task.id}`),
    "guide-completion",
    "guide-guardrails",
    "guide-context",
    "guide-help",
  ];
  for (const stepId of requiredWalkthroughIds) {
    if (!screen.steps?.some((step) => step.id === stepId)) errors.push(`${screen.id} is missing detailed walkthrough step ${stepId}`);
  }
  if ((screen.steps?.length ?? 0) < screen.primaryTasks.length + 6) {
    errors.push(`${screen.id} walkthrough is too shallow for its primary tasks`);
  }
  collectCapabilities(screen.requiredCapabilities);
  for (const task of screen.primaryTasks) collectCapabilities(task.requiredCapabilities);
  for (const workflowId of screen.relatedWorkflowIds || []) {
    if (!WORKFLOW_GUIDANCE_BY_ID.has(workflowId)) errors.push(`${screen.id} references unknown workflow ${workflowId}`);
  }
  for (const step of screen.steps || []) {
    referencedTargets.add(step.targetId);
    collectCapabilities(step.requiredCapabilities);
    if (!targetLiterals.has(step.targetId) && !targetPatterns.some((pattern) => pattern.test(step.targetId))) {
      errors.push(`${screen.id}.${step.id} target ${step.targetId} was not found as data-guidance-id in source`);
    }
  }
  scanUserText(screen.id, [screen.title, screen.purpose, screen.audience, screen.keywords, ...(screen.prerequisites || []), ...(screen.commonMistakes || []), ...screen.primaryTasks.map((task) => task.text), ...(screen.steps || []).flatMap((step) => [step.title, step.body])]);
}

for (const workflow of GUIDANCE_WORKFLOWS) {
  scanUserText(workflow.id, [workflow.title, workflow.summary, workflow.keywords, ...workflow.steps.flatMap((step) => [step.title, step.body, ...(step.requiredData || [])])]);
  for (const step of workflow.steps) collectCapabilities(step.requiredCapabilities);
}

for (const checklist of CHECKLISTS) {
  collectCapabilities(checklist.requiredAnyCapabilities);
  scanUserText(checklist.id, [checklist.title, checklist.description, ...checklist.items.flatMap((item) => [item.title, item.description])]);
  for (const item of checklist.items) collectCapabilities(item.requiredCapabilities);
}

for (const field of GUIDANCE_FIELDS) {
  scanUserText(field.helpKey, [field.title, field.purpose, field.example, field.impact, field.requiredWhen, field.keywords]);
}

for (const key of fieldHelpKeys) {
  if (!GUIDANCE_FIELDS.some((field) => field.helpKey === key)) errors.push(`FieldHelp references unknown helpKey ${key}`);
}

for (const capability of referencedCapabilities) {
  if (!capabilityCatalog.has(capability)) errors.push(`Guidance references unknown capability ${capability}`);
}

if (!targetLiterals.has("shell.help.open")) errors.push("TopBar guidance entry point shell.help.open is missing");
if (!targetLiterals.has("shell.route-content")) errors.push("Universal walkthrough target shell.route-content is missing");
const guidancePanelSource = fs.readFileSync(path.join(root, "src", "guidance", "presentation", "GuidancePanel.tsx"), "utf8");
if (!guidancePanelSource.includes("Xem lại hướng dẫn thao tác")) errors.push("GuidancePanel must expose the replay walkthrough action on every guided screen");
const guidanceDocPath = path.join(root, "docs", "product", "guidance-system.md");
const guidanceInventoryPath = path.join(root, "docs", "product", "guidance-screen-inventory.md");
if (!fs.existsSync(guidanceDocPath)) errors.push("docs/product/guidance-system.md is missing");
else {
  const guidanceDoc = fs.readFileSync(guidanceDocPath, "utf8");
  const documentedCoverage = [
    `${allRouteKeys.size} total route definitions`,
    `${nonContextualRouteKeys.length} access/system routes`,
    `${routeKeys.size} canonical route entries`,
    `${routeGuidanceIds.size} guided screens`,
    `${screenCountByProduct.crm ?? 0} CRM screens`,
    `${screenCountByProduct.studio ?? 0} Studio screens`,
    `${screenCountByProduct.people ?? 0} People & Access screens`,
    `${routeAliasCount} compatibility route aliases`,
  ];
  for (const coverageText of documentedCoverage) {
    if (!guidanceDoc.includes(coverageText)) errors.push(`docs/product/guidance-system.md is missing current coverage text: ${coverageText}`);
  }
  if (!guidanceDoc.includes("guidance-screen-inventory.md")) errors.push("docs/product/guidance-system.md must link to the complete screen inventory");
}
if (!fs.existsSync(guidanceInventoryPath)) errors.push("docs/product/guidance-screen-inventory.md is missing");
else {
  const guidanceInventory = fs.readFileSync(guidanceInventoryPath, "utf8");
  for (const screen of SCREEN_GUIDANCE) {
    if (!guidanceInventory.includes(`\`${screen.id}\``)) errors.push(`guidance-screen-inventory.md is missing ${screen.id}`);
  }
  for (const coverageText of [
    `**${routeKeys.size}**`,
    `**${SCREEN_GUIDANCE.length}**`,
    `${screenCountByProduct.crm ?? 0} screens`,
    `${screenCountByProduct.studio ?? 0} screens`,
    `${screenCountByProduct.people ?? 0} screens`,
  ]) {
    if (!guidanceInventory.includes(coverageText)) errors.push(`guidance-screen-inventory.md is missing current coverage text: ${coverageText}`);
  }
}
if (!fs.readFileSync(path.join(root, "AGENTS.md"), "utf8").includes("quality.guidance-contracts")) errors.push("AGENTS.md does not include the guidance maintenance gate");

if (errors.length > 0) {
  console.error("\nGuidance contract violations:\n");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Guidance contracts: OK (${allRouteKeys.size} total routes: ${nonContextualRouteKeys.length} access/system + ${routeKeys.size} contextual entries, ${SCREEN_GUIDANCE.length} guided screens: ${screenCountByProduct.crm ?? 0} CRM + ${screenCountByProduct.studio ?? 0} Studio + ${screenCountByProduct.people ?? 0} People, ${routeAliasCount} aliases, ${GUIDANCE_WORKFLOWS.length} workflows, ${GUIDANCE_FIELDS.length} fields, ${CHECKLISTS.length} checklists, ${referencedTargets.size} walkthrough targets)`);

function collectCapabilities(values: readonly string[] | undefined): void {
  values?.forEach((value) => referencedCapabilities.add(value));
}

function scanUserText(owner: string, values: Array<GuidanceLocaleText | undefined>): void {
  const forbidden = /\b(dto|payload|entity|internal)\b/i;
  for (const value of values) {
    if (!value) continue;
    for (const locale of ["vi", "en"] as const) {
      if (forbidden.test(value[locale])) errors.push(`${owner}.${locale} contains forbidden developer language: ${value[locale]}`);
    }
  }
}


function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
