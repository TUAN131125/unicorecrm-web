import assert from "node:assert/strict";
import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { I18nProvider } from "@/i18n";
import { configureDefaultAccessGovernanceRuntime, getAccessGovernanceRuntime, getAccessGovernanceState, refreshAccessGovernance } from "@/platform/access-control";
import { getWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { getContactApplicationServices, configureContactApplication } from "@/modules/contacts/application/composition/contactApplicationServices";
import { getContactDetailResource, getContactRelationshipSummaryResource } from "@/modules/contacts/application/vertical-slice/contactAuthoritativeQueries";
import { useContactDetailPageController } from "@/modules/contacts/presentation/hooks/useContactDetailPageController";
import { ContactDetailResourceView } from "@/modules/contacts/presentation/views/ContactDetailResourceView";
import { ContactEditModal } from "@/modules/contacts/presentation/detail/ContactEditModal";
import { useContacts } from "@/modules/contacts/presentation/hooks/useContacts";
import { useAuthoritativeResource } from "@/shared/operations";
import { getDirtyUnsavedWork, saveDirtyUnsavedWork, registerUnsavedWork } from "@/platform/unsaved-work";
import { OverlayPortalHostContext } from "@/shared/components/ui";
import { updateContactViaApi, getContactsSnapshot } from "@/modules/contacts/public/contacts";

export async function checkContactAuthorityCache() {
  const ws = getWorkspaceContextSnapshot().workspaceId;
  const runtime = getAccessGovernanceRuntime();
  const prior = getAccessGovernanceState().snapshot?.authorization;
  assert.ok(prior);
  let authorization: typeof prior = { ...prior, dataScopes: { ...prior.dataScopes, contacts: "WORKSPACE" as const }, fieldSecurity: { ...prior.fieldSecurity, contacts: { ...prior.fieldSecurity.contacts, workEmail: "READ_WRITE" as const } } };
  configureDefaultAccessGovernanceRuntime({ ...runtime, queries: { ...runtime.queries, async getAuthorizationContext() { return authorization; } } });
  await React.act(async () => { await refreshAccessGovernance(ws); });
  const secret = "synthetic-contact-secret@example.invalid";
  const contact = { id: "contact_authority_probe", workspaceId: ws, ownerId: authorization.memberId, fullName: "Authority probe", name: "Authority probe", createdAt: "2026-10-09", status: "active" as const, resourceVersion: 1, workEmail: secret };
  const services = getContactApplicationServices();
  const unsupported = async (): Promise<never> => { throw new Error("Unexpected fixture command"); };
  let narrow = false, detailReads = 0, summaryReads = 0;
  let holdRead = false, resolveRead: ((value: typeof contact) => void) | undefined;
  let resolveMutation: ((value: typeof contact) => void) | undefined;
  configureContactApplication({ ...services, api: { ...services.api, mode: "connected", queries: { ...services.api.queries,
    async get() { detailReads++; if (holdRead) return new Promise<typeof contact>(resolve => { resolveRead = resolve; }); return narrow ? { ...contact, workEmail: undefined } : contact; },
    async getRelationshipSummary() { summaryReads++; return { contact: narrow ? { ...contact, workEmail: undefined } : contact, organizationIds: narrow ? [] : ["organization-sensitive"], customerIds: [], linkedRecords: [], linkedRecordCounts: { tasks: 0, activities: 0, deals: 0, quotes: 0, orders: 0, invoices: 0, payments: 0, shipping: 0, returns: 0, supportCases: 0 }, allowedActions: [], projectionVersion: 1, generatedAt: "2026-10-09", organizationRelationships: [], customerRelationships: [] }; },
  }, commands: { create: unsupported, archive: unsupported, createOrganizationRelationship: unsupported, updateOrganizationRelationship: unsupported, endOrganizationRelationship: unsupported, createCustomerRelationship: unsupported, updateCustomerRelationship: unsupported, endCustomerRelationship: unsupported, async update() { return new Promise<typeof contact>(resolve => { resolveMutation = resolve; }); } } } });
  const detail = getContactDetailResource(contact.id), summaryResource = getContactRelationshipSummaryResource(contact.id);
  detail.reset(); summaryResource.reset();
  const bodyChildrenBefore = Array.from(document.body.children);
  const initialOverflow = document.body.style.overflow;
  const element = document.createElement("div"); document.body.append(element); const root = createRoot(element);
  let model: ReturnType<typeof useContactDetailPageController> | undefined;
  let summary: ReturnType<typeof useAuthoritativeResource<import("@/modules/contacts/application/ports/ContactApiRuntime").ContactRelationshipSummary>> | undefined;
  let formSaves = 0;
  let recoveryPending = true, recoveryDiscards = 0, unrelatedDiscards = 0;
  const unregisterUnrelated = registerUnsavedWork({ id: "unrelated-contact-draft", title: "Unrelated", isDirty: true, save: async () => false, discard: () => { unrelatedDiscards++; } });
  function RecoveryProbe() {
    const owner = React.useContext(OverlayPortalHostContext);
    React.useEffect(() => owner?.registerDraft?.({ canDiscard: () => !recoveryPending, discard: () => { recoveryDiscards++; } }), [owner?.registerDraft]);
    return null;
  }
  function Harness() {
    model = useContactDetailPageController({ customers: [], deals: [], quotes: [], orders: [], taskActivity: { tasks: [], activities: [] }, careCases: [] });
    summary = useAuthoritativeResource(getContactRelationshipSummaryResource(contact.id));
    const controller = model.controller;
    return React.createElement(ContactDetailResourceView, { model, children: React.createElement(React.Fragment, null,
      React.createElement(RecoveryProbe),
      React.createElement("span", null, model.detailQuery.data?.workEmail, summary.data?.organizationIds.join(",")),
      controller ? React.createElement(ContactEditModal, { isOpen: controller.showEditModal, onClose: () => controller.setShowEditModal(false), contact: controller.contact, async onSave() { formSaves++; } }) : null) });
  }
  await React.act(async () => root.render(React.createElement(I18nProvider, null, React.createElement(MemoryRouter, { initialEntries: ["/contacts/" + contact.id] }, React.createElement(Routes, null, React.createElement(Route, { path: "/contacts/:contactId", element: React.createElement(Harness) }))))));
  await React.act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
  assert.equal(detailReads, 1); assert.equal(summaryReads, 1);
  assert.ok(document.body.innerHTML.includes(secret));
  const mutation = updateContactViaApi({ contactId: contact.id, expectedVersion: 1, fullName: "Pending old authority" }, { idempotencyKey: "authority-stable-intent" });

  // A current captured edit draft must survive quarantine, but cannot save or expose fields.
  await React.act(async () => model?.controller?.setShowEditModal(true));
  const draftField = document.querySelector<HTMLInputElement>("#contact-edit-name");
  assert.ok(draftField, "Real edit owner must open");
  assert.equal(document.body.style.overflow, "hidden", "Authorized modal owns its scroll lock");
  await React.act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set?.call(draftField, "Preserved authority draft");
    draftField.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
  const draftEntry = getDirtyUnsavedWork().find(entry => entry.id.includes(contact.id));
  assert.ok(draftEntry, "Changed Contact input must be dirty");
  holdRead = true;
  let oldRead: Promise<unknown> | undefined;
  await React.act(async () => { oldRead = detail.refresh(); });
  const oldSignalRead = resolveRead;
  assert.ok(oldSignalRead, "Capture a delayed read from the opening authority");

  narrow = true; holdRead = false;
  authorization = { ...authorization, fieldSecurity: { ...authorization.fieldSecurity, contacts: { ...authorization.fieldSecurity.contacts, workEmail: "HIDDEN" as const } } };
  await React.act(async () => { await refreshAccessGovernance(ws); });
  assert.ok(detailReads >= 3, "Revision must issue fresh detail read");
  assert.ok(summaryReads >= 2, "Revision must issue fresh relationship summary");
  assert.equal(getContactDetailResource(contact.id).getSnapshot().data?.workEmail, undefined);
  assert.deepEqual(getContactRelationshipSummaryResource(contact.id).getSnapshot().data?.organizationIds, []);
  assert.ok(!document.body.innerHTML.includes(secret), "Old policy fields must leave the document, including modal portals");
  assert.equal(document.body.style.overflow, initialOverflow, "Quarantine releases the modal scroll lock");
  await React.act(async () => window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  const readsBeforeRetiredRefresh = detailReads;
  await detail.refresh();
  assert.equal(detailReads, readsBeforeRetiredRefresh, "A retired resource cannot reload through a new principal's transport");
  await React.act(async () => { oldSignalRead(contact); await oldRead; resolveMutation?.(contact); await mutation; });
  assert.ok(!getContactsSnapshot().some(row => row.workEmail === secret), "Late reads and mutation completions cannot repopulate old policy values");
  assert.equal(await saveDirtyUnsavedWork(), false, "Old opening global Save must be refused");
  assert.ok(getDirtyUnsavedWork().some(entry => entry.id === draftEntry.id), "Quarantine preserves draft owner");
  assert.equal(document.querySelector("#contact-edit-name"), null, "Old form fields leave document");
  assert.equal(formSaves, 0);
  // Same workspace identity changes are distinct from a field-policy revision.
  const readsBeforePrincipalChange = detailReads;
  authorization = { ...authorization, accountId: "next-account", membershipId: "next-membership", memberId: "next-member" };
  await React.act(async () => { await refreshAccessGovernance(ws); });
  assert.ok(detailReads > readsBeforePrincipalChange);
  assert.equal(document.querySelector("#contact-edit-name"), null);
  assert.equal(await saveDirtyUnsavedWork(), false);
  const discard = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(button => /Discard draft and reload|Bỏ bản nháp và tải lại/.test(button.textContent ?? ""));
  assert.ok(discard);
  await React.act(async () => { discard.click(); });
  assert.equal(recoveryDiscards, 0, "Pending owner preflight prevents every discard");
  assert.ok(getDirtyUnsavedWork().some(entry => entry.id === draftEntry.id));
  recoveryPending = false;
  await React.act(async () => { discard.click(); });
  assert.equal(recoveryDiscards, 1, "Clean owner participates in explicit recovery");
  assert.ok(!/A request is pending|Yêu cầu đang xử lý/.test(document.body.textContent ?? ""), "Successful recovery clears the pending notice");
  assert.equal(unrelatedDiscards, 0, "Recovery cannot discard unrelated Contact work");
  assert.ok(!getDirtyUnsavedWork().some(entry => entry.id === draftEntry.id), "Explicit recovery discards only retained owner");
  await React.act(async () => root.unmount()); element.remove();
  assert.deepEqual(Array.from(document.body.children), bodyChildrenBefore, "Unmount cleans up both owned portal containers");
  assert.ok(getDirtyUnsavedWork().every(entry => !entry.id.includes(contact.id)));
  unregisterUnrelated();
  narrow = false;
  authorization = { ...prior, dataScopes: { ...prior.dataScopes, contacts: "WORKSPACE" }, fieldSecurity: { ...prior.fieldSecurity, contacts: { ...prior.fieldSecurity.contacts, workEmail: "READ_WRITE" } } };
  await React.act(async () => { await refreshAccessGovernance(ws); });
  await getContactDetailResource(contact.id).load();
  assert.ok(getContactsSnapshot().some(row => row.workEmail === secret), "First-mount case starts with an actual sensitive projection");
  narrow = true;
  authorization = { ...authorization, accountId: "unmounted-account", membershipId: "unmounted-membership", memberId: "unmounted-member" };
  await React.act(async () => { await refreshAccessGovernance(ws); });
  const firstFrames: Array<Array<string | undefined>> = [];
  function FirstMount() {
    const value = useContacts({ loadAuthoritative: false });
    firstFrames.push(value.contacts.map(row => row.workEmail));
    return null;
  }
  const firstMountElement = document.createElement("div"); document.body.append(firstMountElement);
  const firstMountRoot = createRoot(firstMountElement);
  await React.act(async () => firstMountRoot.render(React.createElement(FirstMount)));
  assert.ok(!firstFrames[0]?.includes(secret), "A newly mounted consumer cannot relabel a prior-principal projection as current");
  await React.act(async () => firstMountRoot.unmount()); firstMountElement.remove();
  const standaloneElement = document.createElement("div"); document.body.append(standaloneElement);
  const standaloneRoot = createRoot(standaloneElement);
  let standaloneClosed = false;
  function StandaloneForm() {
    const [open, setOpen] = React.useState(true);
    return React.createElement(ContactEditModal, { isOpen: open, contact, onClose: () => { standaloneClosed = true; setOpen(false); }, async onSave() { formSaves++; } });
  }
  await React.act(async () => standaloneRoot.render(React.createElement(I18nProvider, null, React.createElement(StandaloneForm))));
  const standaloneField = document.querySelector<HTMLInputElement>("#contact-edit-name"); assert.ok(standaloneField);
  await React.act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set?.call(standaloneField, "Standalone preserved draft");
    standaloneField.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
  authorization = { ...authorization, membershipId: "standalone-next-membership" };
  await React.act(async () => { await refreshAccessGovernance(ws); });
  assert.equal(document.querySelector("#contact-edit-name"), null);
  assert.equal(await saveDirtyUnsavedWork(), false);
  const closeForm = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(button => /^(Close form|Đóng biểu mẫu)$/.test(button.textContent ?? "")); assert.ok(closeForm);
  await React.act(async () => closeForm.click());
  const confirmDiscard = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(button => /^(Discard changes|Bỏ thay đổi)$/.test(button.textContent ?? "")); assert.ok(confirmDiscard);
  await React.act(async () => confirmDiscard.click());
  assert.equal(standaloneClosed, true, "Standalone form retains an explicit confirmed recovery path without disclosing old fields");
  await React.act(async () => standaloneRoot.unmount()); standaloneElement.remove();
  configureContactApplication(services);
  configureDefaultAccessGovernanceRuntime(runtime);
  await React.act(async () => { await refreshAccessGovernance(ws); });
  console.log("Contact authority cache: revision refetch, summary eviction, detached modal host, late read/mutation protection passed.");
}
