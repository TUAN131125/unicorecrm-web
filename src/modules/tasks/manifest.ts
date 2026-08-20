import type { FrontendModuleManifest } from "@/platform/module-registry";
import { ROUTE_KEYS } from "@/platform/navigation";

export const TASK_ACTIVITY_MODULE_MANIFEST: FrontendModuleManifest = {
  key: "tasks",
  workspace: "crm",
  routes: [
    { id: "tasks.list", path: ROUTE_KEYS.TASKS },
    { id: "tasks.detail", path: ROUTE_KEYS.TASK_DETAIL },
  ],
  navigation: [{ id: "tasks", path: ROUTE_KEYS.TASKS, labelKey: "nav.tasks", order: 12 }],
};
