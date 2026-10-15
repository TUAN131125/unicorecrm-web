import type { createTaskCommand } from "../../public/api";
export interface TaskCreateIntent {
  readonly command: Parameters<typeof createTaskCommand>[0];
  readonly metadata: Parameters<typeof createTaskCommand>[1];
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
}
export function freezeTaskCreateIntent(command: TaskCreateIntent["command"], metadata: TaskCreateIntent["metadata"]): TaskCreateIntent {
  return freeze(structuredClone({ command, metadata }));
}
export function taskCreateDefinitelyRejected(code: string, previouslyUncertain = false): boolean {
  return !previouslyUncertain && ["VALIDATION_FAILED", "ACCESS_DENIED", "RESOURCE_NOT_FOUND", "AUTHENTICATION_REQUIRED"].includes(code);
}
