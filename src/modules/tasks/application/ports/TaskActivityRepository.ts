import type { Activity, Task, TaskActivitySnapshot } from "../../domain/model/task.types";

export interface LeadHandoverTaskSnapshotCommand {
  workspaceId: string;
  leadId: string;
  leadLabel: string;
  handoverId: string;
  nextOwnerId: string;
  reason: string;
  dueAt: string;
  actorId: string;
  now: string;
}
export interface LeadHandoverTaskSnapshotProof {
  reassignedTaskIds: string[];
  handoverTaskId: string;
  handoverTaskVersion: number;
}

export interface TaskActivityRepository {
  handoverLeadTasks?(command: LeadHandoverTaskSnapshotCommand, onCommitted: (proof: LeadHandoverTaskSnapshotProof) => void): void;
  snapshot(): TaskActivitySnapshot;
  listTasks(): Task[];
  listActivities(): Activity[];
  findTaskById(taskId: string): Task | undefined;
  findTaskByDedupeKey(dedupeKey: string): Task | undefined;
  saveTask(task: Task): Task;
  saveActivity(activity: Activity): Activity;
  replace(snapshot: TaskActivitySnapshot): void;
  subscribe(listener: (snapshot: TaskActivitySnapshot) => void): () => void;
}
