import type { EnterpriseSessionPolicy } from "./enterpriseSecurity.types";

export const ENTERPRISE_SESSION_POLICY: EnterpriseSessionPolicy = Object.freeze({
  idleTimeoutMinutes: 30,
  absoluteTimeoutHours: 12,
  mfaChallengeMinutes: 5,
  maxMfaAttempts: 5,
  requireMfaForAdministrativeAccounts: true,
});

export function validateEnterpriseSessionPolicy(policy: EnterpriseSessionPolicy): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(policy.idleTimeoutMinutes) || policy.idleTimeoutMinutes < 5) errors.push("Idle timeout must be at least five minutes.");
  if (!Number.isInteger(policy.absoluteTimeoutHours) || policy.absoluteTimeoutHours < 1) errors.push("Absolute timeout must be at least one hour.");
  if (policy.absoluteTimeoutHours * 60 <= policy.idleTimeoutMinutes) errors.push("Absolute timeout must exceed idle timeout.");
  if (!Number.isInteger(policy.mfaChallengeMinutes) || policy.mfaChallengeMinutes < 1) errors.push("MFA challenge lifetime must be positive.");
  if (!Number.isInteger(policy.maxMfaAttempts) || policy.maxMfaAttempts < 1 || policy.maxMfaAttempts > 10) errors.push("MFA attempts must be between one and ten.");
  return errors;
}
