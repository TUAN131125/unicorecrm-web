import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import { resolveGuidanceContext } from "../../../src/guidance/application/resolveGuidanceContext";
import { searchGuidance } from "../../../src/guidance/application/guidanceSearch";
import { findGuidanceTarget } from "../../../src/guidance/application/guidanceTarget";
import { guidanceProgressStorageKey, readGuidanceProgress, writeGuidanceProgress } from "../../../src/guidance/application/guidanceProgressStore";
import type { GuidanceProgress } from "../../../src/guidance/domain/guidance.types";
import { ROUTE_METADATA } from "../../../src/app/routes/routeMeta";
import { SCREEN_GUIDANCE } from "../../../src/guidance/application/guidanceRegistry";
import { STUDIO_SECTIONS } from "../../../src/workspaces/studio/navigation/studioSectionRegistry";

const allowAll = () => true;
const denyAll = () => false;

const dashboard = resolveGuidanceContext("/w/demo/crm/dashboard", allowAll);
assert.equal(dashboard?.guidance?.id, "crm.dashboard.overview");

const orderCreate = resolveGuidanceContext("/w/demo/crm/orders/new", allowAll);
assert.equal(orderCreate?.guidance?.id, "crm.orders.create", "static /orders/new must win over /orders/:orderId");

const peopleMembers = resolveGuidanceContext("/w/demo/people/members", allowAll);
assert.equal(peopleMembers?.guidance?.id, "people.members.access");
const peopleRoles = resolveGuidanceContext("/w/demo/people/roles", allowAll);
assert.equal(peopleRoles?.guidance?.id, "people.roles.access");
const peopleAudit = resolveGuidanceContext("/w/demo/people/audit", allowAll);
assert.equal(peopleAudit?.guidance?.id, "people.audit.access");

const denied = resolveGuidanceContext("/w/demo/crm/orders", denyAll);
assert.equal(denied?.guidance?.id, "crm.orders.list", "current-screen guidance must remain available while actions are capability-filtered");

const root = repositoryRoot;
const crmRouteSource = fs.readFileSync(path.join(root, "src", "app", "router", "workspaces", "crmWorkspaceRoutes.tsx"), "utf8");
const crmRouteKeys = [...new Set([...crmRouteSource.matchAll(/ROUTE_KEYS\.([A-Z0-9_]+)/g)].map((match) => match[1]))];
for (const routeKey of crmRouteKeys) {
  const meta = ROUTE_METADATA[routeKey];
  assert.ok(meta?.guidanceId, `CRM route ${routeKey} must declare guidance metadata`);
  const samplePath = meta.path.replace(/:[^/]+/g, "sample");
  const resolved = resolveGuidanceContext(`/w/demo/crm${samplePath}`, allowAll);
  assert.equal(resolved?.guidance?.id, meta.guidanceId, `CRM route ${routeKey} must resolve its guidance`);
}

for (const section of STUDIO_SECTIONS) {
  const samplePath = `/w/demo/studio/${section.routePath}`;
  const resolved = resolveGuidanceContext(samplePath, allowAll);
  assert.ok(resolved?.guidance, `Studio section ${section.id} must resolve guidance`);
}

assert.equal(SCREEN_GUIDANCE.length, 65, "the contextual guidance catalog must cover all 65 unique workspace screens");
assert.equal(SCREEN_GUIDANCE.filter((screen) => screen.productSpace === "crm").length, 51, "CRM guidance inventory must cover 51 screens");
assert.equal(SCREEN_GUIDANCE.filter((screen) => screen.productSpace === "studio").length, 11, "Studio guidance inventory must cover 11 screens");
assert.equal(SCREEN_GUIDANCE.filter((screen) => screen.productSpace === "people").length, 3, "People & Access guidance inventory must cover 3 screens");

for (const screen of SCREEN_GUIDANCE) {
  assert.ok(screen.steps?.length, `${screen.id} must provide a walkthrough`);
  assert.ok(screen.primaryTasks.length >= 2, `${screen.id} must provide useful primary tasks`);
  const requiredGeneratedSteps = [
    "guide-overview",
    "guide-prerequisites",
    ...screen.primaryTasks.map((task) => `guide-task-${task.id}`),
    "guide-completion",
    "guide-guardrails",
    "guide-context",
    "guide-help",
  ];
  for (const stepId of requiredGeneratedSteps) {
    assert.ok(screen.steps?.some((step) => step.id === stepId), `${screen.id} must include ${stepId}`);
  }
  assert.ok((screen.steps?.length ?? 0) >= screen.primaryTasks.length + 6, `${screen.id} walkthrough must be detailed enough for every declared task`);
}

const viResults = searchGuidance("tạo đơn hàng", "vi", "crm", allowAll);
assert.equal(viResults[0]?.kind, "screen");
assert.ok(viResults.some((result) => result.id === "crm.orders.create"));

const enResults = searchGuidance("shipping provider", "en", "studio", allowAll);
assert.ok(enResults.some((result) => result.id === "studio.integrations" || result.id === "field.shipping.provider"));

const dom = new JSDOM('<!doctype html><button data-guidance-id="orders.form.save">Save</button>', { url: "https://unicore.local" });
Object.defineProperty(globalThis, "window", { value: dom.window, configurable: true });
Object.defineProperty(globalThis, "document", { value: dom.window.document, configurable: true });

assert.ok(findGuidanceTarget(dom.window.document, "orders.form.save"));
assert.equal(findGuidanceTarget(dom.window.document, "orders.form.missing"), null, "missing targets must resolve safely");

const progress: GuidanceProgress = {
  schemaVersion: 1,
  completedWalkthroughs: { "crm.orders.list": { version: 2, completedAt: "2026-07-12T00:00:00.000Z" } },
  activeWalkthroughs: { "crm.orders.create": { version: 2, stepIndex: 2, updatedAt: "2026-07-12T00:00:00.000Z" } },
  completedChecklistItems: { "crm.checklist.sales": ["lead"] },
};
writeGuidanceProgress("workspace-a", "user-a", progress);
assert.deepEqual(readGuidanceProgress("workspace-a", "user-a"), progress);
assert.notEqual(guidanceProgressStorageKey("workspace-a", "user-a"), guidanceProgressStorageKey("workspace-b", "user-a"));
assert.deepEqual(readGuidanceProgress("workspace-b", "user-a").completedWalkthroughs, {}, "progress must remain workspace-scoped");

dom.window.localStorage.setItem(guidanceProgressStorageKey("workspace-a", "broken"), "not-json");
assert.deepEqual(readGuidanceProgress("workspace-a", "broken").activeWalkthroughs, {}, "corrupt progress must fail safely");

console.log(`Guidance runtime: OK (${SCREEN_GUIDANCE.length} unique guided screens: 51 CRM + ${STUDIO_SECTIONS.length} Studio + 3 People, complete generated walkthroughs, current-screen availability, capability-filtered search, bilingual search, target safety, workspace-scoped progress)`);
