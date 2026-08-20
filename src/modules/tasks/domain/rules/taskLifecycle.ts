import type { TaskStatus } from "../model/task.types";

const TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  OPEN: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransitionTask(from: TaskStatus, to: TaskStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function getAllowedTaskTransitions(status: TaskStatus): readonly TaskStatus[] {
  return TRANSITIONS[status];
}
