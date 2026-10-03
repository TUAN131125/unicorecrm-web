import type { StoragePort } from "@/platform/persistence";
import { CAPABILITIES, assertRuntimeCapability, assertRuntimeCommandAccess, assertRuntimeWorkspaceAccess } from "@/platform/access-control/authorization";
import { getFieldAccess } from "@/platform/access-control/runtime/accessControlRuntime";
import { createTask, reassignTask } from "../application/commands/taskCommands";
import type { LeadHandoverTaskSnapshotCommand, LeadHandoverTaskSnapshotProof, TaskActivityRepository } from "../application/ports/TaskActivityRepository";
import type { Activity, Task, TaskActivitySnapshot } from "../domain/model/task.types";

export class InMemoryTaskActivityRepository implements TaskActivityRepository {
  private state: TaskActivitySnapshot;
  private readonly listeners = new Set<(snapshot: TaskActivitySnapshot) => void>();

  constructor(seed: TaskActivitySnapshot, private readonly storage?: StoragePort) {
    this.state = structuredClone(storage?.get<TaskActivitySnapshot>("snapshot") ?? seed);
  }
  snapshot(): TaskActivitySnapshot { return structuredClone(this.state); }
  listTasks(): Task[] { return structuredClone(this.state.tasks); }
  listActivities(): Activity[] { return structuredClone(this.state.activities); }
  findTaskById(taskId: string): Task | undefined { const found = this.state.tasks.find((task) => task.id === taskId); return found ? structuredClone(found) : undefined; }
  findTaskByDedupeKey(dedupeKey: string): Task | undefined { const found = this.state.tasks.find((task) => task.dedupeKey === dedupeKey); return found ? structuredClone(found) : undefined; }
  // This admitted demo participant uses Tasks-owned retained state. Read projections
  // after reassignment cannot turn its committed result into a hidden-record failure.
  handoverLeadTasks(command: LeadHandoverTaskSnapshotCommand, onCommitted: (proof: LeadHandoverTaskSnapshotProof) => void): void {
    assertRuntimeWorkspaceAccess(command.workspaceId);
    assertRuntimeCapability(CAPABILITIES.TASKS_CREATE);
    assertRuntimeCapability(CAPABILITIES.TASKS_ASSIGN);
    for (const field of ["title", "priority", "assigneeId", "dueAt", "recordRef", "sourceRef"]) {
      if (getFieldAccess("tasks", field) !== "READ_WRITE") throw new Error(`Task ${field} is not writable.`);
    }
    const eligible = this.state.tasks.filter(task => task.workspaceId === command.workspaceId
      && task.status === "OPEN" && !task.archivedAt && task.recordRef?.moduleKey === "leads"
      && task.recordRef.recordId === command.leadId).sort((a, b) => a.id.localeCompare(b.id));
    for (const task of eligible) assertRuntimeCommandAccess(CAPABILITIES.TASKS_ASSIGN, "tasks", task);
    const before = this.snapshot();
    try {
      for (const task of eligible) reassignTask(this, task.id, {
        assigneeId: command.nextOwnerId, actorId: command.actorId, now: command.now,
      });
      const takeover = createTask(this, {
        id: `task_${command.handoverId}`, workspaceId: command.workspaceId,
        title: command.reason.trim().slice(0, 300), priority: "NORMAL", assigneeId: command.nextOwnerId,
        dueAt: command.dueAt, recordRef: { moduleKey: "leads", recordId: command.leadId, label: command.leadLabel },
        sourceRef: { type: "LEAD_HANDOVER", id: command.handoverId, evidence: command.reason.trim() },
        dedupeKey: command.handoverId, actorId: command.actorId, now: command.now,
      });
      onCommitted({ reassignedTaskIds: eligible.map(task => task.id), handoverTaskId: takeover.id,
        handoverTaskVersion: takeover.resourceVersion ?? 0 });
    } catch (failure) {
      this.replace(before);
      throw failure;
    }
  }

  saveTask(task: Task): Task {
    this.state.tasks = [structuredClone(task), ...this.state.tasks.filter((item) => item.id !== task.id)];
    this.commit();
    return structuredClone(task);
  }
  saveActivity(activity: Activity): Activity {
    this.state.activities = [structuredClone(activity), ...this.state.activities.filter((item) => item.id !== activity.id)];
    this.commit();
    return structuredClone(activity);
  }
  replace(snapshot: TaskActivitySnapshot): void { this.state = structuredClone(snapshot); this.commit(); }
  subscribe(listener: (snapshot: TaskActivitySnapshot) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private commit(): void {
    this.storage?.set("snapshot", this.state);
    const snapshot = this.snapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}
