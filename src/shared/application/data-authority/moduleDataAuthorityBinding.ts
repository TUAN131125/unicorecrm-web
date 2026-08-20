import { createApplicationServiceBinding } from "../applicationServiceBinding";
import type { ModuleDataAuthorityKey, ModuleDataAuthorityRegistry } from "./moduleDataAuthority";

const binding = createApplicationServiceBinding<ModuleDataAuthorityRegistry>("Module data authority");

export const configureModuleDataAuthorityRegistry = binding.configure;
export const getModuleDataAuthorityRegistry = binding.get;
export const resetModuleDataAuthorityRegistry = binding.reset;
export const isModuleDataAuthorityRegistryConfigured = binding.isConfigured;

export function getModuleDataAuthority(key: ModuleDataAuthorityKey) {
  return binding.get()[key];
}
