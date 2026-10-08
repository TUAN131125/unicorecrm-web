import assert from "node:assert/strict";
import React, { act } from "react";
import type { Root } from "react-dom/client";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { I18nProvider } from "@/i18n";
import { PlatformStateProvider } from "@/app/providers";
import { getContactsSnapshot } from "@/modules/contacts/public/contacts";
import { useContactDetailController } from "@/modules/contacts/presentation/hooks/useContactDetailController";
import { getTaskApplicationServices, configureTaskApplication } from "@/modules/tasks/application/composition/taskApplicationServices";
import { getWorkspaceContextSnapshot, listWorkspaceMemberships, switchWorkspaceContext } from "@/platform/workspace-context";

export async function checkSafeContactOwner(root: Root) {
  const contact = getContactsSnapshot()[0]; assert(contact);
  const services = getTaskApplicationServices();
  let capturedDate: string | undefined, calls = 0, wrongTarget = false, hold = false;
  let release: (() => void) | undefined;
  configureTaskApplication({ ...services, api: { ...services.api, commands: { ...services.api.commands,
    async logActivity(input, options) {
      calls++; capturedDate = input.occurredAt;
      const result = await services.api.commands.logActivity(input, options);
      if (hold) await new Promise<void>(resolve => { release = resolve; });
      return wrongTarget ? { ...result, activity: { ...result.activity, recordRef: { moduleKey: "contacts", recordId: "other" } } } : result;
    },
  } } });
  let controller: ReturnType<typeof useContactDetailController> | undefined;
  function Harness() { controller = useContactDetailController({ customers: [], deals: [], quotes: [], orders: [], taskActivity: { tasks: [], activities: [] }, careCases: [] }); return null; }
  await act(async () => root.render(React.createElement(I18nProvider, null, React.createElement(MemoryRouter, { initialEntries: [`/contacts/${contact.id}`] },
    React.createElement(PlatformStateProvider, null, React.createElement(Routes, null, React.createElement(Route, { path: "/contacts/:contactId", element: React.createElement(Harness) })))))));
  assert(controller?.contact);
  await act(async () => controller?.setShowQuickNoteModal(true));
  const date = "2026-10-06T09:12:00.000Z";
  const note = { title: "Dated note", body: "Evidence", type: "care", occurredAt: date };
  await act(async () => assert.equal(await controller?.handleSaveQuickNote(note), true)); assert.equal(capturedDate, date);
  const saved = services.repository.listActivities().find(activity => activity.subject === note.title); assert.equal(saved?.occurredAt, date);
  wrongTarget = true; await act(async () => assert.equal(await controller?.handleSaveQuickNote(note), false)); wrongTarget = false;
  await act(async () => controller?.setShowQuickNoteModal(false));
  await act(async () => controller?.setShowLogCallModal(true));
  await act(async () => assert.equal(await controller?.handleSaveLogCall({ direction: "outbound", result: "connected", summary: "Call", occurredAt: date }), true)); assert.equal(capturedDate, date);
  const beforeComposite = calls;
  await act(async () => assert.equal(await controller?.handleSaveLogCall({ direction: "outbound", result: "connected", summary: "Call", occurredAt: date, createFollowUpTask: true }), false)); assert.equal(calls, beforeComposite);
  hold = true; let pending: Promise<boolean> | undefined;
  await act(async () => { pending = controller?.handleSaveLogCall({ direction: "outbound", result: "connected", summary: "Pending", occurredAt: date }); });
  const pendingCalls = calls;
  await act(async () => assert.equal(await controller?.handleSaveLogCall({ direction: "outbound", result: "connected", summary: "Duplicate", occurredAt: date }), false)); assert.equal(calls, pendingCalls);
  const original = getWorkspaceContextSnapshot(); const other = listWorkspaceMemberships().find(member => member.status === "active" && member.workspaceKey !== original.workspaceKey); assert(other);
  await act(async () => { await switchWorkspaceContext(other.workspaceKey); });
  await act(async () => { release?.(); assert.equal(await pending, false, "Stale workspace cannot prove completion"); }); hold = false;
  await act(async () => { await switchWorkspaceContext(original.workspaceKey); });
  await act(async () => root.render(null));
  // A dated draft cannot be admitted through the current date-less connected contract.
  configureTaskApplication({ ...services, api: { ...services.api, mode: "connected", commands: { ...services.api.commands, async logActivity() { throw new Error("TRANSPORT_MUST_NOT_RUN"); } } } });
  const { logActivityCommand } = await import("@/modules/tasks");
  await assert.rejects(logActivityCommand({ id: "dated", type: "NOTE", subject: "Dated", actorId: "u1", occurredAt: date }), /ACTIVITY_RECORDING_DATE_UNAVAILABLE/);
  const { mapLogActivityRequest } = await import("@/modules/tasks/infrastructure/http/TaskApiMapper");
  assert.throws(() => mapLogActivityRequest({ type: "NOTE", subject: "Dated", occurredAt: date }), /recording date/);
  configureTaskApplication(services);
}
