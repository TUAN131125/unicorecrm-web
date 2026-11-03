import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import type { Deal } from "@/modules/deals/domain/model/deal.types";
import type { DealDetailController } from "@/modules/deals/presentation/views/dealDetailView.types";
import { dealPipelinePresentation, dealStageChoices, dealWeightedForecast, dealReturnTarget, dealCloseDateOverdue } from "@/modules/deals/presentation/views/dealDetailPresentation";
import { DEFAULT_DEAL_STAGES } from "@/modules/deals/domain/rules/dealStages";

const fixture: Deal = { id: "deal-workspace-proof", resourceVersion: 3, name: "CRM cho chuỗi cửa hàng Minh Phúc", buyerRef: { type: "CONTACT", id: "c1" }, stage: "QUALIFIED", amount: 200000000,
  amountDecimal: "200000000", currency: "VND", opportunityScore: 0, ownerId: "u1", expectedCloseDate: "2026-12-20", interestedProducts: [], lineItems: [], createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-23T00:00:00Z" };
assert.equal(dealWeightedForecast(fixture)?.amount, "0", "A zero score is not replaced by 50%.");
assert.equal(dealWeightedForecast({ ...fixture, currency: "USD", amountDecimal: "999999999999999999.99", opportunityScore: 65 })?.amount, "649999999999999999.9935");
assert.equal(dealWeightedForecast({ ...fixture, currency: undefined }), undefined);
const clock = new Date("2026-10-23T18:00:00Z");
assert.equal(dealCloseDateOverdue("2026-10-24", "Asia/Ho_Chi_Minh", clock), false);
assert.equal(dealCloseDateOverdue("2026-10-23", "Asia/Ho_Chi_Minh", clock), true);
assert.equal(dealCloseDateOverdue("2026-10-23", "America/Los_Angeles", clock), false);
const inactive = DEFAULT_DEAL_STAGES.map(stage => ({ ...stage, isActive: stage.code !== "QUALIFIED" }));
const pipeline = dealPipelinePresentation(fixture, inactive);
assert.equal(pipeline.stages.find(stage => stage.current)?.isActive, false);
assert.equal(pipeline.stages.some(stage => stage.visited), false, "Ordering is not visited-stage evidence.");
const custom = { ...DEFAULT_DEAL_STAGES[0], id: "custom", code: "CUSTOM_REVIEW", labelVi: "Đánh giá", labelEn: "Review", order: 25, isSystem: false };
assert.ok(dealStageChoices(fixture, [...DEFAULT_DEAL_STAGES, custom], false).some(stage => stage.code === custom.code));
assert.ok(dealStageChoices(fixture, [...DEFAULT_DEAL_STAGES, custom], true).some(stage => stage.code === custom.code), "Connected choices use authoritative custom stages.");
assert.ok(!dealStageChoices(fixture, DEFAULT_DEAL_STAGES, true).some(stage => stage.category !== "open"));
assert.deepEqual(dealStageChoices({ ...fixture, stage: "LOST" }, DEFAULT_DEAL_STAGES, true), []);
assert.equal(dealReturnTarget("/deals?view=table&search=crm", "demo"), "/deals?view=table&search=crm");
for (const unsafe of ["https://example.com", "//example.com", "/w/foreign/crm/deals?view=table", "/deals/another"]) assert.equal(dealReturnTarget(unsafe, "demo"), "/deals");

const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost", pretendToBeVisual: true });
for (const key of ["window", "document", "navigator", "localStorage", "HTMLElement", "SVGElement", "Element", "Node", "Event", "CustomEvent", "EventTarget", "MutationObserver"] as const)
  Object.defineProperty(globalThis, key, { value: key === "window" ? dom.window : dom.window[key], configurable: true });
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { value: true, configurable: true });
Object.defineProperty(dom.window, "matchMedia", { value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) });
const React = await import("react"), { act } = React;
const { createRoot } = await import("react-dom/client");
const { MemoryRouter, Routes, Route } = await import("react-router-dom");
const { I18nProvider } = await import("@/i18n");
const { signIn } = await import("@/platform/identity-auth");
assert.equal(signIn({ email: "admin@unicorecrm.local", password: "admin123" }).ok, true);
const { initializeApplicationComposition } = await import("@/app/composition");
await initializeApplicationComposition({ mode: "demo" });
const { loadAccessGovernance, EffectiveRecordAccessBoundary } = await import("@/platform/access-control");
const { getWorkspaceContextSnapshot } = await import("@/platform/workspace-context");
await loadAccessGovernance(getWorkspaceContextSnapshot().workspaceId);
const { configureEffectiveRecordAccessAuthority } = await import("@/platform/access-control/application/effectiveRecordAccessBinding");
let readOnly = false;
let closeOnly = false;
configureEffectiveRecordAccessAuthority({ source: "backend", async evaluate(request) { return { workspaceId: request.workspaceId, resourceKey: request.resourceKey, recordId: request.recordId,
  canRead: true, canUpdate: !readOnly && !closeOnly, canDelete: false, canExport: false, canApprove: false, authority: "backend", evaluatedAt: new Date().toISOString(), decisionReasons: [],
  allowedCommands: closeOnly ? ["deal.close-lost"] : ["deal.move-stage", "deal.close-won", "deal.close-lost", "deal.update"],
  fieldAccess: Object.fromEntries([...(request.requestedFields ?? []).map(field => [field, readOnly ? "READ_ONLY" : "READ_WRITE"]), ["notes", "HIDDEN"], ["buyerRef", "MASKED"]]) }; } });
const { getDealApplicationServices, configureDealApplication } = await import("@/modules/deals/application/composition/dealApplicationServices");
const { replaceDeals } = await import("@/modules/deals/public/deals");
replaceDeals([fixture]);
const original = getDealApplicationServices();
const calls: { stage: string; key: string; version: number }[] = [];
let rejectPending: ((error: unknown) => void) | undefined;
let attempt = 0;
configureDealApplication({ ...original, pipelines: {
  async list() { return original.stages.listPipelines().map(pipeline => ({ ...pipeline, workspaceId: getWorkspaceContextSnapshot().workspaceId })); },
  async save() { throw new Error("PIPELINE_SAVE_NOT_EXPECTED"); },
}, api: { ...original.api, mode: "connected", commands: { ...original.api.commands,
  async changeDealStage(id, input, options) {
    calls.push({ stage: input.stageCode, key: options.idempotencyKey, version: options.expectedVersion });
    if (attempt++ === 0) await new Promise<void>((_resolve, reject) => { rejectPending = reject; });
    return original.api.commands.changeDealStage(id, input, options);
  },
  async markDealWon() { throw new Error("CONNECTED_WON_MUST_NOT_RUN_WITHOUT_VERIFICATION"); },
} } });
const { useDealDetailController } = await import("@/modules/deals/presentation/hooks/useDealDetailController");
const { DealDetailField } = await import("@/modules/deals/presentation/views/DealDetailField");
let current: DealDetailController | undefined;
function Probe() { const model = useDealDetailController({ customers: [], contacts: [], setCustomers() {} }); if (model) current = model;
  return React.createElement(React.Fragment, null,
    React.createElement(DealDetailField, { field: "notes", children: "SECRET_NOTE" }),
    React.createElement(DealDetailField, { field: "buyerRef", children: "SECRET_BUYER" })); }
const node = document.getElementById("root"); assert.ok(node); const root = createRoot(node);
const fields = ["name", "buyerRef", "notes", "stageCode", "stageCategory", "stageEnteredAt", "wonAt", "winEvidence", "actualCloseDate", "lostReason", "lostReasonNote", "lostAt", "recycleDecision", "revisitAt"];
const render = async () => {
  await act(async () => root.render(React.createElement(I18nProvider, null, React.createElement(MemoryRouter, { initialEntries: [`/deals/${fixture.id}`] },
    React.createElement(Routes, null, React.createElement(Route, { path: "/deals/:dealId", element: React.createElement(EffectiveRecordAccessBoundary, { key: `${readOnly}:${closeOnly}`, resourceKey: "deals", recordId: fixture.id, requestedFields: fields, children: React.createElement(Probe) }) }))))));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
};
try {
  await render();
  assert.ok(current); assert.doesNotMatch(node.textContent ?? "", /SECRET_NOTE|SECRET_BUYER/); assert.match(node.textContent ?? "", /••••/);
  assert.equal(current.canConfirmWon, false);
  await act(async () => current?.handleConfirmWon());
  await act(async () => current?.handleChangeStage("WON")); assert.equal(calls.length, 0);
  let pending: Promise<void> | undefined;
  await act(async () => { pending = current?.handleChangeStage("SOLUTION"); });
  assert.equal(current.interactionPending, true); assert.equal(current.deal.stage, "QUALIFIED");
  await act(async () => current?.handleChangeStage("SOLUTION")); assert.equal(calls.length, 1);
  const { ApplicationError } = await import("@/shared/domain");
  await act(async () => { rejectPending?.(new ApplicationError({ code: "RESOURCE_VERSION_CONFLICT", category: "CONFLICT", message: "Internal SQL diagnostic", status: 409 })); await pending; });
  assert.equal(current.deal.stage, "QUALIFIED"); assert.ok(current.stageError); assert.doesNotMatch(current.stageError, /Internal SQL/);
  await act(async () => current?.handleChangeStage("SOLUTION"));
  assert.equal(calls.length, 2); assert.equal(calls[0]?.key, calls[1]?.key); assert.equal(calls[0]?.version, 3);
  assert.equal(current.deal.stage, "SOLUTION"); assert.equal(current.deal.resourceVersion, 4); assert.equal(current.stageError, "");
  readOnly = true; await render();
  assert.equal(current.canChangeStage, false); assert.equal(current.canCloseLost, false);
  await act(async () => current?.handleChangeStage("PROPOSAL")); assert.equal(calls.length, 2);
  // Closing is a separate command capability; generic profile update permission is
  // not substituted for the Backend's explicit command + writable-field decision.
  readOnly = false; closeOnly = true; await render();
  assert.equal(current.recordAccess?.canUpdate, false);
  assert.equal(current.canChangeStage, false); assert.equal(current.canCloseLost, true);
  console.log("PASS presentation model, exact decimal/zero score, inactive/custom/terminal stages, safe Back, HIDDEN/MASKED DOM, pending duplicate protection, no optimistic stage success, conflict retry with same key/version and blocked Connected Won (test runtime only)");
} finally { await act(async () => root.unmount()); dom.window.close(); }
