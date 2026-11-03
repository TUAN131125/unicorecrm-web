import assert from "node:assert/strict";
import { classifyTaskDate, formatTaskDueAt, taskDateKey, taskDayBounds } from "../../../src/modules/tasks/application/queries/taskDateClassification";

const now = "2026-12-31T18:30:00Z";
const zone = "Asia/Ho_Chi_Minh";
const task = { dueAt: "2026-12-31T18:00:00Z", status: "OPEN" as const, assigneeId: "member-one" };
const todayAndOverdue = classifyTaskDate(task, now, zone, "member-one");
assert.deepEqual(todayAndOverdue, { dueDateKey: "2027-01-01", validDate: true, dueToday: true, overdue: true, completed: false, myOpen: true }, "A deadline earlier today is both overdue by instant and due today in Workspace time");
assert.equal(classifyTaskDate({ ...task, dueAt: now }, now, zone).overdue, false, "Strict backend overdueAt comparison excludes equality");
assert.equal(classifyTaskDate({ ...task, dueAt: "2026-12-31T19:00:00Z" }, now, zone).overdue, false);
assert.equal(classifyTaskDate(task, now, zone, "another-member").myOpen, false);
assert.equal(classifyTaskDate(task, now, zone).myOpen, false, "Unresolved membership cannot mean all tasks are mine");

for (const status of ["COMPLETED", "CANCELLED"] as const) {
  const result = classifyTaskDate({ ...task, status }, now, zone, "member-one");
  assert.equal(result.overdue, false);
  assert.equal(result.dueToday, false);
  assert.equal(result.myOpen, false);
  assert.equal(result.completed, status === "COMPLETED");
}
assert.equal(taskDateKey(task.dueAt, "UTC"), "2026-12-31");
assert.equal(taskDateKey(task.dueAt, zone), "2027-01-01", "Year boundary is determined by Workspace timezone");
assert.equal(taskDateKey("2026-01-31T18:00:00Z", zone), "2026-02-01", "Month boundary is determined by Workspace timezone");
assert.equal(taskDateKey("2028-02-29T18:00:00Z", zone), "2028-03-01", "Leap-day conversion retains the correct calendar date");
for (const dueAt of ["invalid", "2026-02-30T12:00:00Z", "2026-12-31T24:00:00Z", "2026-12-31"]) {
  const result = classifyTaskDate({ ...task, dueAt }, now, zone, "member-one");
  assert.equal(result.validDate, false, dueAt);
  assert.equal(result.dueDateKey, undefined, dueAt);
  assert.equal(result.overdue, false, dueAt);
  assert.equal(result.dueToday, false, dueAt);
  assert.equal(result.myOpen, true, "An unavailable due date must not hide an otherwise open assigned Task");
  assert.equal(formatTaskDueAt(dueAt, "en", zone), "Due time unavailable");
}
assert.equal(taskDateKey(task.dueAt, "Invalid/Timezone"), undefined);
assert.match(formatTaskDueAt(task.dueAt, "en", zone), /01\/01\/2027/);
assert.deepEqual(taskDayBounds(now, zone), { start: "2026-12-31T17:00:00.000Z", end: "2027-01-01T17:00:00.000Z" });
for (const [date, hours] of [["2026-03-08T16:00:00Z", 23], ["2026-11-01T16:00:00Z", 25]] as const) {
  const bounds = taskDayBounds(date, "America/New_York");
  assert.equal((Date.parse(bounds.end) - Date.parse(bounds.start)) / 3_600_000, hours, "Workspace day bounds respect DST");
}
assert.throws(() => taskDayBounds("invalid", zone), RangeError);
console.log("Task date consistency: strict OPEN overdue, Workspace due-today/month/year/DST, completion/assignee boundaries and invalid date handling PASS (unit regression, not connected acceptance).");
