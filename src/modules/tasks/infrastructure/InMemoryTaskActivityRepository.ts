import type { StoragePort } from "@/platform/persistence";
import type { TaskActivityRepository } from "../application/ports/TaskActivityRepository";
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
