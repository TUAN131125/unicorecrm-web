import { createApplicationServiceBinding } from "@/shared/application";
import type { AuditTrailAuthority } from "./auditTrail";

const binding = createApplicationServiceBinding<AuditTrailAuthority>("Audit trail authority");

export const configureAuditTrailAuthority = binding.configure;
export const getAuditTrailAuthority = binding.get;
export const resetAuditTrailAuthority = binding.reset;
export const isAuditTrailAuthorityConfigured = binding.isConfigured;
