import { createApplicationServiceBinding, createApplicationServiceProxy } from "@/shared/application";
import type { SupportApiRuntime } from "../ports/SupportApiRuntime";
import type { SupportCaseRepository } from "../ports/SupportCaseRepository";

export interface SupportApplicationServices {
  repository: SupportCaseRepository;
  api: SupportApiRuntime;
}
const binding = createApplicationServiceBinding<SupportApplicationServices>("Support");
export const configureSupportApplication = binding.configure;
export const getSupportApplicationServices = binding.get;
export const resetSupportApplication = binding.reset;
export const supportCaseRepository = createApplicationServiceProxy(() => binding.get().repository);
export function getSupportApiRuntime(): SupportApiRuntime { return binding.get().api; }
export function isSupportConnectedApiRuntime(): boolean { return binding.get().api.mode === "connected"; }
