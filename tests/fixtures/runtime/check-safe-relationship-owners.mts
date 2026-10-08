import assert from "node:assert/strict";
import React, { act } from "react";
import type { Root } from "react-dom/client";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { I18nProvider } from "@/i18n";
import { PlatformStateProvider } from "@/app/providers";
import { Customer360Page } from "@/modules/customers/presentation/pages/Customer360Page";
import { OrganizationAccountDetailPage } from "@/modules/organizations/presentation/pages/OrganizationAccountDetailPage";
import { getCustomersSnapshot } from "@/modules/customers/public/api";
import { getOrganizationAccountsSnapshot } from "@/modules/organizations/public/api";
import { getTaskApplicationServices, configureTaskApplication } from "@/modules/tasks/application/composition/taskApplicationServices";
import { getDirtyUnsavedWork, saveDirtyUnsavedWork } from "@/platform/unsaved-work";

export async function checkSafeRelationshipOwners(root: Root, value: (id: string, text: string) => Promise<void>) {
  const services = getTaskApplicationServices();
  let wrongTarget = true;
  configureTaskApplication({ ...services, api: { ...services.api, commands: { ...services.api.commands,
    async logActivity(input, options) {
      const result = await services.api.commands.logActivity(input, options);
      assert.equal(result.activity.occurredAt, input.occurredAt, "Owner supplies validated UTC recording date");
      return wrongTarget ? { ...result, activity: { ...result.activity, recordRef: { moduleKey: "contacts", recordId: "other" } } } : result;
    },
  } } });
  const customer = getCustomersSnapshot().find(row => row.status !== "ARCHIVED" && row.status !== "DO_NOT_CONTACT"); assert(customer);
  const organization = getOrganizationAccountsSnapshot().find(row => row.status !== "archived" && row.status !== "inactive" && row.phone && row.email); assert(organization);
  for (const owner of ["customers", "organizations"] as const) {
    for (const action of ["call", "meeting", "email", "sms", "note"] as const) {
      wrongTarget = true;
      const component = owner === "customers" ? React.createElement(Customer360Page, { customer }) : React.createElement(Routes, null, React.createElement(Route, { path: "/organizations/:organizationId", element: React.createElement(OrganizationAccountDetailPage) }));
      await act(async () => root.render(React.createElement(I18nProvider, null, React.createElement(MemoryRouter, { initialEntries: [`/organizations/${organization.id}`] }, React.createElement(PlatformStateProvider, null, component)))));
      const labels = action === "call" ? /Ghi cuộc gọi|Log call/ : action === "meeting" ? /Thêm lịch hẹn|Add meeting/ : action === "email" ? /Gửi Email|Ghi nhận Email|Send email|Log email/ : action === "sms" ? /Gửi SMS|Ghi nhận SMS|Send SMS|Log SMS/ : /Ghi chú nhanh|Quick note/;
      const button = [...document.querySelectorAll("button")].find(item => labels.test(item.getAttribute("aria-label") ?? item.textContent ?? "")); assert(button, `${owner}:${action} action`); assert(!button.disabled);
      await act(async () => button.click());
      const formId = `${owner}-activity`;
      await value(`${formId}-${action === "call" ? "subject" : action === "meeting" || action === "note" ? "title" : "body"}`, `Owned ${action}`);
      if (action === "note") await value(`${formId}-body`, "Owner evidence");
      if (action === "email") await value(`${formId}-to`, "owner@example.test");
      if (action === "sms") await value(`${formId}-phone`, "0901234567");
      await act(async () => assert.equal(await saveDirtyUnsavedWork(), false, `${owner}:${action} wrong result cannot close`)); assert(document.getElementById(`${formId}-${action === "call" ? "subject" : action === "meeting" || action === "note" ? "title" : "body"}`));
      wrongTarget = false; await act(async () => assert.equal(await saveDirtyUnsavedWork(), true, `${owner}:${action} explicit command proof`));
      assert.equal(getDirtyUnsavedWork().length, 0);
      await act(async () => root.render(null));
    }
  }
  configureTaskApplication(services);
}
