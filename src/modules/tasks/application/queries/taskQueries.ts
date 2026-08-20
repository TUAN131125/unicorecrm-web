import type { TaskActivityRepository, } from "../ports/TaskActivityRepository";
import type { Activity, Task, TaskActivitySnapshot } from "../../domain/model/task.types";

function sourceSnapshot(source: TaskActivityRepository | TaskActivitySnapshot): TaskActivitySnapshot {
  return "snapshot" in source ? source.snapshot() : source;
}

export function queryTasks(source: TaskActivityRepository | TaskActivitySnapshot, input: { search?: string; status?: string; assigneeId?: string; priority?: string } = {}): Task[] {
  const search = input.search?.trim().toLowerCase() ?? "";
  return sourceSnapshot(source).tasks
    .filter((task) => !input.status || input.status === "ALL" || task.status === input.status)
    .filter((task) => !input.assigneeId || input.assigneeId === "ALL" || task.assigneeId === input.assigneeId)
    .filter((task) => !input.priority || input.priority === "ALL" || task.priority === input.priority)
    .filter((task) => !search || [task.title, task.description, task.recordRef?.label, task.assigneeId].filter(Boolean).some((value) => String(value).toLowerCase().includes(search)))
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

export function getOverdueTasks(source: TaskActivityRepository | TaskActivitySnapshot, now = new Date()): Task[] {
  return sourceSnapshot(source).tasks.filter((task) => task.status === "OPEN" && new Date(task.dueAt).getTime() < now.getTime());
}

export function getTasksForRecord(source: TaskActivityRepository | TaskActivitySnapshot, moduleKey: string, recordId: string): Task[] {
  return sourceSnapshot(source).tasks.filter((task) => task.recordRef?.moduleKey === moduleKey && task.recordRef.recordId === recordId);
}

export function getActivitiesForRecord(source: TaskActivityRepository | TaskActivitySnapshot, moduleKey: string, recordId: string): Activity[] {
  return sourceSnapshot(source).activities.filter((activity) => activity.recordRef?.moduleKey === moduleKey && activity.recordRef.recordId === recordId).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export function getTaskStats(source: TaskActivityRepository | TaskActivitySnapshot): { open: number; overdue: number; completed: number; cancelled: number } {
  const snapshot = sourceSnapshot(source);
  return {
    open: snapshot.tasks.filter((task) => task.status === "OPEN").length,
    overdue: getOverdueTasks(snapshot).length,
    completed: snapshot.tasks.filter((task) => task.status === "COMPLETED").length,
    cancelled: snapshot.tasks.filter((task) => task.status === "CANCELLED").length,
  };
}

export function getTasksForCustomer(source: TaskActivityRepository | TaskActivitySnapshot, customerId: string): Task[] {
  return sourceSnapshot(source).tasks.filter((task) => task.customerId === customerId).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

export function getActivitiesForCustomer(source: TaskActivityRepository | TaskActivitySnapshot, customerId: string): Activity[] {
  return sourceSnapshot(source).activities.filter((activity) => activity.customerId === customerId).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}
