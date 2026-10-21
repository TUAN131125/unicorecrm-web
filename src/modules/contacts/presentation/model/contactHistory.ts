import type { EffectiveAccess } from "@/platform/access-control";
import type { Activity } from "@/modules/tasks";

// Mirrors the existing Tasks Activity fail-closed boundary; this never grants access.
const taskFields = ["id", "title", "status", "priority", "assigneeId", "dueAt", "createdAt", "updatedAt", "resourceVersion", "description", "completedAt", "cancelledAt", "cancellationReason", "outcome", "relationshipRef", "recordRef", "sourceRef", "archivedAt", "archiveReason"];
export function isContactActivitySourceReachable(access: EffectiveAccess): boolean {
  return access.getDataScope("tasks") === "WORKSPACE" && taskFields.every(field => access.getFieldAccess("tasks", field) === "READ_WRITE");
}

export const contactHistoryTypes = ["CALL", "EMAIL", "MESSAGE", "MEETING", "NOTE", "SYSTEM"] as const;
export function contactHistoryTypeLabel(type: Activity["type"], vi: boolean): string {
  const labels = {
    CALL: ["Ghi nhận cuộc gọi", "Call log"], EMAIL: ["Email ghi nhận thủ công", "Manual email log"],
    MESSAGE: ["Tin nhắn ghi nhận thủ công", "Manual message log"], MEETING: ["Ghi nhận lịch hẹn", "Meeting log"],
    NOTE: ["Ghi chú", "Note"], SYSTEM: ["Hoạt động hệ thống", "System activity"],
  };
  return labels[type][vi ? 0 : 1];
}

export function mergeContactHistory(previous: readonly Activity[], incoming: readonly Activity[], recordId: string): Activity[] {
  const items = new Map(previous.map(item => [item.id, item]));
  for (const item of incoming) {
    if (item.recordRef?.moduleKey !== "contacts" || item.recordRef.recordId !== recordId) continue;
    items.set(item.id, item);
  }
  return [...items.values()].sort((a, b) => {
    const left = Date.parse(a.occurredAt), right = Date.parse(b.occurredAt);
    return (Number.isFinite(right) ? right : -Infinity) - (Number.isFinite(left) ? left : -Infinity) || b.id.localeCompare(a.id);
  });
}
