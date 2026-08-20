import type { Activity, Task, TaskActivitySnapshot } from "../../domain/model/task.types";

export interface TaskActivityRepository {
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
