import assert from "node:assert/strict";
import { dashboardDayBounds, dashboardTotal, readConnectedDashboard } from "../../src/workspaces/crm/read-models/dashboard/connectedDashboardQueries";
import type { AuthoritativePage } from "../../src/shared/application";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { ConnectedDashboardView } from "../../src/workspaces/crm/presentation/dashboard/ConnectedDashboardView";
import { dashboardDate, dashboardMoney } from "../../src/workspaces/crm/presentation/dashboard/dashboardPresentation";
import { ApplicationError } from "../../src/shared/domain";

const page: AuthoritativePage<unknown> = { items: [], pageInfo: { hasNextPage: true, totalCount: 1050 }, loadedAt: "2026-10-23T00:00:00Z", authority: "backend" };
assert.equal(dashboardTotal(page), 1050, "A page window is never the aggregate count");
assert.throws(() => dashboardTotal({ ...page, pageInfo: { hasNextPage: false } }), { code: "DASHBOARD_TOTAL_UNAVAILABLE" });
assert.throws(() => dashboardTotal({ ...page, authority: "demo" }), { code: "DASHBOARD_TOTAL_UNAVAILABLE" });
assert.equal(dashboardTotal({ ...page, pageInfo: { hasNextPage: false, totalCount: 0 } }), 0, "Verified empty is distinct from missing authority");

assert.deepEqual(dashboardDayBounds("2026-10-22T18:00:00Z", "Asia/Ho_Chi_Minh"), { start: "2026-10-22T17:00:00.000Z", end: "2026-10-23T17:00:00.000Z" });
const spring = dashboardDayBounds("2026-03-08T16:00:00Z", "America/New_York");
assert.equal(new Date(spring.end).getTime() - new Date(spring.start).getTime(), 23 * 3_600_000, "Workspace midnight handles DST rather than assuming 24 hours");
const autumn = dashboardDayBounds("2026-11-01T16:00:00Z", "America/New_York");
assert.equal(new Date(autumn.end).getTime() - new Date(autumn.start).getTime(), 25 * 3_600_000);

const forbidden = await readConnectedDashboard({ memberId: "test-member", timeZone: "UTC", canReadDeals: false, canReadSupport: false, canReadTasks: false, asOf: "2026-10-23T00:00:00Z" }, new AbortController().signal);
for (const section of [forbidden.pipeline, forbidden.tasks, forbidden.support, forbidden.closing, forbidden.activities]) {
  assert.equal(section.state, "FORBIDDEN", "Missing permission must not become a zero metric or a demo read");
  assert.equal("data" in section, false);
}
console.log("PASS Dashboard count authority, permission refusal and workspace/DST day boundaries");

assert.equal(dashboardMoney({ amount: "124445000000", currency: "VND" }, "vi").compact, "124,445 tỷ ₫");
assert.match(dashboardMoney({ amount: "9007199254740993.1234", currency: "USD" }, "en").full, /9,007,199,254,740,993\.1234/);
assert.equal(dashboardMoney({ amount: "-0.125", currency: "USD" }, "en").full, "-$0.125");
assert.match(dashboardMoney({ amount: "999999.9999", currency: "VND" }, "vi").compact, /1\.000 nghìn/);
assert.match(dashboardDate("2026-10-02", "en", "Pacific/Honolulu", true), /10\/02/);

type Model = Parameters<typeof ConnectedDashboardView>[0]["model"];
const model: Model = {
  state: "READY", enabled: true, loading: false, refreshing: false, stale: false,
  workspaceKey: "unit-workspace", timeZone: "Asia/Ho_Chi_Minh", baseCurrency: "VND",
  refresh: async () => undefined, cancel: () => {},
  data: { ...forbidden, asOf: "2026-10-23T00:00:00Z" },
};
const render = (value: Model) => renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(ConnectedDashboardView, { model: value, locale: "vi" })));
const denied = render(model);
assert.match(denied, /data-state="FORBIDDEN"/);
assert.doesNotMatch(denied, /data-value="0"|data-count="0"/);
const loading = render({ ...model, state: "LOADING", loading: true });
assert.match(loading, /data-dashboard-skeleton/);
assert.doesNotMatch(loading, /data-state="FORBIDDEN"|data-value=/);
const failed = render({ ...model, data: { ...forbidden, asOf: "2026-10-23T00:00:00Z", pipeline: { state: "ERROR", error: new ApplicationError({ code: "TEST_NETWORK_FAILURE", category: "NETWORK", message: "private diagnostic" }) } } });
assert.match(failed, /Thử lại/);
assert.doesNotMatch(failed, /private diagnostic|data-count="0"/);
const emptyData: NonNullable<Model["data"]> = {
  asOf: "2026-10-23T00:00:00Z", pipeline: { state: "READY", data: { buckets: [], asOf: "2026-10-23T00:00:00Z", permissionFiltered: true } },
  tasks: { state: "READY", data: { items: [], total: 0, overdue: 0, dueToday: 0 } },
  support: { state: "READY", data: { items: [], total: 0, urgent: 0 } },
  activities: { state: "READY", data: [] }, closing: { state: "READY", data: [] },
};
const empty = render({ ...model, data: emptyData });
assert.match(empty, /data-count="0"/);
assert.match(empty, /Bạn không có công việc đang mở/);
const scoped = render({ ...model, enabled: false, data: { ...emptyData, tasks: { state: "READY", data: { items: [], total: 777, overdue: 777, dueToday: 777 } } } });
assert.doesNotMatch(scoped, /777/);
console.log("PASS Dashboard presentation: exact money, calendar dates, loading, empty, forbidden, error and retired scope");

const timingData: NonNullable<Model["data"]> = {
  ...emptyData,
  asOf: "2026-12-31T18:30:00Z",
  tasks: { state: "READY", data: { total: 1, overdue: 1, dueToday: 1, items: [{
    id: "task-timing", title: "Earlier today", assigneeId: "member-one", status: "OPEN", priority: "NORMAL",
    dueAt: "2026-12-31T18:00:00Z", createdAt: "2026-12-31T12:00:00Z", updatedAt: "2026-12-31T12:00:00Z",
  }] } },
};
const timing = render({ ...model, data: timingData });
assert.match(timing, /tasks\?view=overdue&amp;assignee=mine/, "Overdue tile opens the existing saved view for the same assignee scope");
assert.match(timing, /tasks\?view=today&amp;assignee=mine/, "Due today tile opens the existing saved view for the same assignee scope");
assert.match(timing, /Quá hạn/, "Earlier-today work retains the backend overdue instant meaning");
assert.match(timing, /01[/-]01/, "Task due time uses Workspace timezone across the year boundary");
const invalidTiming = render({ ...model, data: { ...timingData, tasks: { state: "READY", data: {
  total: 1, overdue: 0, dueToday: 0,
  items: [{ id: "task-invalid-time", title: "Unavailable deadline", assigneeId: "member-one", status: "OPEN", priority: "NORMAL", dueAt: "invalid", createdAt: "2026-12-31T12:00:00Z", updatedAt: "2026-12-31T12:00:00Z" }],
} } } });
assert.match(invalidTiming, /Thời hạn chưa khả dụng/);
assert.doesNotMatch(invalidTiming, /Sắp đến hạn/);
console.log("PASS Dashboard Task saved-view targets and shared Workspace due-date presentation (unit contract, not connected acceptance)");
