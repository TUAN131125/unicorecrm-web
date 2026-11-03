import { dateTimeLocalValueToIso, toDateKeyInTimeZone } from "@/shared/lib/datetime/workspaceDateTime";
import type { Task } from "../../domain/model/task.types";

type TaskTiming = Pick<Task, "dueAt" | "status" | "assigneeId">;

function instant(value: Date | string): Date | undefined {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return undefined;
  if (typeof value === "string") {
    // Do not let Date's calendar normalization turn a malformed deadline into real work.
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u.exec(value);
    if (!match) return undefined;
    const [, year, month, day, hour, minute, second] = match;
    const probe = new Date(0);
    probe.setUTCFullYear(Number(year), Number(month) - 1, Number(day));
    if (probe.getUTCFullYear() !== Number(year) || probe.getUTCMonth() + 1 !== Number(month)
      || probe.getUTCDate() !== Number(day) || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return undefined;
  }
  return date;
}

/** Calendar grouping uses the authoritative Workspace timezone, never the browser timezone. */
export function taskDateKey(value: Date | string, timeZone: string): string | undefined {
  const date = instant(value);
  if (!date) return undefined;
  try { return toDateKeyInTimeZone(date, timeZone); }
  catch { return undefined; }
}

/** Matches Tasks' existing OPEN && DueAt < overdueAt query; today's earlier work is also overdue. */
export function classifyTaskDate(task: TaskTiming, now: Date | string, timeZone: string, memberId?: string) {
  const due = instant(task.dueAt);
  const current = instant(now);
  const dueDateKey = taskDateKey(task.dueAt, timeZone);
  const today = taskDateKey(now, timeZone);
  const open = task.status === "OPEN";
  return {
    dueDateKey,
    validDate: Boolean(due && dueDateKey),
    dueToday: Boolean(open && dueDateKey && today && dueDateKey === today),
    overdue: Boolean(open && due && current && due.getTime() < current.getTime()),
    completed: task.status === "COMPLETED",
    myOpen: Boolean(open && memberId && task.assigneeId === memberId),
  };
}

export function taskDayBounds(asOf: string, timeZone: string) {
  const day = taskDateKey(asOf, timeZone);
  if (!day) throw new RangeError("Task calendar date is unavailable.");
  const next = new Date(`${day}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return {
    start: dateTimeLocalValueToIso(`${day}T00:00`, timeZone),
    end: dateTimeLocalValueToIso(`${next.toISOString().slice(0, 10)}T00:00`, timeZone),
  };
}

export function formatTaskDueAt(value: string, locale: string, timeZone: string, timeOnly = false): string {
  const date = instant(value);
  if (!date || !taskDateKey(date, timeZone)) return locale === "vi" ? "Thời hạn chưa khả dụng" : "Due time unavailable";
  return date.toLocaleString(locale === "vi" ? "vi-VN" : "en-US", {
    timeZone,
    ...(timeOnly ? {} : { year: "numeric", month: "2-digit", day: "2-digit" }),
    hour: "2-digit", minute: "2-digit",
  });
}
