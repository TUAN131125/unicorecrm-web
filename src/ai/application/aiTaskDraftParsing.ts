/**
 * Natural-language parsing for the conversational CREATE_TASK draft.
 *
 * Pure text analysis only. It produces the fields of a typed CREATE_TASK intent;
 * it never touches Task state and never decides whether the action is allowed.
 */
import type { AiTaskIntentPriority } from "./aiActionIntent";

export type AiTaskDraftStep = "title" | "due" | "assignee" | "confirm";

export interface AiTaskDraft {
  title?: string;
  dueAt?: string;
  assigneeId?: string;
  assigneeName?: string;
  description?: string;
  priority: AiTaskIntentPriority;
  step: AiTaskDraftStep;
}

const normalize = (value: string): string => value.trim().toLowerCase();

export const isCreateTaskUtterance = (value: string): boolean =>
  /\b(tạo|thêm|lập|create|add)\b.*\b(công việc|task)\b/i.test(value);

export const isCancelUtterance = (value: string): boolean =>
  /^(hủy|huỷ|bỏ|cancel|stop|không tạo)$/i.test(value.trim());

export const isConfirmUtterance = (value: string): boolean =>
  /^(xác nhận|đồng ý|tạo đi|ok|okay|yes|confirm|create)$/i.test(value.trim());

export function parseTaskPriority(text: string): AiTaskIntentPriority {
  const value = normalize(text);
  if (/khẩn|urgent|critical/.test(value)) return "URGENT";
  if (/ưu tiên cao|\bhigh\b/.test(value)) return "HIGH";
  if (/ưu tiên thấp|\blow\b/.test(value)) return "LOW";
  return "NORMAL";
}

export function parseTaskTitle(text: string): string | undefined {
  const quoted = text.match(/["“](.+?)["”]/)?.[1]?.trim();
  if (quoted) return quoted;
  const afterColon = text.split(":").slice(1).join(":").trim();
  if (afterColon) return afterColon.replace(/\s+(hạn|vào|cho|giao)\b.*$/i, "").trim() || undefined;
  const match = text.match(/(?:tạo|thêm|lập|create|add)\s+(?:một\s+)?(?:công việc|task)(?:\s+mới)?(?:\s+(?:tên|về|là))?\s+(.+?)(?=\s+(?:hạn|vào|cho|giao|due|assign)\b|$)/i);
  const title = match?.[1]?.trim();
  if (!title || /^(mới|new)$/i.test(title)) return undefined;
  return title;
}

export function parseTaskDueAt(text: string, now: Date = new Date()): string | undefined {
  const value = normalize(text);
  const timeMatch = value.match(/(?:lúc|at)?\s*(\d{1,2})(?::|h)(\d{2})?/i);
  const hour = Math.min(23, Number(timeMatch?.[1] ?? 9));
  const minute = Math.min(59, Number(timeMatch?.[2] ?? 0));

  if (/ngày mai|tomorrow/.test(value)) {
    const date = new Date(now);
    date.setDate(date.getDate() + 1);
    date.setHours(hour, minute, 0, 0);
    return date.toISOString();
  }
  if (/hôm nay|today/.test(value)) {
    const date = new Date(now);
    date.setHours(timeMatch ? hour : Math.min(23, now.getHours() + 1), minute, 0, 0);
    if (date.getTime() <= now.getTime()) date.setHours(now.getHours() + 1, 0, 0, 0);
    return date.toISOString();
  }
  const relative = value.match(/sau\s+(\d+)\s*(giờ|tiếng|hour|hours|ngày|day|days)/i);
  if (relative?.[1] && relative[2]) {
    const count = Number(relative[1]);
    const date = new Date(now);
    if (/ngày|day/.test(relative[2])) date.setDate(date.getDate() + count);
    else date.setHours(date.getHours() + count);
    return date.toISOString();
  }
  const dateMatch = value.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2})(?::|h)(\d{2})?)?/);
  if (dateMatch) {
    const date = new Date(
      Number(dateMatch[3]),
      Number(dateMatch[2]) - 1,
      Number(dateMatch[1]),
      Number(dateMatch[4] ?? 9),
      Number(dateMatch[5] ?? 0),
      0,
      0,
    );
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }
  return undefined;
}

export function parseTaskDraftFromUtterance(text: string, now?: Date): AiTaskDraft {
  return {
    ...(parseTaskTitle(text) === undefined ? {} : { title: parseTaskTitle(text) }),
    ...(parseTaskDueAt(text, now) === undefined ? {} : { dueAt: parseTaskDueAt(text, now) }),
    priority: parseTaskPriority(text),
    step: "title",
  };
}
