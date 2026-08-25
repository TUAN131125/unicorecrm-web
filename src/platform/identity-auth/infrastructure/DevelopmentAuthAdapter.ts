import { ENTERPRISE_SESSION_POLICY } from "@/platform/enterprise-security";
import { BrowserStorageAdapter } from "@/platform/persistence";
import type { AuthGateway } from "../application/AuthGateway";
import type {
  AuthFailureCode,
  AuthResult,
  AuthSession,
  EmailVerificationRequestAccepted,
  ProvisionUserAccountCommand,
  ProvisionedUserAccount,
  RegisterCommand,
  SignInCommand,
  UserAccount,
  VerifyEmailCommand,
  VerifyMfaCommand,
} from "../domain/auth.types";

import {
  DEVELOPMENT_ACCOUNTS,
  DEVELOPMENT_EMAIL_VERIFICATION_CODE,
  DEVELOPMENT_MFA_CODE,
  type DevelopmentAccountDescriptor,
} from "../development/developmentIdentityCatalog";

export type { DevelopmentAccountDescriptor } from "../development/developmentIdentityCatalog";
export { DEVELOPMENT_ACCOUNTS } from "../development/developmentIdentityCatalog";

const PROVISIONED_ACCOUNTS_KEY = "unicore_development_provisioned_accounts_v1";
const accountStorage = new BrowserStorageAdapter();

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function listProvisionedAccounts(): DevelopmentAccountDescriptor[] {
  const stored = accountStorage.get<DevelopmentAccountDescriptor[]>(PROVISIONED_ACCOUNTS_KEY);
  if (!Array.isArray(stored)) return [];
  return stored.map((account) => ({ ...account }));
}

function saveProvisionedAccounts(accounts: DevelopmentAccountDescriptor[]): void {
  accountStorage.set(PROVISIONED_ACCOUNTS_KEY, accounts.map((account) => ({ ...account })));
}

export function listDevelopmentAccountDescriptors(): DevelopmentAccountDescriptor[] {
  return [...DEVELOPMENT_ACCOUNTS.map((account) => ({ ...account })), ...listProvisionedAccounts()];
}

function randomIndex(max: number): number {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const value = new Uint32Array(1);
    crypto.getRandomValues(value);
    return value[0] % max;
  }
  return Math.floor(Math.random() * max);
}

export function generateTemporaryPassword(length = 14): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const numbers = "23456789";
  const symbols = "!@#$%";
  const all = `${upper}${lower}${numbers}${symbols}`;
  const chars = [
    upper[randomIndex(upper.length)],
    lower[randomIndex(lower.length)],
    numbers[randomIndex(numbers.length)],
    symbols[randomIndex(symbols.length)],
  ];
  while (chars.length < Math.max(10, length)) chars.push(all[randomIndex(all.length)]);
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swap = randomIndex(index + 1);
    [chars[index], chars[swap]] = [chars[swap], chars[index]];
  }
  return chars.join("");
}

function validateInitialPassword(password: string): void {
  if (password.length < 10) throw new Error("Initial password must contain at least 10 characters.");
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    throw new Error("Initial password must include uppercase, lowercase, and numeric characters.");
  }
}

export function provisionDevelopmentAccount(command: ProvisionUserAccountCommand): ProvisionedUserAccount {
  const email = normalizeEmail(command.email);
  const displayName = command.displayName.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("A valid work email is required.");
  if (!displayName) throw new Error("Employee display name is required.");
  if (listDevelopmentAccountDescriptors().some((account) => normalizeEmail(account.email) === email)) {
    throw new Error("An account already exists for this email.");
  }

  const temporaryPassword = command.initialPassword?.trim() || generateTemporaryPassword();
  validateInitialPassword(temporaryPassword);
  const now = new Date().toISOString();
  const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const account: DevelopmentAccountDescriptor = {
    accountId: `acct_provisioned_${unique}`,
    memberId: `member_provisioned_${unique}`,
    email,
    password: temporaryPassword,
    displayName,
    roleLabel: "Workspace employee",
    status: "ACTIVE",
    provisionedAt: now,
    provisionedByAccountId: command.provisionedByAccountId,
  };
  saveProvisionedAccounts([account, ...listProvisionedAccounts()]);
  return {
    account: {
      accountId: account.accountId,
      memberId: account.memberId,
      email: account.email,
      displayName: account.displayName,
      status: "ACTIVE",
      createdAt: now,
      provisionedAt: now,
    },
    temporaryPassword,
  };
}

export function removeProvisionedDevelopmentAccount(accountId: string): void {
  const current = listProvisionedAccounts();
  saveProvisionedAccounts(current.filter((account) => account.accountId !== accountId));
}

export function rotateProvisionedDevelopmentAccountPassword(accountId: string): string {
  const current = listProvisionedAccounts();
  const target = current.find((account) => account.accountId === accountId);
  if (!target) throw new Error("Only directly provisioned development accounts can receive a new temporary password.");
  const temporaryPassword = generateTemporaryPassword();
  saveProvisionedAccounts(current.map((account) => account.accountId === accountId ? { ...account, password: temporaryPassword } : account));
  return temporaryPassword;
}

export function isProvisionedDevelopmentAccount(accountId?: string): boolean {
  return Boolean(accountId && listProvisionedAccounts().some((account) => account.accountId === accountId));
}

const nowIso = () => new Date().toISOString();
const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60_000).toISOString();
const addHours = (date: Date, hours: number) => new Date(date.getTime() + hours * 3_600_000).toISOString();

const REVOKED_SESSIONS_KEY = "unicore_development_revoked_sessions_v1";
const ACCOUNT_REVOCATIONS_KEY = "unicore_development_account_revocations_v1";

interface DevelopmentMfaChallenge {
  challengeId: string;
  accountId: string;
  deviceLabel: string;
  createdAt: string;
  expiresAt: string;
  attempts: number;
  consumedAt?: string;
}

const mfaChallenges = new Map<string, DevelopmentMfaChallenge>();
let revokedSessionsMemory: Record<string, string> = {};
let accountRevocationsMemory: Record<string, string> = {};

function readRevokedSessions(): Record<string, string> {
  return { ...revokedSessionsMemory, ...(accountStorage.get<Record<string, string>>(REVOKED_SESSIONS_KEY) ?? {}) };
}

function writeRevokedSessions(value: Record<string, string>): void {
  revokedSessionsMemory = { ...value };
  accountStorage.set(REVOKED_SESSIONS_KEY, value);
}

function readAccountRevocations(): Record<string, string> {
  return { ...accountRevocationsMemory, ...(accountStorage.get<Record<string, string>>(ACCOUNT_REVOCATIONS_KEY) ?? {}) };
}

function writeAccountRevocations(value: Record<string, string>): void {
  accountRevocationsMemory = { ...value };
  accountStorage.set(ACCOUNT_REVOCATIONS_KEY, value);
}

function fail<T>(code: AuthFailureCode, message: string, details: { challengeId?: string; challengeExpiresAt?: string } = {}): AuthResult<T> {
  return { ok: false, code, message, ...details };
}

function buildSession(account: DevelopmentAccountDescriptor, deviceLabel: string, assuranceLevel: "AAL1" | "AAL2", now = new Date()): AuthSession {
  return {
    sessionId: `dev_session_${account.accountId}_${now.getTime()}_${Math.random().toString(36).slice(2, 7)}`,
    principal: {
      accountId: account.accountId,
      memberId: account.memberId,
      email: account.email,
      displayName: account.displayName,
    },
    status: "ACTIVE",
    issuedAt: now.toISOString(),
    lastSeenAt: now.toISOString(),
    idleExpiresAt: addMinutes(now, ENTERPRISE_SESSION_POLICY.idleTimeoutMinutes),
    absoluteExpiresAt: addHours(now, ENTERPRISE_SESSION_POLICY.absoluteTimeoutHours),
    refreshCounter: 0,
    assuranceLevel,
    mfaVerifiedAt: assuranceLevel === "AAL2" ? now.toISOString() : undefined,
    device: {
      deviceId: `dev_device_${account.accountId}`,
      label: deviceLabel || "Development browser",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "node",
      lastSeenAt: now.toISOString(),
    },
  };
}

function accountById(accountId: string): DevelopmentAccountDescriptor | undefined {
  return listDevelopmentAccountDescriptors().find((account) => account.accountId === accountId);
}

/** Demo-only affordance: the fixed code the demo adapter accepts. */
export function getDevelopmentEmailVerificationCode(): string {
  return DEVELOPMENT_EMAIL_VERIFICATION_CODE;
}

export function getDevelopmentMfaCodeHint(challengeId: string): string | undefined {
  const challenge = mfaChallenges.get(challengeId);
  if (!challenge || challenge.consumedAt || Date.now() >= new Date(challenge.expiresAt).getTime()) return undefined;
  return DEVELOPMENT_MFA_CODE;
}

export class DevelopmentAuthAdapter implements AuthGateway {
  signIn(command: SignInCommand): AuthResult<AuthSession> {
    const account = listDevelopmentAccountDescriptors().find(
      (candidate) => candidate.email.toLowerCase() === command.email.trim().toLowerCase() && candidate.password === command.password,
    );
    if (!account) return fail("INVALID_CREDENTIALS", "Email or password is incorrect.");
    if (account.status === "SUSPENDED") return fail("ACCOUNT_SUSPENDED", "Account is suspended.");

    const deviceLabel = command.deviceLabel || "Development browser";
    if (account.mfaRequired && ENTERPRISE_SESSION_POLICY.requireMfaForAdministrativeAccounts) {
      const now = new Date();
      const challenge: DevelopmentMfaChallenge = {
        challengeId: `dev_mfa_${account.accountId}_${now.getTime()}_${Math.random().toString(36).slice(2, 7)}`,
        accountId: account.accountId,
        deviceLabel,
        createdAt: now.toISOString(),
        expiresAt: addMinutes(now, ENTERPRISE_SESSION_POLICY.mfaChallengeMinutes),
        attempts: 0,
      };
      mfaChallenges.set(challenge.challengeId, challenge);
      return fail("MFA_REQUIRED", "Multi-factor authentication is required.", {
        challengeId: challenge.challengeId,
        challengeExpiresAt: challenge.expiresAt,
      });
    }

    return { ok: true, value: buildSession(account, deviceLabel, "AAL1") };
  }

  verifyMfa(command: VerifyMfaCommand): AuthResult<AuthSession> {
    const challenge = mfaChallenges.get(command.challengeId);
    if (!challenge || challenge.consumedAt) return fail("MFA_INVALID", "MFA challenge is invalid.");
    if (Date.now() >= new Date(challenge.expiresAt).getTime()) return fail("MFA_EXPIRED", "MFA challenge has expired.");
    if (challenge.attempts >= ENTERPRISE_SESSION_POLICY.maxMfaAttempts) return fail("MFA_LOCKED", "MFA challenge is locked.");
    challenge.attempts += 1;
    if (command.code.trim() !== DEVELOPMENT_MFA_CODE) {
      mfaChallenges.set(challenge.challengeId, challenge);
      return fail(challenge.attempts >= ENTERPRISE_SESSION_POLICY.maxMfaAttempts ? "MFA_LOCKED" : "MFA_INVALID", "MFA code is incorrect.");
    }
    const account = accountById(challenge.accountId);
    if (!account || account.status === "SUSPENDED") return fail("ACCOUNT_SUSPENDED", "Account is suspended.");
    challenge.consumedAt = new Date().toISOString();
    mfaChallenges.set(challenge.challengeId, challenge);
    return { ok: true, value: buildSession(account, command.deviceLabel || challenge.deviceLabel, "AAL2") };
  }

  validateSession(session: AuthSession): AuthResult<AuthSession> {
    if (session.status === "REVOKED") return fail("SESSION_REVOKED", "Session has been revoked.");
    const revokedAt = readRevokedSessions()[session.sessionId];
    if (revokedAt) return fail("SESSION_REVOKED", "Session has been revoked.");
    const accountRevokedAt = readAccountRevocations()[session.principal.accountId];
    if (accountRevokedAt && new Date(session.issuedAt).getTime() <= new Date(accountRevokedAt).getTime()) {
      return fail("SESSION_REVOKED", "All sessions for this account were revoked.");
    }
    const account = accountById(session.principal.accountId);
    if (!account || account.status === "SUSPENDED") return fail("ACCOUNT_SUSPENDED", "Account is suspended.");
    const now = Date.now();
    if (now >= new Date(session.idleExpiresAt).getTime() || now >= new Date(session.absoluteExpiresAt).getTime()) {
      return fail("SESSION_EXPIRED", "Session timeout has elapsed.");
    }
    if (account.mfaRequired && session.assuranceLevel !== "AAL2") return fail("SESSION_REVOKED", "Administrative session does not meet the MFA assurance policy.");
    return { ok: true, value: session };
  }

  signOut(sessionId: string): void {
    this.revokeSession(sessionId, "USER_SIGN_OUT");
  }

  refreshSession(session: AuthSession): AuthResult<AuthSession> {
    const valid = this.validateSession(session);
    if (!valid.ok) return valid;
    const now = new Date();
    return {
      ok: true,
      value: {
        ...session,
        status: "ACTIVE",
        lastSeenAt: now.toISOString(),
        idleExpiresAt: addMinutes(now, ENTERPRISE_SESSION_POLICY.idleTimeoutMinutes),
        refreshCounter: session.refreshCounter + 1,
        device: { ...session.device, lastSeenAt: now.toISOString() },
      },
    };
  }

  revokeSession(sessionId: string, reason = "REVOKED"): void {
    writeRevokedSessions({ ...readRevokedSessions(), [sessionId]: `${new Date().toISOString()}:${reason}` });
  }

  revokeAccountSessions(accountId: string, reason = "ACCOUNT_ACCESS_CHANGED"): void {
    writeAccountRevocations({ ...readAccountRevocations(), [accountId]: `${new Date().toISOString()}` });
    void reason;
  }

  register(command: RegisterCommand): AuthResult<UserAccount> {
    const now = nowIso();
    return {
      ok: true,
      value: {
        accountId: `dev_registered_${command.email.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
        email: command.email.trim().toLowerCase(),
        displayName: command.displayName.trim(),
        status: "PENDING_VERIFICATION",
        createdAt: now,
      },
    };
  }

  verifyEmail(token: string): AuthResult<UserAccount> {
    if (!token.startsWith("dev_verify_")) return fail("TOKEN_INVALID", "Verification token is invalid.");
    const now = nowIso();
    return {
      ok: true,
      value: {
        accountId: token.slice("dev_verify_".length) || "dev_account",
        email: "verified@example.local",
        displayName: "Verified development user",
        status: "ACTIVE",
        emailVerifiedAt: now,
        createdAt: now,
      },
    };
  }

  /**
   * Demo counterpart of the six-digit code contract. Demo mode sends no email, so the
   * accepted code is the fixed local value the sample-code affordance fills in.
   */
  verifyEmailCode(command: VerifyEmailCommand): AuthResult<UserAccount> {
    const email = normalizeEmail(command.email);
    if (!email.includes("@")) return fail("VALIDATION_FAILED", "A valid email address is required.");
    if (!/^\d{6}$/.test(command.code.trim())) return fail("VALIDATION_FAILED", "The verification code must contain exactly six digits.");
    if (command.code.trim() !== DEVELOPMENT_EMAIL_VERIFICATION_CODE) return fail("TOKEN_INVALID", "Verification code is invalid.");
    const now = nowIso();
    return {
      ok: true,
      value: {
        accountId: `dev_registered_${email.replace(/[^a-z0-9]+/g, "_")}`,
        email,
        displayName: email.split("@")[0] ?? "Development user",
        status: "ACTIVE",
        emailVerifiedAt: now,
        createdAt: now,
      },
    };
  }

  requestEmailVerification(email: string): AuthResult<EmailVerificationRequestAccepted> {
    const normalized = normalizeEmail(email);
    if (!normalized.includes("@")) return fail("VALIDATION_FAILED", "A valid email address is required.");
    return { ok: true, value: { requestId: `dev_evr_${normalized.replace(/[^a-z0-9]+/g, "_")}`, acceptedAt: nowIso() } };
  }

  requestPasswordReset(email: string): AuthResult<{ requestId: string }> {
    return { ok: true, value: { requestId: `dev_reset_${email.toLowerCase().replace(/[^a-z0-9]+/g, "_")}` } };
  }

  resetPassword(token: string): AuthResult<void> {
    if (!token.startsWith("dev_reset_")) return fail("TOKEN_INVALID", "Reset token is invalid.");
    return { ok: true, value: undefined };
  }

  acceptInvitation(token: string): AuthResult<{ workspaceId: string }> {
    if (!token.startsWith("dev_invite_")) return fail("INVITATION_INVALID", "Invitation token is invalid.");
    return { ok: true, value: { workspaceId: token.slice("dev_invite_".length) || "ws1" } };
  }
}
