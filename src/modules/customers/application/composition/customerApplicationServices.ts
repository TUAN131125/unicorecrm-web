import { createApplicationServiceBinding } from "@/shared/application";
import type { CustomerRepository } from "../ports/CustomerRepository";
import type { CustomerRuntimePort } from "../ports/CustomerRuntimePort";
import type { CustomerApiRuntime } from "../ports/CustomerApiRuntime";

export interface CustomerApplicationServices {
  repository: CustomerRepository;
  runtime: CustomerRuntimePort;
  api: CustomerApiRuntime;
}

const binding = createApplicationServiceBinding<CustomerApplicationServices>("Customers");
export const configureCustomerApplication = binding.configure;
export const getCustomerApplicationServices = binding.get;
export const resetCustomerApplication = binding.reset;

import { createApplicationServiceProxy } from "@/shared/application";
export const customerRepository = createApplicationServiceProxy(() => binding.get().repository);
export const ensureCustomerRepositoryReady = () => binding.get().runtime.ensureReady();
export const reconcileCustomerRepositoryFromPurchaseEvidence = (now?: string) => binding.get().runtime.reconcileFromPurchaseEvidence(now);
export const getCustomerMigrationProfileRuntime = (ref: Parameters<CustomerRuntimePort["getMigrationProfile"]>[0]) => binding.get().runtime.getMigrationProfile(ref);

export function getCustomerApiRuntime(): CustomerApiRuntime { return binding.get().api; }
export function isCustomerConnectedApiRuntime(): boolean { return binding.get().api.mode === "connected"; }
