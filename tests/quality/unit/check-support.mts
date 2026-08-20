import assert from "node:assert/strict";
import {
  addSupportCaseInternalNote,
  addSupportCaseReply,
  createSupportCase,
  reassignSupportCase,
  transitionCase,
  updateSupportCase,
} from "../../../src/modules/support/application/commands/supportCaseCommands";
import {
  getSupportCaseSlaCompliance,
  getSupportCaseStats,
  querySupportCases,
} from "../../../src/modules/support/application/queries/supportCaseQueries";
import { InMemorySupportCaseRepository } from "../../../src/modules/support/infrastructure/InMemorySupportCaseRepository";
import { SUPPORT_MODULE_MANIFEST } from "../../../src/modules/support/manifest";
import { ModuleRegistry } from "../../../src/platform/module-registry/ModuleRegistry";

const created = createSupportCase([], {
  title: "Khách hàng cần tư vấn gia hạn",
  description: "Liên hệ lại khách hàng và thống nhất nhu cầu tiếp theo.",
  priority: "high",
  category: "consultation",
  source: "manual",
  customerId: "customer-1",
  customerName: "Acme",
  relationshipRef: { type: "ORGANIZATION_ACCOUNT", id: "org-customer-1" },
  ownerId: "u1",
  ownerName: "Care Owner A",
  nextFollowUpAt: "2026-07-08T09:00:00.000Z",
  locale: "vi",
}, new Date("2026-07-06T00:00:00.000Z"));
assert.equal(created.status, "new");
assert.equal(created.priority, "high");
assert.match(created.caseNumber, /^CASE-2026-/);
assert.equal(created.firstResponseDueAt, undefined, "Care Cases must not auto-create a response SLA.");
assert.equal(created.resolutionDueAt, undefined, "Care Cases must not auto-create a resolution SLA.");
assert.equal(created.slaStatus, "not_applicable");
assert.deepEqual(created.checklist, [], "Care Cases must not auto-generate checklist items.");
assert.deepEqual(created.resolutionSteps, [], "Care Cases must not auto-generate resolution steps.");

const original = created;
const updated = updateSupportCase(created, { title: "Đã cập nhật nhu cầu chăm sóc" }, "2026-07-06T01:00:00.000Z");
assert.equal(updated.title, "Đã cập nhật nhu cầu chăm sóc");
assert.equal(updated.id, created.id);
assert.throws(
  () => transitionCase(original, "closed", { actorName: "Care Owner A", locale: "vi" }),
  /SUPPORT_CASE_INVALID_TRANSITION:new:closed/,
  "A Care Case must not bypass the documented lifecycle from new directly to closed.",
);
assert.equal(original.status, "new", "A rejected transition must not mutate the source Care Case.");

const inProgress = transitionCase(original, "in_progress", { actorName: "Care Owner A", locale: "vi" });
assert.equal(inProgress.status, "in_progress");
assert.ok(inProgress.activities?.some((activity) => activity.type === "status_changed"));

const resolved = transitionCase(inProgress, "resolved", {
  actorName: "Care Owner A",
  locale: "vi",
  resolutionSummary: "Đã thống nhất phương án tiếp theo",
});
assert.equal(resolved.status, "resolved");
assert.equal(resolved.resolutionSummary, "Đã thống nhất phương án tiếp theo");
assert.ok(resolved.activities?.some((activity) => activity.type === "resolved"));

const replied = addSupportCaseReply(original, "Chúng tôi sẽ liên hệ lại theo lịch hẹn.", {
  senderType: "agent",
  locale: "vi",
  actorName: "Care Owner A",
}, new Date("2026-07-06T02:00:00.000Z"));
assert.equal(replied.comments?.length, 1);
assert.equal(replied.firstRespondedAt, "2026-07-06T02:00:00.000Z");
assert.ok(replied.activities?.some((activity) => activity.type === "first_response"));

const noted = addSupportCaseInternalNote(original, "Ghi chú nội bộ cho lần liên hệ tiếp theo", {
  locale: "vi",
  actorName: "Care Owner A",
}, new Date("2026-07-06T03:00:00.000Z"));
assert.equal(noted.comments?.at(-1)?.isInternal, true);

const reassigned = reassignSupportCase(original, { id: "u2", name: "Care Owner B" }, {
  locale: "vi",
  actorName: "Care Owner A",
}, new Date("2026-07-06T05:00:00.000Z"));
assert.equal(reassigned.ownerId, "u2");
assert.equal(reassigned.ownerName, "Care Owner B");

const second = createSupportCase([original], {
  title: "Khiếu nại về trải nghiệm giao hàng",
  description: "Khách hàng muốn được liên hệ lại.",
  priority: "medium",
  category: "complaint",
  source: "phone",
  customerId: "customer-2",
  customerName: "Beta",
  relationshipRef: { type: "ORGANIZATION_ACCOUNT", id: "org-customer-2" },
  locale: "vi",
}, new Date("2026-07-06T06:00:00.000Z"));
const seed = [original, second];
const queried = querySupportCases(seed, {
  search: "gia hạn",
  status: "all",
  priority: "all",
  category: "all",
  slaStatus: "all",
  owner: "all",
});
assert.equal(queried.length, 1);
assert.equal(queried[0].id, original.id);

const stats = getSupportCaseStats(seed);
assert.equal(stats.total, 2);
assert.equal(getSupportCaseSlaCompliance(seed), 100);

const listeners = new Map<string, Set<(payload: unknown) => void>>();
const repository = new InMemorySupportCaseRepository(seed, {
  publish: (eventName, payload) => listeners.get(eventName)?.forEach((listener) => listener(payload)),
  subscribe: (eventName, listener) => {
    const bucket = listeners.get(eventName) ?? new Set();
    bucket.add(listener as (payload: unknown) => void);
    listeners.set(eventName, bucket);
    return () => bucket.delete(listener as (payload: unknown) => void);
  },
});
let observedCount = 0;
const unsubscribe = repository.subscribe((cases) => { observedCount = cases.length; });
repository.replace([updated, ...seed]);
assert.equal(repository.list().length, seed.length + 1);
assert.equal(observedCount, seed.length + 1);
unsubscribe();

const registry = new ModuleRegistry().register(SUPPORT_MODULE_MANIFEST);
assert.equal(registry.get("support")?.routes.length, 4);

console.log("Care Case module checks: OK");
