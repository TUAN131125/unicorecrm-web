import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import type { Lead } from "@/modules/leads";

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: "http://localhost", pretendToBeVisual: true });
const { window } = dom;
const browserErrors: unknown[] = [];
window.addEventListener("error", event => browserErrors.push(event.error));
Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", { value() {}, configurable: true });
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
const { ApplicationError } = await import('@/shared/domain');
const leads = await import('@/modules/leads');
const { configureLeadApplication, getLeadApplicationServices } = await import('@/modules/leads/application/composition/leadApplicationServices');
const { LeadQualificationPage } = await import('@/workflows/lead-qualification/presentation/pages/LeadQualificationPage');
const { useNavigate, useLocation } = await import('react-router-dom');
const { getDirtyUnsavedWork, discardDirtyUnsavedWork } = await import('@/platform/unsaved-work');
const A: Lead = { id: 'qualification-A', name: 'Qualification Lead A', title: '', companyName: 'Company A',
  phone: '0901234567', email: 'a@example.test', source: 'WEB', score: 0, ownerId: 'u1', leadWorkState: 'VERIFYING',
  interestedProducts: [], activities: [], resourceVersion: 3, createdAt: '2026-07-01T00:00:00Z' };
const B: Lead = { ...A, id: 'qualification-B', name: 'Qualification Lead B', companyName: 'Company B', resourceVersion: 9 };
leads.replaceLeads([A, B]);
const calls: { id: string; version: number; reason: string; evidence: string | undefined }[] = [];
const services = getLeadApplicationServices();
configureLeadApplication({ ...services, api: { ...services.api, commands: { ...services.api.commands,
  async disqualifyLead(id, input, options) {
    calls.push({ id, version: options.expectedVersion, reason: input.reason, evidence: input.evidence });
    throw new ApplicationError({ code: 'PROOF_STOP', category: 'CONFLICT', message: 'Intercepted before write', retryable: false });
  },
} } });
let navigate: ReturnType<typeof useNavigate>;
let pathname = '';
let page: React.ComponentType = LeadQualificationPage;
function Probe() { navigate = useNavigate(); pathname = useLocation().pathname; return React.createElement(page); }
const rootElement = document.getElementById('root'); assert.ok(rootElement);
const root = createRoot(rootElement);
const settle = async () => act(async () => { await new Promise(resolve => setTimeout(resolve, 80)); });
const change = async (selector: string, value: string) => {
  const input = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector); assert.ok(input);
  const prototype = input.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  await act(async () => { Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(input, value); input.dispatchEvent(new window.Event('input', { bubbles: true })); });
};
try {
  await act(async () => root.render(React.createElement(I18nProvider, null,
    React.createElement(MemoryRouter, { initialEntries: ['/leads/' + A.id + '/qualify'] },
      React.createElement(PlatformStateProvider, null, React.createElement(GuidanceProvider, null,
        React.createElement(Routes, null, React.createElement(Route, { path: '/leads/:leadId/qualify', element: React.createElement(Probe) }))))))));
  await settle();
  assert.equal(getDirtyUnsavedWork().length, 0, 'canonical prefill must be clean');
  await act(async () => navigate(`/leads/${B.id}/qualify`)); await settle();
  assert.match(document.body.textContent ?? '', /Qualification Lead B/); assert.equal(getDirtyUnsavedWork().length, 0);
  await act(async () => navigate(`/leads/${A.id}/qualify`)); await settle();

  const card = [...document.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.includes('Không đủ điều kiện')); assert.ok(card);
  await act(async () => card.click()); await settle();
  await change('#qualification-disqualified-reason', 'Reason drafted for A');
  await change('#qualification-disqualified-evidence', 'Evidence drafted for A');
  assert.ok(getDirtyUnsavedWork().length > 0);
  await act(async () => navigate('/leads/' + B.id + '/qualify')); await settle();
  await act(async () => leads.replaceLeads([{ ...A, resourceVersion: 7 }, B])); await settle();
  assert.match(document.body.textContent ?? '', /Qualification Lead A/);
  assert.doesNotMatch(document.body.textContent ?? '', /Qualification Lead B/);
  assert.equal(document.querySelector<HTMLInputElement>('#qualification-disqualified-reason')?.value, 'Reason drafted for A');
  const form = document.querySelector('form'); assert.ok(form);
  await act(async () => {
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  }); await settle();
  assert.deepEqual(calls, [{ id: A.id, version: 7, reason: 'Reason drafted for A', evidence: 'Evidence drafted for A' }]);
  assert.ok(document.querySelector('[role="alert"]'));
  assert.equal(document.querySelector<HTMLInputElement>('#qualification-disqualified-reason')?.value, 'Reason drafted for A');
  await act(async () => getDirtyUnsavedWork().forEach(entry => entry.discard())); await settle();
  assert.match(document.body.textContent ?? '', /Qualification Lead B/);
  assert.equal(getDirtyUnsavedWork().length, 0);
  console.log('Lead full-page target identity: Qualification Disqualified target/version/dirty/discard/duplicate/failure PASS');
  const { configureLeadQualificationApiRuntime } = await import('@/workflows/lead-qualification/application/composition/leadQualificationApiRuntimeBinding');
  const { LeadSellNowPage } = await import('@/workflows/lead-qualification/presentation/pages/LeadSellNowPage');
  const { LeadCustomerConversionPage } = await import('@/workflows/lead-customer-conversion/presentation/LeadCustomerConversionPage');
  const { configureLeadCustomerConversionGateway } = await import('@/workflows/lead-customer-conversion/application/composition/leadCustomerConversionApplicationServices');
  const { getProductCatalogSnapshot } = await import('@/modules/products');
  const product = getProductCatalogSnapshot()[0]; assert.ok(product, 'demo catalog fixture');
  const qualificationCalls: { kind: string; id: string; version: number; payload: unknown }[] = [];
  let rejectPending: ((error: unknown) => void) | undefined;
  let hold = false;
  const refusal = () => new ApplicationError({ code: 'TEST_REFUSAL', category: 'CONFLICT', message: 'Intercepted', userMessage: 'Test refusal', retryable: false });
  async function intercept(kind: string, command: { leadId: string }, options: { expectedVersion: number }): Promise<never> {
    qualificationCalls.push({ kind, id: command.leadId, version: options.expectedVersion, payload: command });
    if (hold) await new Promise<never>((_resolve, reject) => { rejectPending = reject; });
    throw refusal();
  }
  configureLeadQualificationApiRuntime({ mode: 'connected', commands: {
    qualifyForNurture: (command, options) => intercept('NURTURE', command, options),
    qualifyForOpportunity: (command, options) => intercept('OPPORTUNITY', command, options),
    qualifyForDirectSale: (command, options) => intercept('DIRECT_SALE', command, options),
  } });
  let renderCycle = 0;
  async function mount(component: React.ComponentType, suffix: string, target = A.id) {
    page = component;
    await act(async () => root.render(React.createElement(I18nProvider, null,
      React.createElement(MemoryRouter, { key: ++renderCycle, initialEntries: [`/leads/${target}/${suffix}`] },
        React.createElement(PlatformStateProvider, null, React.createElement(GuidanceProvider, null,
          React.createElement(Routes, null, React.createElement(Route, { path: `/leads/:leadId/${suffix}`, element: React.createElement(Probe) }))))))));
    await settle();
  }
  async function click(text: string) {
    const button = [...document.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.includes(text)); assert.ok(button, text);
    await act(async () => button.click()); await settle();
  }
  async function submit() { const currentForm = document.querySelector('form'); assert.ok(currentForm); await act(async () => currentForm.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))); await settle(); }
  for (const outcome of ['NURTURE', 'OPPORTUNITY'] as const) {
    await act(async () => { leads.replaceLeads([]); leads.replaceLeads([A, B]); });
    await mount(LeadQualificationPage, 'qualify');
    await click(outcome === 'NURTURE' ? 'Chăm sóc thêm' : 'Tạo cơ hội');
    if (outcome === 'NURTURE') { const dateButton = document.querySelector<HTMLButtonElement>('#qualification-revisit-date'); assert.ok(dateButton); await act(async () => dateButton.click()); await settle(); await click('Hiện tại'); await click('Áp dụng'); await change('#qualification-nurture-reason', 'A nurture'); }
    else { await change('#qualification-deal-name', 'A opportunity'); await change('#qualification-need-summary', 'A need'); }
    await act(async () => navigate(`/leads/${B.id}/qualify`)); await settle();
    await act(async () => leads.replaceLeads([{ ...A, resourceVersion: 7 }, B])); await settle();
    assert.match(document.body.textContent ?? '', /Qualification Lead A/);
    hold = true; const before = qualificationCalls.length;
    await submit(); await submit();
    assert.equal(qualificationCalls.length, before + 1, 'duplicate writes blocked');
    assert.equal(qualificationCalls.at(-1)?.id, A.id); assert.equal(qualificationCalls.at(-1)?.version, 7);
    await act(async () => getDirtyUnsavedWork().forEach(entry => entry.discard())); await settle();
    assert.match(document.body.textContent ?? '', /Qualification Lead A/, 'pending discard must retain A');
    assert.equal(await getDirtyUnsavedWork()[0]?.save(), false, 'pending save must fail honestly');
    await act(async () => assert.equal(discardDirtyUnsavedWork(), false, 'global pending discard must refuse navigation'));
    await act(async () => rejectPending?.(refusal())); hold = false; await settle();
    assert.ok(document.querySelector('[role="alert"]'));
    await act(async () => assert.equal(await getDirtyUnsavedWork()[0]?.save(), false, 'application refusal must not report saved'));
    await settle();
    await act(async () => getDirtyUnsavedWork().forEach(entry => entry.discard())); await settle();
    assert.match(document.body.textContent ?? '', /Qualification Lead B/); assert.equal(getDirtyUnsavedWork().length, 0);
  }
  // Real ProductPicker: cancel preserves draft; catalog refresh preserves an in-modal selection;
  // applying and discarding are scoped to the bound Qualification target.
  const { replaceProductCatalog } = await import('@/modules/products');
  await act(async () => { leads.replaceLeads([]); leads.replaceLeads([A, B]); });
  await mount(LeadQualificationPage, 'qualify'); await click('Tạo cơ hội');
  await click('Chọn sản phẩm');
  const productButton = document.getElementById(`picker-product-${product.id}`); assert.ok(productButton);
  await act(async () => productButton.click()); await settle();
  await click('Hủy'); await click('Chọn sản phẩm');
  assert.equal(document.getElementById(`picker-product-${product.id}`)?.getAttribute('aria-pressed'), 'false');
  await act(async () => document.getElementById(`picker-product-${product.id}`)?.click()); await settle();
  await act(async () => replaceProductCatalog([...getProductCatalogSnapshot()])); await settle();
  assert.equal(document.getElementById(`picker-product-${product.id}`)?.getAttribute('aria-pressed'), 'true');
  await act(async () => navigate(`/leads/${B.id}/qualify`)); await settle();
  await click('Áp dụng (1)');
  assert.match(document.body.textContent ?? '', /Qualification Lead A/);
  const unload = new window.Event('beforeunload', { cancelable: true }); window.dispatchEvent(unload); assert.equal(unload.defaultPrevented, true);
  await act(async () => getDirtyUnsavedWork().forEach(entry => entry.discard())); await settle();
  assert.match(document.body.textContent ?? '', /Qualification Lead B/);
  await click('Tạo cơ hội'); await click('Chọn sản phẩm');
  assert.equal(document.getElementById(`picker-product-${product.id}`)?.getAttribute('aria-pressed'), 'false', 'A products cannot leak to B');
  await click('Hủy');
  // Sell Now uses the real catalog/default line item, reference refresh, command and registry.
  await act(async () => { leads.replaceLeads([]); leads.replaceLeads([{ ...A, interestedProducts: [{ id: "interest-A", productId: product.id, productNameSnapshot: product.name, interestLevel: "high", createdAt: A.createdAt }] }, B]); });
  await mount(LeadSellNowPage, 'sell-now');
  const titleInput = [...document.querySelectorAll<HTMLInputElement>('input')].find(input => input.value.startsWith('Bán trực tiếp -')); assert.ok(titleInput);
  titleInput.id = 'sell-title'; const initialTitle = titleInput.value;
  await change('#sell-title', 'A sale'); assert.ok(getDirtyUnsavedWork().length > 0);
  await change('#sell-title', initialTitle); assert.equal(getDirtyUnsavedWork().length, 0, 'revert canonical returns clean');
  await change('#sell-title', 'A sale');
  await click('Chọn sản phẩm');
  assert.equal(document.getElementById(`picker-product-${product.id}`)?.getAttribute('aria-pressed'), 'true');
  await act(async () => document.getElementById(`picker-product-${product.id}`)?.click()); await settle();
  await click('Hủy'); await click('Chọn sản phẩm');
  assert.equal(document.getElementById(`picker-product-${product.id}`)?.getAttribute('aria-pressed'), 'true', 'Sell Now cancel preserves bound selection');
  await act(async () => replaceProductCatalog([...getProductCatalogSnapshot()])); await settle();
  assert.equal(document.getElementById(`picker-product-${product.id}`)?.getAttribute('aria-pressed'), 'true');
  await click('Hủy');
  await act(async () => navigate(`/leads/${B.id}/sell-now`)); await settle();
  await act(async () => leads.replaceLeads([{ ...A, resourceVersion: 7, interestedProducts: [{ id: "interest-A", productId: product.id, productNameSnapshot: product.name, interestLevel: "high", createdAt: A.createdAt }] }, B])); await settle();
  assert.equal(document.querySelector<HTMLInputElement>('#sell-title')?.value, 'A sale');
  hold = true; const beforeSale = qualificationCalls.length;
  const saleButton = [...document.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.includes('Bắt đầu Direct Sale')); assert.ok(saleButton);
  await act(async () => { saleButton.click(); saleButton.click(); }); await settle();
  await act(async () => assert.equal(discardDirtyUnsavedWork(), false, 'pending Sell Now vetoes global discard'));
  assert.equal(qualificationCalls.length, beforeSale + 1); assert.equal(qualificationCalls.at(-1)?.id, A.id); assert.equal(qualificationCalls.at(-1)?.version, 7);
  assert.match(JSON.stringify(qualificationCalls.at(-1)?.payload), /"title":"A sale"/);
  assert.match(JSON.stringify(qualificationCalls.at(-1)?.payload), /"name":"Qualification Lead A"/);

  await act(async () => getDirtyUnsavedWork().forEach(entry => entry.discard())); await settle();
  assert.match(document.body.textContent ?? '', /Qualification Lead A/);
  // Replace the entire page while A is pending, then settle A: callbacks must not touch fresh B.
  await mount(LeadSellNowPage, 'sell-now', B.id);
  await act(async () => rejectPending?.(refusal())); hold = false; await settle();
  assert.match(document.body.textContent ?? '', /Qualification Lead B/); assert.equal(getDirtyUnsavedWork().length, 0);
  assert.doesNotMatch(document.body.textContent ?? '', /Test refusal/);
  // Conversion query and gateway intercept are real public application paths.
  configureLeadApplication({ ...getLeadApplicationServices(), api: { ...getLeadApplicationServices().api, mode: "connected", queries: {
    ...getLeadApplicationServices().api.queries, async get(id) { const record = leads.getLeadSnapshot(id); assert.ok(record); return record; },
  } } });
  const conversionCalls: { id: string; version: number; key: string; subject: string }[] = [];
  configureLeadCustomerConversionGateway({ async convertLeadToCustomer(id, version, key, request) {
    conversionCalls.push({ id, version, key, subject: request.accountSubject.id });
    throw new ApplicationError({ code: 'LEAD_CONVERSION_IN_PROGRESS', category: 'CONFLICT', message: 'Pending', retryable: true });
  } });
  await act(async () => { leads.replaceLeads([]); leads.replaceLeads([A, B]); });
  await mount(LeadCustomerConversionPage, 'convert-to-customer');
  const subject = document.querySelector<HTMLInputElement>('input'); assert.ok(subject); subject.id = 'conversion-subject';
  await change('#conversion-subject', 'subject-A'); assert.ok(getDirtyUnsavedWork().length > 0);
  await act(async () => navigate(`/leads/${B.id}/convert-to-customer`)); await settle();
  await submit(); await submit();
  assert.equal(conversionCalls.length, 2); assert.equal(conversionCalls[0]?.id, A.id); assert.equal(conversionCalls[0]?.version, 3);
  assert.equal(conversionCalls[1]?.key, conversionCalls[0]?.key); assert.equal(conversionCalls[1]?.subject, 'subject-A');
  await act(async () => getDirtyUnsavedWork().forEach(entry => entry.discard())); await settle();
  assert.equal(document.querySelector<HTMLInputElement>('input')?.value, ''); assert.equal(getDirtyUnsavedWork().length, 0);
  const subjectB = document.querySelector<HTMLInputElement>('input'); assert.ok(subjectB); subjectB.id = 'conversion-subject';
  await change('#conversion-subject', 'subject-B'); await submit();
  assert.equal(conversionCalls[2]?.id, B.id); assert.equal(conversionCalls[2]?.version, 9); assert.notEqual(conversionCalls[2]?.key, conversionCalls[0]?.key);
  // Pending conversion cannot be duplicated or discarded; late committed A cannot reset B.
  let completeConversion: (() => void) | undefined;
  let pendingConversionWrites = 0;
  configureLeadCustomerConversionGateway({ async convertLeadToCustomer(id, version, key, request) {
    pendingConversionWrites++;
    assert.equal(id, A.id); assert.equal(version, 3); assert.equal(request.accountSubject.id, 'pending-A'); assert.ok(key);
    await new Promise<void>(resolve => { completeConversion = resolve; });
    return { outcome: 'COMMITTED', occurredAt: '2026-10-05T00:00:00Z', result: { customerResolution: 'CREATED', customerId: 'customer-A' } };
  } });
  await mount(LeadCustomerConversionPage, 'convert-to-customer');
  const pendingSubject = document.querySelector<HTMLInputElement>('input'); assert.ok(pendingSubject); pendingSubject.id = 'conversion-subject';
  await change('#conversion-subject', 'pending-A');
  const conversionForm = document.querySelector('form'); assert.ok(conversionForm);
  await act(async () => { conversionForm.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); conversionForm.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); }); await settle();
  assert.equal(pendingConversionWrites, 1);
  await act(async () => assert.equal(discardDirtyUnsavedWork(), false, 'pending Conversion vetoes global discard'));
  await act(async () => navigate(`/leads/${B.id}/convert-to-customer`)); await settle();
  await act(async () => getDirtyUnsavedWork().forEach(entry => entry.discard())); await settle();
  assert.equal(document.querySelector<HTMLInputElement>('input')?.value, 'pending-A');
  await mount(LeadCustomerConversionPage, 'convert-to-customer', B.id);
  const freshSubject = document.querySelector<HTMLInputElement>('input'); assert.ok(freshSubject); freshSubject.id = 'conversion-subject';
  await change('#conversion-subject', 'new-B-draft');
  await act(async () => completeConversion?.()); await settle();
  assert.equal(document.querySelector<HTMLInputElement>('input')?.value, 'new-B-draft');
  assert.doesNotMatch(document.body.textContent ?? '', /customer-A/);
  // A committed Qualification arriving after unmount cannot replace fresh B's errors/draft.
  let completeQualification: (() => void) | undefined;
  configureLeadQualificationApiRuntime({ mode: 'connected', commands: {
    qualifyForNurture: (command, options) => intercept('NURTURE', command, options),
    qualifyForDirectSale: (command, options) => intercept('DIRECT_SALE', command, options),
    async qualifyForOpportunity(command, options) {
      assert.equal(command.leadId, A.id); assert.equal(options.expectedVersion, 3);
      await new Promise<void>(resolve => { completeQualification = resolve; });
      return { result: { leadId: A.id, relationshipRef: { type: 'CONTACT', id: 'contact-A' }, dealId: 'deal-A' }, createdResources: [],
        evidence: { authority: 'test', commandId: 'command-A', correlationId: 'test', aggregateId: A.id, aggregateType: 'lead', version: 4,
          occurredAt: '2026-10-05T00:00:00Z', outcome: 'COMMITTED', warnings: [], emittedEventIds: [], auditEvidenceIds: [] } };
    },
  } });
  await mount(LeadQualificationPage, 'qualify'); await click('Tạo cơ hội'); await change('#qualification-need-summary', 'A pending opportunity');
  await submit();
  await mount(LeadQualificationPage, 'qualify', B.id); await click('Tạo cơ hội'); await change('#qualification-need-summary', 'B fresh need');
  await act(async () => completeQualification?.()); await settle();
  assert.equal(document.querySelector<HTMLTextAreaElement>('#qualification-need-summary')?.value, 'B fresh need');
  assert.doesNotMatch(document.body.textContent ?? '', /deal-A/);
  await mount(LeadQualificationPage, 'qualify'); await click('Tạo cơ hội');
  await act(async () => assert.equal(await getDirtyUnsavedWork()[0]?.save(), false, 'client validation is not successful save'));
  await settle(); assert.ok(document.querySelector('[role="alert"]'));
  await change('#qualification-need-summary', 'A save and continue');
  await act(async () => {
    const saving = getDirtyUnsavedWork()[0]?.save(); assert.ok(saving);
    await Promise.resolve(); completeQualification?.();
    assert.equal(await saving, true, 'only committed persistence reports successful global save');
  }); await settle();
  assert.equal(getDirtyUnsavedWork().length, 0); assert.equal(pathname, `/leads/${A.id}/qualify`);
  assert.deepEqual(browserErrors, [], 'real workflow must not emit uncaught browser errors');
  console.log(JSON.stringify({ qualificationCalls: qualificationCalls.map(({ kind, id, version }) => ({ kind, id, version })), conversionCalls, result: 'Lead full-page real integration PASS' }, null, 2));
} finally { await act(async () => root.unmount()); window.close(); }
