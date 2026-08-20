import { BrowserStorageAdapter } from "@/platform/persistence";
import { createWorkspaceScopedRepository } from "@/platform/workspace-scope/createWorkspaceScopedRepository";
import { WorkspaceScopedStorageAdapter } from "@/platform/workspace-scope/WorkspaceScopedStorageAdapter";
import type { TaskActivitySnapshot } from "../domain/model/task.types";
import { InMemoryTaskActivityRepository } from "../infrastructure/InMemoryTaskActivityRepository";

const storage = new BrowserStorageAdapter();
const EMPTY_TASK_ACTIVITY: TaskActivitySnapshot = { tasks: [], activities: [] };
const LEGACY_DEMO_TASK_IDS = new Set(["task_lead_first_contact_seed", "task_deal_next_action_seed"]);
const LEGACY_DEMO_ACTIVITY_IDS = new Set(["activity_seed_call"]);

function migrateLegacyDemoSnapshot(snapshot: TaskActivitySnapshot): TaskActivitySnapshot {
  return {
    tasks: snapshot.tasks.filter((task) => !LEGACY_DEMO_TASK_IDS.has(task.id)),
    activities: snapshot.activities.filter((activity) => !LEGACY_DEMO_ACTIVITY_IDS.has(activity.id)),
  };
}

export const taskActivityRepository = createWorkspaceScopedRepository({
  resourceKey: "tasks",
  createRepository: (workspaceId) => {
    const scopedStorage = new WorkspaceScopedStorageAdapter(storage, workspaceId, "tasks");
    const stored = scopedStorage.get<TaskActivitySnapshot>("snapshot");
    const migrated = migrateLegacyDemoSnapshot(stored ?? EMPTY_TASK_ACTIVITY);
    if (stored && (migrated.tasks.length !== stored.tasks.length || migrated.activities.length !== stored.activities.length)) {
      scopedStorage.set("snapshot", migrated);
    }
    return new InMemoryTaskActivityRepository(migrated, scopedStorage);
  },
});
