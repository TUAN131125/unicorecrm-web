import assert from "node:assert/strict";
import React, { act } from "react";
import type { Root } from "react-dom/client";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { I18nProvider } from "@/i18n";
import { PlatformStateProvider } from "@/app/providers";
import { useDealDetailController } from "@/modules/deals/presentation/hooks/useDealDetailController";
import { getDealsSnapshot } from "@/modules/deals";
import { NoteActivityCreateModal } from "@/modules/tasks";
import { getTaskApplicationServices, configureTaskApplication } from "@/modules/tasks/application/composition/taskApplicationServices";
import { saveDirtyUnsavedWork } from "@/platform/unsaved-work";

export async function checkSafeDealOwner(root: Root, value: (id: string, text: string) => Promise<void>) {
  const deal = getDealsSnapshot()[0]; assert(deal);
  const services = getTaskApplicationServices();
  let wrongDate = true;
  const keys: string[] = [];
  configureTaskApplication({ ...services, api: { ...services.api, commands: { ...services.api.commands,
    async logActivity(input, options) {
      keys.push(options.idempotencyKey);
      const result = await services.api.commands.logActivity(input, options);
      return wrongDate ? { ...result, activity: { ...result.activity, occurredAt: "2000-01-01T00:00:00Z" } } : result;
    },
  } } });
  let controller: ReturnType<typeof useDealDetailController> | undefined;
  function Harness() {
    controller = useDealDetailController({ customers: [], contacts: [], setCustomers() {} });
    if (!controller?.deal) return null;
    return React.createElement(NoteActivityCreateModal, { isOpen: controller.isDirectNoteModalOpen, targetId: controller.deal.id, recordingOnly: true, formId: "deal-owner-note",
      onClose: () => controller?.setIsDirectNoteModalOpen(false), onSubmit() { throw new Error("Void success prohibited"); }, onSave: controller.handleAddDirectNote });
  }
  await act(async () => root.render(React.createElement(I18nProvider, null, React.createElement(MemoryRouter, { initialEntries: [`/deals/${deal.id}`] },
    React.createElement(PlatformStateProvider, null, React.createElement(Routes, null, React.createElement(Route, { path: "/deals/:dealId", element: React.createElement(Harness) })))))));
  await act(async () => controller?.setIsDirectNoteModalOpen(true));
  await value("deal-owner-note-title", "Deal owner note"); await value("deal-owner-note-body", "Evidence");
  await act(async () => assert.equal(await saveDirtyUnsavedWork(), false)); assert(controller?.isDirectNoteModalOpen); assert(document.querySelector('[role="alert"]'));
  wrongDate = false; await act(async () => assert.equal(await saveDirtyUnsavedWork(), true)); assert.equal(controller?.isDirectNoteModalOpen, false);
  assert.equal(keys[0], keys[1], "Same opening intent survives refusal/retry");
  await act(async () => root.render(null)); configureTaskApplication(services);
}
