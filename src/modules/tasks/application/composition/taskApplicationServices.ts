import { createApplicationServiceBinding, createApplicationServiceProxy } from "@/shared/application";
import type { TaskApiRuntime } from "../ports/TaskApiRuntime";
import type { TaskActivityRepository } from "../ports/TaskActivityRepository";

export interface TaskApplicationServices {
  repository: TaskActivityRepository;
  api: TaskApiRuntime;
}

const binding = createApplicationServiceBinding<TaskApplicationServices>("Tasks");
export const configureTaskApplication = binding.configure;
export const getTaskApplicationServices = binding.get;
export const resetTaskApplication = binding.reset;
export const taskActivityRepository = createApplicationServiceProxy(() => binding.get().repository);
export function getTaskApiRuntime(): TaskApiRuntime { return binding.get().api; }
export function isTaskConnectedApiRuntime(): boolean { return binding.get().api.mode === "connected"; }
