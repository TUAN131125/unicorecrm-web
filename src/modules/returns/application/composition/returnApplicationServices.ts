import { createApplicationServiceBinding } from "@/shared/application";
import type { ReturnApiRuntime } from "../ports/ReturnApiRuntime";
import type { ReturnRepository } from "../ports/ReturnRepository";

export interface ReturnApplicationServices { repository: ReturnRepository; api: ReturnApiRuntime; }
const binding = createApplicationServiceBinding<ReturnApplicationServices>("Returns");
export const configureReturnApplication = binding.configure;
export const getReturnApplicationServices = binding.get;
export const resetReturnApplication = binding.reset;

import { createApplicationServiceProxy } from "@/shared/application";
export const returnRepository = createApplicationServiceProxy(() => binding.get().repository);
export const getReturnApiRuntime = (): ReturnApiRuntime => binding.get().api;
