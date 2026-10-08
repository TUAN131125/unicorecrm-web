import assert from "node:assert/strict";
import React, { act } from "react";
import type { Root } from "react-dom/client";
import { I18nProvider } from "@/i18n";
import { saveDirtyUnsavedWork, getDirtyUnsavedWork } from "@/platform/unsaved-work";
import { ContactLogCallModal } from "@/modules/contacts/presentation/detail/actions/ContactLogCallModal";
import { ContactMeetingModal } from "@/modules/contacts/presentation/detail/actions/ContactMeetingModal";
import { ContactQuickNoteModal } from "@/modules/contacts/presentation/detail/actions/ContactQuickNoteModal";
import { ContactSendEmailModal } from "@/modules/contacts/presentation/detail/actions/ContactSendEmailModal";
import { ContactSendSmsModal } from "@/modules/contacts/presentation/detail/actions/ContactSendSmsModal";
import { CustomerQuickActivityModal } from "@/modules/customers/presentation/detail/CustomerQuickActivityModal";
import { OrganizationQuickActivityModal } from "@/modules/organizations/presentation/detail/OrganizationQuickActivityModal";
import { SavedViewNameModal } from "@/components/crm/SavedViewNameModal";
import { useContactListViewSettings } from "@/modules/contacts/presentation/hooks/useContactListViewSettings";
import { getDefaultContactPresentationSnapshot } from "@/modules/contacts/presentation/model/contactSavedViewPreferences";
import { configureTaskApplication, getTaskApplicationServices } from "@/modules/tasks/application/composition/taskApplicationServices";
import { mapLogActivityRequest } from "@/modules/tasks/infrastructure/http/TaskApiMapper";
import { resolveActivityRecordingDate } from "@/modules/tasks/presentation/model/activityRecordingTime";

export async function checkSafeSaveConsumers(root: Root, value: (id: string, text: string) => Promise<void>) {
  let open = true, proof: boolean | undefined = false, calls = 0, captured: unknown;
  const save = async (draft: unknown): Promise<boolean> => { calls++; captured = draft; return proof as boolean; };
  let component: React.ReactNode;
  const render = async () => { await act(async () => root.render(React.createElement(I18nProvider, null, open ? component : null))); };
  const close = () => { open = false; root.render(React.createElement(I18nProvider, null)); };
  const base = { isOpen: true, targetId: "contact-opening", onClose: close };
  const cases = [
    { form: "contact-log-call-form", field: "subject", make: () => React.createElement(ContactLogCallModal, { ...base, onSave: save }), date: "occurredAt" },
    { form: "contact-meeting-form", field: "title", make: () => React.createElement(ContactMeetingModal, { ...base, onSave: save }), date: "startAt" },
    { form: "contact-quick-note-form", field: "title", make: () => React.createElement(ContactQuickNoteModal, { ...base, onSave: save }), date: "occurredAt" },
    { form: "contact-send-email-form", field: "subject", make: () => React.createElement(ContactSendEmailModal, { ...base, prefilledEmail: "a@example.test", onSend: save }) },
    { form: "contact-send-sms-form", field: "body", make: () => React.createElement(ContactSendSmsModal, { ...base, prefilledPhone: "0901234567", onSend: save }) },
  ];
  for (const test of cases) {
    open = true; proof = false; component = test.make(); await render();
    await value(`${test.form}-${test.field}`, "Validated consumer draft");
    if (test.field === "subject" && test.form.includes("email")) await value(`${test.form}-body`, "Email body");
    if (test.form.includes("note")) await value(`${test.form}-body`, "Note body");
    const expectedDate = test.date ? (document.getElementById(`${test.form}-${test.date}`) as HTMLInputElement).value : undefined;
    await act(async () => assert.equal(await saveDirtyUnsavedWork(), false, test.form)); assert(open);
    if (expectedDate && test.date === "occurredAt") assert.equal((captured as { occurredAt: string }).occurredAt, new Date(expectedDate).toISOString());
    if (expectedDate && test.date === "startAt") {
      const draft = captured as { startDate: string; startTime: string };
      assert.equal(`${draft.startDate}T${draft.startTime}`, expectedDate, "Meeting preserves validated local date for the Task UTC conversion");
    }
    proof = undefined; await act(async () => assert.equal(await saveDirtyUnsavedWork(), false)); assert(open, "Void cannot prove persistence");
    proof = true; await act(async () => assert.equal(await saveDirtyUnsavedWork(), true, test.form + document.body.textContent)); assert(!open);
    await act(async () => root.render(null));
  }
  for (const owner of [CustomerQuickActivityModal, OrganizationQuickActivityModal]) {
    for (const action of ["call", "meeting", "email", "sms", "note"] as const) {
      open = true; proof = false;
      const formId = owner === CustomerQuickActivityModal ? "customers-activity" : "organizations-activity";
      component = React.createElement(owner, { action, isVi: true, targetId: "opening", email: "a@example.test", phone: "0901234567", ownerName: "u1", onClose: close, onSave: save });
      await render(); await value(`${formId}-${action === "call" ? "subject" : action === "meeting" || action === "note" ? "title" : "body"}`, "Consumer evidence");
      if (action === "note") await value(`${formId}-body`, "Note evidence");
      await act(async () => assert.equal(await saveDirtyUnsavedWork(), false, `${formId}:${action}`)); assert(open);
      proof = true; await act(async () => assert.equal(await saveDirtyUnsavedWork(), true)); assert(!open);
      await act(async () => root.render(null));
    }
  }
  assert(calls >= 35, "All production wrapper families exercise awaited proof");

  const services = getTaskApplicationServices();
  configureTaskApplication({ ...services, api: { ...services.api, mode: "connected" } });
  try {
    for (const owner of [CustomerQuickActivityModal, OrganizationQuickActivityModal]) {
      for (const action of ["call", "meeting", "email", "sms", "note"] as const) {
        open = true; proof = true;
        const formId = owner === CustomerQuickActivityModal ? "customers-activity" : "organizations-activity";
        component = React.createElement(owner, { action, isVi: true, targetId: "opening", email: "a@example.test", phone: "0901234567", ownerName: "u1", onClose: close, onSave: save });
        await render();
        await value(`${formId}-${action === "call" ? "subject" : action === "meeting" || action === "note" ? "title" : "body"}`, "Connected record-now evidence");
        if (action === "note") await value(`${formId}-body`, "Connected note body");
        if (action === "call" || action === "note") assert.equal(document.getElementById(`${formId}-occurredAt`), null, "Server time intent exposes no editable recording date");
        await act(async () => assert.equal(await saveDirtyUnsavedWork(), true, `${formId}:${action} admits record-now`));
        assert(!open);
        const draft = captured as { type: "NOTE"; subject: string; body: string; occurredAt?: string };
        assert.equal(draft.occurredAt, undefined, "Connected intent does not send a client recording date");
        const request = mapLogActivityRequest(draft);
        assert(!Object.hasOwn(request, "occurredAt"), "Actual HTTP mapper accepts the date-less intent");
        await act(async () => root.render(null));
      }
    }
    assert.throws(() => resolveActivityRecordingDate({ recordingTime: "CUSTOM_DATE", occurredAt: "2026-10-06T09:12:00.000Z" }), /ACTIVITY_RECORDING_DATE_UNAVAILABLE/);
    assert.throws(() => resolveActivityRecordingDate({ recordingTime: "SERVER_NOW", occurredAt: "2026-10-06T09:12:00.000Z" }), /ACTIVITY_RECORDING_TIME_INTENT_CONFLICT/);
  } finally {
    configureTaskApplication(services);
    await act(async () => root.render(null));
  }

  let settings: ReturnType<typeof useContactListViewSettings> | undefined;
  let name = "Opening", editing: string | undefined;
  function Preferences() {
    settings = useContactListViewSettings();
    return React.createElement(SavedViewNameModal, { isOpen: open, mode: editing ? "edit" : "create", name, formId: "contact-preference-proof",
      onNameChange(next) { name = next; root.render(React.createElement(I18nProvider, null, React.createElement(Preferences))); },
      onClose: close, onSubmit() { throw new Error("Void submit must not run"); },
      onSave: async submitted => { const result = editing ? settings!.updateCustomView(editing, submitted, getDefaultContactPresentationSnapshot()) : settings!.createCustomView(submitted, getDefaultContactPresentationSnapshot()); return result.ok; },
    });
  }
  const preferences = async () => { await act(async () => root.render(React.createElement(I18nProvider, null, React.createElement(Preferences)))); };
  open = true; await preferences(); await value("contact-preference-proof-name", " ");
  await act(async () => assert.equal(await saveDirtyUnsavedWork(), false)); assert(open);
  await value("contact-preference-proof-name", "SAFE unique view"); await act(async () => assert.equal(await saveDirtyUnsavedWork(), true)); assert(!open);
  // Remount observes preferences persisted by the actual Contact settings hook.
  open = true; name = ""; await preferences(); await value("contact-preference-proof-name", "SAFE unique view");
  await act(async () => assert.equal(await saveDirtyUnsavedWork(), false)); assert(open); assert.equal(name, "SAFE unique view");
  editing = settings!.customViews.find(view => view.labelKey === "SAFE unique view")?.key; assert(editing);
  await act(async () => root.render(null));
  await preferences(); await value("contact-preference-proof-name", "SAFE renamed view"); await act(async () => assert.equal(await saveDirtyUnsavedWork(), true)); assert(!open);
  open = true; await preferences(); assert(settings!.customViews.some(view => view.labelKey === "SAFE renamed view"));
  await act(async () => root.render(null)); assert.equal(getDirtyUnsavedWork().length, 0);
}
