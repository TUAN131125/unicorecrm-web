import { createApplicationServiceBinding } from "@/shared/application";
import type { EffectiveRecordAccessAuthority } from "./effectiveRecordAccess";

const binding = createApplicationServiceBinding<EffectiveRecordAccessAuthority>("Effective record access authority");

export const configureEffectiveRecordAccessAuthority = binding.configure;
export const getEffectiveRecordAccessAuthority = binding.get;
export const resetEffectiveRecordAccessAuthority = binding.reset;
export const isEffectiveRecordAccessAuthorityConfigured = binding.isConfigured;
