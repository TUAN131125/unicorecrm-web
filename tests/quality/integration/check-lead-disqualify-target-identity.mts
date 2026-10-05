import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import type { Lead } from "@/modules/leads";

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: "http://localhost", pretendToBeVisual: true });
const { window } = dom;
for (const key of ["window", "document", "navigator", "localStorage", "HTMLElement", "SVGElement", "Element", "Node", "Event", "CustomEvent", "EventTarget", "MutationObserver"] as const) {
  Object.defineProperty(globalThis, key, { value: key === "window" ? window : window[key], configurable: true });
}
Object.defineProperties(globalThis, {
  IS_REACT_ACT_ENVIRONMENT: { value: true, configurable: true },
  getComputedStyle: { value: window.getComputedStyle.bind(window), configurable: true },
  requestAnimationFrame: { value: window.requestAnimationFrame.bind(window), configurable: true },
  cancelAnimationFrame: { value: window.cancelAnimationFrame.bind(window), configurable: true },
  ResizeObserver: { value: class { observe() {} unobserve() {} disconnect() {} }, configurable: true },
});
Object.defineProperty(window, "matchMedia", { value: () => ({ matches: true, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }) });
const { signIn } = await import("@/platform/identity-auth");
assert.equal(signIn({ email: "admin@unicorecrm.local", password: "admin123" }).ok, true);
const { initializeApplicationComposition } = await import("@/app/composition");
await initializeApplicationComposition({ mode: "demo" });
const workspace = await import("@/platform/workspace-context");
const { loadAccessGovernance } = await import("@/platform/access-control");
await loadAccessGovernance(workspace.getWorkspaceContextSnapshot().workspaceId);
const React = await import("react");
const { act } = React;
const { createRoot } = await import("react-dom/client");
const { MemoryRouter, Routes, Route } = await import("react-router-dom");
const { I18nProvider } = await import("@/i18n");
const { PlatformStateProvider } = await import("@/app/providers");
const { GuidanceProvider } = await import("@/guidance/presentation/GuidanceProvider");
const { ApplicationError } = await import("@/shared/domain");
const { useLeadDetailController } = await import("@/modules/leads/presentation/hooks/useLeadDetailController");
const { LeadDetailView } = await import("@/modules/leads/presentation/views/LeadDetailView");
const leads = await import("@/modules/leads");
const { configureLeadApplication, getLeadApplicationServices } = await import("@/modules/leads/application/composition/leadApplicationServices");
let lead: Lead = { id: "disqualify-A", name: "Lead A", title: "", companyName: "Company", phone: "0901234567", email: "a@example.test", source: "WEB", score: 0, ownerId: "u1", leadWorkState: "NEW", interestedProducts: [], activities: [], activitiesAuthority: "NOT_INCLUDED", resourceVersion: 3, createdAt: "2026-07-01T00:00:00Z" };
leads.saveLeadSnapshot(lead);
const leadServices = getLeadApplicationServices();
const commands: { id: string; version: number; reason: string }[] = [];
const archiveCommands: string[] = [];
const verificationCommands: string[] = [];
const tagCommands: { id: string; tags: readonly string[] | undefined }[] = [];
let reject = false;
let held = false;
let release: (() => void) | undefined;
const evidence = (id: string, version: number) => ({
  authority: "test" as const, commandId: "proof-command", correlationId: "proof-correlation",
  aggregateId: id, aggregateType: "Lead", version, occurredAt: lead.createdAt,
  outcome: "COMMITTED" as const, warnings: [], emittedEventIds: [], auditEvidenceIds: [],
});
configureLeadApplication({ ...leadServices, api: { ...leadServices.api, commands: {
  ...leadServices.api.commands,
  async disqualifyLead(id, input, options) {
    commands.push({ id, version: options.expectedVersion, reason: input.reason });
    if (held) await new Promise<void>(resolve => { release = resolve; });
    if (reject) throw new ApplicationError({ code: "VERSION_CONFLICT", category: "CONFLICT",
      message: "private diagnostic", userMessage: "Bound A conflict", retryable: false });
    const record = leads.getLeadsSnapshot().find(item => item.id === id);
    assert.ok(record);
    // Synthetic response exercises the real application projection without a destructive backend write.
    return { lead: { ...record, resourceVersion: options.expectedVersion + 1,
      leadWorkState: "CLOSED", qualificationOutcome: "DISQUALIFIED" }, evidence: evidence(id, options.expectedVersion + 1) };
  },
  async archiveLead(id, options) {
    archiveCommands.push(id);
    throw new ApplicationError({ code: "PROOF_STOP", category: "CONFLICT", message: "Intercepted archive", retryable: false });
  },
  async advanceLeadWorkState(id, input, options) {
    verificationCommands.push(id);
    throw new ApplicationError({ code: "PROOF_STOP", category: "CONFLICT", message: "Intercepted verification", retryable: false });
  },
  async replaceLeadProfile(id, input, options) {
    tagCommands.push({ id, tags: input.tags });
    const record = leads.getLeadsSnapshot().find(item => item.id === id);
    assert.ok(record);
    return { lead: { ...record, tags: [...input.tags ?? []], resourceVersion: options.expectedVersion + 1 },
      evidence: evidence(id, options.expectedVersion + 1) };
  },
} } });
let controller: ReturnType<typeof useLeadDetailController>;
function Probe() {
  controller = useLeadDetailController({ authoritativeLead: lead });
  assert.ok(controller);
  return React.createElement(LeadDetailView, { controller });
}
const rootElement = document.getElementById("root");
assert.ok(rootElement);
const root = createRoot(rootElement);
const render = async (key = "mount") => act(async () => root.render(React.createElement(I18nProvider, null,
  React.createElement(MemoryRouter, { key, initialEntries: [`/leads/${lead.id}`] },
    React.createElement(PlatformStateProvider, null, React.createElement(GuidanceProvider, null,
      React.createElement(Routes, null,
        React.createElement(Route, { path: "/leads/:leadId", element: React.createElement(Probe) }),
        React.createElement(Route, { path: "/leads/:leadId/qualify", element: React.createElement("p", null, "Qualification destination") })
      )))))));
const current = () => { assert.ok(controller); return controller; };
const drawer = () => { const element = document.querySelector<HTMLElement>('[data-surface="drawer"]'); assert.ok(element, "Expected Drawer"); assert.equal(document.querySelectorAll('[data-surface="drawer"]').length, 1); return element; };
const modal = () => {
  assert.equal(document.querySelector('[data-surface="drawer"]'), null, "Bounded transaction must not open Drawer");
  const element = document.querySelector<HTMLElement>('[data-dialog-variant="form"]'); assert.ok(element, "Expected centered Form Modal");
  assert.equal(document.querySelectorAll('[data-dialog-variant="form"]').length, 1, "Only one work form");
  return element;
};
const click = async (name: string, scope: ParentNode = document) => {
  const button = [...scope.querySelectorAll<HTMLButtonElement>("button")].find(item => (item.getAttribute("aria-label") || item.textContent?.trim()) === name);
  assert.ok(button, `Missing button: ${name}`);
  await act(async () => button.click());
};
const change = async (selector: string, value: string) => {
  const input = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector); assert.ok(input, selector);
  const prototype = input.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  await act(async () => { Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(input, value); input.dispatchEvent(new window.Event("input", { bubbles: true })); });
};
const close = async () => document.querySelector('[data-surface="drawer"]') ? click("Đóng bảng điều khiển", drawer()) : click("Đóng hộp thoại", modal());
const settle = async () => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 80)); }); };

const { getDirtyUnsavedWork, discardDirtyUnsavedWork } = await import('@/platform/unsaved-work');
const A = structuredClone(lead);
const B: Lead = { ...A, id: 'lead-target-B', name: 'Lead B', phone: '0987654321', resourceVersion: 9 };
leads.saveLeadSnapshot(B);
const switchTo = async (next: Lead) => { await act(async () => { lead = next; current().navigate('/leads/' + next.id); }); await settle(); };
const open = async () => { await act(async () => current().setShowDisqualifyModal(true)); await settle(); };
const reasonInput = () => { const input = document.querySelector<HTMLTextAreaElement>('[data-dialog-variant="form"] textarea'); assert.ok(input); return input; };
const confirm = () => click('Xác nhận không đạt');
const { saveDirtyUnsavedWork } = await import('@/platform/unsaved-work');
try {
  await render(); await settle();
  await open();
  assert.equal(current().dialogs.boundLead?.id, A.id);
  assert.equal(getDirtyUnsavedWork().length, 0);
  await switchTo(B);
  assert.equal(current().showDisqualifyModal, false, 'clean switch closes A');
  await open(); assert.equal(reasonInput().value, '');
  assert.equal(getDirtyUnsavedWork().length, 0);
  await act(async () => current().setDisqualifyCategory('Không có ngân sách')); await settle();
  assert.ok(getDirtyUnsavedWork().length > 0, 'category-only draft is dirty');
  await act(async () => current().setDisqualifyCategory('Không có nhu cầu')); await settle();
  assert.equal(getDirtyUnsavedWork().length, 0, 'category revert is clean');
  await close(); await switchTo(A); await open();

  await change('[data-dialog-variant="form"] textarea', 'Reason for A'); await settle();
  assert.ok(getDirtyUnsavedWork().some(entry => entry.id === 'lead-form:' + A.id));
  await change('[data-dialog-variant="form"] textarea', ''); await settle();
  assert.equal(getDirtyUnsavedWork().length, 0, 'reason revert is clean');
  await change('[data-dialog-variant="form"] textarea', 'Reason for A'); await settle();
  assert.equal(await saveDirtyUnsavedWork(), false, 'global guard cannot falsely save');
  await act(async () => current().setShowEditModal(true));
  assert.equal(current().showEditModal, false, 'one active mutable interaction');
  const refreshedA = { ...A, resourceVersion: 7, name: 'Refreshed A' };
  await act(async () => leads.saveLeadSnapshot(refreshedA));
  lead = refreshedA; await render(); await settle();
  assert.equal(reasonInput().value, 'Reason for A');
  assert.equal(current().dialogs.boundLead?.resourceVersion, 3, 'opening snapshot stays fixed');

  await switchTo(B);
  await click('Tiếp tục chỉnh sửa'); await settle();
  assert.equal(current().lead.id, A.id);
  assert.equal(reasonInput().value, 'Reason for A');
  reject = true; await confirm(); await settle();
  assert.deepEqual(commands[0], { id: A.id, version: 7, reason: 'Reason for A' },
    'Option B: current authoritative version resolved for opening target A, never B/version9');
  assert.equal(current().lead.id, A.id);
  assert.equal(reasonInput().value, 'Reason for A');
  assert.match(document.querySelector('[data-dialog-variant="form"]')?.textContent ?? '', /Bound A conflict/);
  assert.doesNotMatch(document.body.textContent ?? '', /private diagnostic/);
  // Dirty revert and local keep/discard both preserve the opening target.
  await close(); await click('Tiếp tục chỉnh sửa'); await settle();
  assert.equal(reasonInput().value, 'Reason for A');
  await close(); await click('Bỏ thay đổi'); await settle();
  assert.equal(current().lead.id, B.id);
  assert.equal(current().disqualifyReasonText, '');
  await open();
  assert.equal(reasonInput().value, '');
  assert.equal(current().disqualifyCategory, 'Không có nhu cầu');
  assert.doesNotMatch(document.querySelector('[data-dialog-variant="form"]')?.textContent ?? '', /Bound A conflict/);
  assert.equal(getDirtyUnsavedWork().length, 0);
  await change('[data-dialog-variant="form"] textarea', 'B draft'); await settle();
  await act(async () => discardDirtyUnsavedWork()); await settle();
  assert.equal(current().showDisqualifyModal, false);
  await switchTo(refreshedA); await open();
  await change('[data-dialog-variant="form"] textarea', 'Pending A'); await settle();

  reject = false; held = true;
  const oldResolve = current().dialogs.resolveInteraction;
  const oldClose = current().setShowDisqualifyModal;
  const oldPending = current().dialogs.setActiveInteractionPending;
  const oldReason = current().setDisqualifyReasonText;
  const oldDiscard = getDirtyUnsavedWork()[0]?.discard; assert.ok(oldDiscard);
  await confirm(); await settle();
  const count = commands.length;
  await confirm(); assert.equal(commands.length, count, 'double confirm executes once');
  await switchTo(B);
  await act(async () => discardDirtyUnsavedWork()); await settle();
  assert.equal(current().lead.id, A.id);
  assert.equal(current().showDisqualifyModal, true);
  assert.equal(commands.at(-1)?.id, A.id);
  await act(async () => current().setShowDisqualifyModal(false)); await settle();
  assert.equal(current().showDisqualifyModal, true, 'pending close cannot release ownership');
  assert.ok(release); held = false;
  await act(async () => release?.()); await settle();
  assert.equal(current().lead.id, B.id);
  assert.equal(current().showDisqualifyModal, false);
  assert.equal(leads.getLeadsSnapshot().find(item => item.id === A.id)?.qualificationOutcome, 'DISQUALIFIED');
  assert.equal(leads.getLeadsSnapshot().find(item => item.id === B.id)?.qualificationOutcome, undefined);
  await open();
  await change('[data-dialog-variant="form"] textarea', 'New B draft'); await settle();
  await act(async () => { oldResolve('disqualify'); oldClose(false); oldPending(false); oldReason('Stale A callback'); oldDiscard(); }); await settle();
  assert.equal(current().dialogs.boundLead?.id, B.id);
  assert.equal(reasonInput().value, 'New B draft', 'late A completion cannot reset B');
  await act(async () => discardDirtyUnsavedWork()); await settle();
  await open(); assert.equal(reasonInput().value, '');
  await close(); await settle();

  // Nearby same-root decision surfaces share target ownership, not current route identity.
  await switchTo(refreshedA);
  await act(async () => current().setShowArchiveConfirm(true)); await settle();
  await switchTo(B);
  assert.equal(current().lead.id, A.id);
  await click('Lưu trữ'); await settle();
  assert.deepEqual(archiveCommands, [A.id]);
  await act(async () => discardDirtyUnsavedWork()); await settle();
  await switchTo(refreshedA);
  await act(async () => current().setShowVerificationReadiness(true)); await settle();
  await switchTo(B);
  assert.equal(current().lead.id, A.id);
  await act(async () => current().commitStartVerification({ painPoint: 'A verification' })); await settle();
  assert.deepEqual(verificationCommands, [A.id]);
  await act(async () => discardDirtyUnsavedWork()); await settle();
  await switchTo(refreshedA);
  const tagsAnchor = document.createElement('button'); document.body.appendChild(tagsAnchor);
  await act(async () => { current().dialogs.setTagsAnchor(tagsAnchor); current().setShowTagsModal(true); }); await settle();
  await switchTo(B);
  assert.equal(current().dialogs.boundLead?.id, A.id, 'tag action owns opening target');
  const tagsDialog = document.querySelector<HTMLElement>('[aria-label="Quản lý nhãn Lead"]'); assert.ok(tagsDialog);
  const tagInput = tagsDialog.querySelector('input'); assert.ok(tagInput); tagInput.id = 'identity-proof-tag';
  await change('#identity-proof-tag', 'A tag'); await click('Thêm', tagsDialog); await settle();
  assert.deepEqual(tagCommands, [{ id: A.id, tags: ['A tag'] }]);
  await act(async () => discardDirtyUnsavedWork()); await settle();
  assert.equal(current().lead.id, B.id);
  assert.ok(commands.every(command => command.id === A.id));
  console.log('Lead Disqualify target identity: PASS (clean/dirty switch, registry, keep/discard, refresh, command/version, pending/duplicate, failure, late cycle safety, reopen, related transitions).');
} finally { await act(async () => root.unmount()); window.close(); }
