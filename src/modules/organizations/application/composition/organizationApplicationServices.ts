import { createApplicationServiceBinding } from "@/shared/application";
import type { OrganizationAccountRepository } from "../ports/OrganizationAccountRepository";
import type { OrganizationApiRuntime } from "../ports/OrganizationApiRuntime";

export interface OrganizationApplicationServices {
  repository: OrganizationAccountRepository;
  api: OrganizationApiRuntime;
}

const binding = createApplicationServiceBinding<OrganizationApplicationServices>("Organizations");
export const configureOrganizationApplication = binding.configure;
export const getOrganizationApplicationServices = binding.get;
export const resetOrganizationApplication = binding.reset;

import { createApplicationServiceProxy } from "@/shared/application";
export const organizationAccountRepository = createApplicationServiceProxy(() => binding.get().repository);

export function getOrganizationApiRuntime(): OrganizationApiRuntime { return binding.get().api; }
export function isOrganizationConnectedApiRuntime(): boolean { return binding.get().api.mode === "connected"; }
