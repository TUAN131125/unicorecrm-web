import { appendTamperEvidentAuditRecord, sanitizeSensitiveValue } from "@/platform/enterprise-security";
import { BrowserStorageAdapter, type StoragePort } from "@/platform/persistence";
import type { ConnectedAuthGateway } from "../application/ConnectedAuthGateway";
import type { AuthGateway } from "../application/AuthGateway";
import type {
  AuthResult,
  AuthSession,
  ProvisionUserAccountCommand,
  ProvisionedUserAccount,
  RegisterCommand,
  SecurityEvent,
  SignInCommand,
  UserAccount,
  VerifyMfaCommand,
} from "../domain/auth.types";
import {
  DevelopmentAuthAdapter,
  getDevelopmentMfaCodeHint,
  isProvisionedDevelopmentAccount,
  listDevelopmentAccountDescriptors,
  provisionDevelopmentAccount,
  removeProvisionedDevelopmentAccount,
  rotateProvisionedDevelopmentAccountPassword,
} from "../infrastructure/DevelopmentAuthAdapter";
import { createAuthAttemptId } from "../infrastructure/IdentityAuthHttpAdapter";
import { UnavailableProductionAuthAdapter } from "../infrastructure/UnavailableProductionAuthAdapter";

const SESSION_KEY = "unicore_auth_session_v3";
const LEGACY_SESSION_KEY = "unicore_auth_session_v2";
type SessionListener = (session: AuthSession | null) => void;
type SecurityEventListener = (events: SecurityEvent[]) => void;

function configuredEnvironmentMode(): "development" | "unavailable" {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | boolean | undefined> }).env;
  const configured = env?.VITE_AUTH_ADAPTER;
  if (configured === "unavailable" || configured === "connected") return "unavailable";
  if (configured === "development") return "development";
  if (env?.PROD === true) return "unavailable";
  return "development";
}

class DevelopmentAuthRuntime {
  private readonly listeners = new Set<SessionListener>();
  private lastBoundaryReason: "SESSION_EXPIRED" | null = null;
  private readonly securityEventListeners = new Set<SecurityEventListener>();
  private readonly securityEvents: SecurityEvent[] = [];
  private readonly adapter: AuthGateway;

  constructor(private readonly storage: StoragePort = new BrowserStorageAdapter()) {
    this.adapter = configuredEnvironmentMode() === "development"
      ? new DevelopmentAuthAdapter()
      : new UnavailableProductionAuthAdapter();
  }

  getSnapshot(): AuthSession | null {
    const session = this.storage.get<AuthSession>(LEGACY_SESSION_KEY);
    if (!session || session.status !== "ACTIVE") return null;
    const validation = this.adapter.validateSession(session);
    if (validation.ok === false) {
      this.storage.remove(LEGACY_SESSION_KEY);
      this.lastBoundaryReason = validation.code === "SESSION_EXPIRED" ? "SESSION_EXPIRED" : null;
      this.recordSecurityEvent({ accountId: session.principal.accountId, sessionId: session.sessionId, type: "SESSION_REVOKED", metadata: { reason: validation.code } });
      return null;
    }
    return validation.value;
  }

  signIn(command: SignInCommand): AuthResult<AuthSession> {
    const result = this.adapter.signIn(command);
    if (result.ok === true) {
      this.lastBoundaryReason = null;
      this.storage.set(LEGACY_SESSION_KEY, result.value);
      this.recordSecurityEvent({ accountId: result.value.principal.accountId, sessionId: result.value.sessionId, type: "SIGN_IN_SUCCEEDED" });
      this.emit(result.value);
    } else if (result.code === "MFA_REQUIRED") {
      this.recordSecurityEvent({ type: "MFA_CHALLENGE_CREATED", metadata: { challengeId: result.challengeId ?? "unknown" } });
    } else {
      this.recordSecurityEvent({ type: "SIGN_IN_FAILED", metadata: { code: result.code } });
    }
    return result;
  }

  verifyMfa(command: VerifyMfaCommand): AuthResult<AuthSession> {
    const result = this.adapter.verifyMfa(command);
    if (result.ok === true) {
      this.lastBoundaryReason = null;
      this.storage.set(LEGACY_SESSION_KEY, result.value);
      this.recordSecurityEvent({ accountId: result.value.principal.accountId, sessionId: result.value.sessionId, type: "MFA_VERIFIED" });
      this.recordSecurityEvent({ accountId: result.value.principal.accountId, sessionId: result.value.sessionId, type: "SIGN_IN_SUCCEEDED" });
      this.emit(result.value);
    } else {
      this.recordSecurityEvent({ type: "MFA_FAILED", metadata: { code: result.code, challengeId: command.challengeId } });
    }
    return result;
  }

  refresh(): AuthResult<AuthSession> {
    const session = this.getSnapshot();
    if (!session) return { ok: false, code: "SESSION_EXPIRED", message: "No active session is available." };
    const result = this.adapter.refreshSession(session);
    if (result.ok === true) {
      this.storage.set(LEGACY_SESSION_KEY, result.value);
      this.recordSecurityEvent({ accountId: result.value.principal.accountId, sessionId: result.value.sessionId, type: "SESSION_REFRESHED" });
      this.emit(result.value);
    } else {
      this.storage.remove(LEGACY_SESSION_KEY);
      this.emit(null);
    }
    return result;
  }

  signOut(reason = "USER_SIGN_OUT"): void {
    const session = this.storage.get<AuthSession>(LEGACY_SESSION_KEY);
    if (session) {
      this.adapter.revokeSession(session.sessionId, reason);
      this.adapter.signOut(session.sessionId);
      this.recordSecurityEvent({ accountId: session.principal.accountId, sessionId: session.sessionId, type: "SESSION_REVOKED", metadata: { reason } });
    }
    this.storage.remove(LEGACY_SESSION_KEY);
    this.emit(null);
  }

  register(command: RegisterCommand): AuthResult<UserAccount> { return this.adapter.register(command); }
  verifyEmail(token: string): AuthResult<UserAccount> {
    const result = this.adapter.verifyEmail(token);
    if (result.ok) this.recordSecurityEvent({ accountId: result.value.accountId, type: "EMAIL_VERIFIED" });
    return result;
  }
  requestPasswordReset(email: string): AuthResult<{ requestId: string }> {
    const result = this.adapter.requestPasswordReset(email);
    if (result.ok) this.recordSecurityEvent({ type: "PASSWORD_RESET_REQUESTED", metadata: { email } });
    return result;
  }
  resetPassword(token: string, nextPassword: string): AuthResult<void> {
    const result = this.adapter.resetPassword(token, nextPassword);
    if (result.ok) this.recordSecurityEvent({ type: "PASSWORD_RESET_COMPLETED" });
    return result;
  }
  acceptInvitation(token: string): AuthResult<{ workspaceId: string }> {
    const result = this.adapter.acceptInvitation(token);
    if (result.ok) this.recordSecurityEvent({ type: "INVITATION_ACCEPTED", metadata: { workspaceId: result.value.workspaceId } });
    return result;
  }
  revokeAccountSessions(accountId: string, reason = "ACCOUNT_ACCESS_CHANGED"): void {
    this.adapter.revokeAccountSessions(accountId, reason);
    const current = this.storage.get<AuthSession>(LEGACY_SESSION_KEY);
    if (current?.principal.accountId === accountId) {
      this.storage.remove(LEGACY_SESSION_KEY);
      this.emit(null);
    }
    this.recordSecurityEvent({ accountId, type: "SESSION_REVOKED", metadata: { reason, scope: "ACCOUNT" } });
  }
  consumeBoundaryReason(): "SESSION_EXPIRED" | null { const reason = this.lastBoundaryReason; this.lastBoundaryReason = null; return reason; }
  subscribe(listener: SessionListener): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  getSecurityEventsSnapshot(): SecurityEvent[] { return this.securityEvents.map((event) => ({ ...event, metadata: event.metadata ? { ...event.metadata } : undefined })); }
  subscribeToSecurityEvents(listener: SecurityEventListener): () => void { this.securityEventListeners.add(listener); return () => this.securityEventListeners.delete(listener); }

  private recordSecurityEvent(event: Omit<SecurityEvent, "eventId" | "occurredAt">): void {
    const saved: SecurityEvent = {
      ...event,
      eventId: `security_${Date.now()}_${this.securityEvents.length + 1}`,
      occurredAt: new Date().toISOString(),
      metadata: event.metadata ? sanitizeSensitiveValue(event.metadata) as Record<string, string> : undefined,
    };
    this.securityEvents.push(saved);
    appendTamperEvidentAuditRecord({ scopeId: "identity", category: "IDENTITY", action: saved.type, actorId: saved.accountId ?? "anonymous", subjectId: saved.sessionId, occurredAt: saved.occurredAt, metadata: saved.metadata });
    const snapshot = this.getSecurityEventsSnapshot();
    this.securityEventListeners.forEach((listener) => listener(snapshot));
  }
  private emit(session: AuthSession | null): void { this.listeners.forEach((listener) => listener(session)); }
}

class ConnectedAuthSessionRuntime {
  private readonly listeners = new Set<SessionListener>();
  private lastBoundaryReason: "SESSION_EXPIRED" | null = null;
  private session: AuthSession | null = null;
  private readonly storage: StoragePort;

  constructor(private readonly gateway: ConnectedAuthGateway) {
    const browserSessionStorage = typeof window === "undefined" ? null : window.sessionStorage;
    this.storage = new BrowserStorageAdapter(browserSessionStorage);
  }

  async bootstrap(): Promise<void> {
    const result = await this.gateway.bootstrap({ idempotencyKey: createAuthAttemptId("bootstrap") });
    if (result.ok && result.value) this.commit(result.value);
    else this.clear(result.ok ? null : result.code === "SESSION_EXPIRED" || result.code === "TOKEN_EXPIRED" ? "SESSION_EXPIRED" : null);
  }

  getSnapshot(): AuthSession | null {
    const current = this.session ?? this.storage.get<AuthSession>(SESSION_KEY);
    if (!current || current.status !== "ACTIVE") return null;
    const expiresAt = Math.min(Date.parse(current.idleExpiresAt), Date.parse(current.absoluteExpiresAt));
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      this.clear("SESSION_EXPIRED");
      return null;
    }
    this.session = current;
    return { ...current, principal: { ...current.principal }, device: { ...current.device } };
  }

  async signIn(command: SignInCommand): Promise<AuthResult<AuthSession>> {
    const result = await this.gateway.signIn(command, { idempotencyKey: createAuthAttemptId("sign-in") });
    if (!result.ok) return result;
    if (result.value.outcome === "MFA_REQUIRED") {
      return { ok: false, code: "MFA_REQUIRED", message: "Multi-factor authentication is required.", challengeId: result.value.challengeId, challengeExpiresAt: result.value.challengeExpiresAt };
    }
    this.commit(result.value.grant.session);
    return { ok: true, value: result.value.grant.session };
  }

  async verifyMfa(command: VerifyMfaCommand): Promise<AuthResult<AuthSession>> {
    const result = await this.gateway.verifyMfa(command, { idempotencyKey: createAuthAttemptId("verify-mfa") });
    if (result.ok) this.commit(result.value);
    return result;
  }

  async refresh(): Promise<AuthResult<AuthSession>> {
    const result = await this.gateway.refreshSession({ idempotencyKey: createAuthAttemptId("refresh") });
    if (result.ok) this.commit(result.value);
    else this.clear(result.code === "SESSION_EXPIRED" || result.code === "TOKEN_EXPIRED" ? "SESSION_EXPIRED" : null);
    return result;
  }

  async signOut(reason = "USER_SIGN_OUT"): Promise<void> {
    try { await this.gateway.signOut({ reason }, { idempotencyKey: createAuthAttemptId("sign-out") }); }
    finally { this.clear(null); }
  }

  subscribe(listener: SessionListener): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  consumeBoundaryReason(): "SESSION_EXPIRED" | null { const reason = this.lastBoundaryReason; this.lastBoundaryReason = null; return reason; }
  getAccessToken(): string | undefined { return this.gateway.getAccessToken(); }

  private commit(session: AuthSession): void {
    this.lastBoundaryReason = null;
    this.session = { ...session, principal: { ...session.principal }, device: { ...session.device } };
    this.storage.set(SESSION_KEY, this.session);
    this.emit(this.session);
  }
  private clear(reason: "SESSION_EXPIRED" | null): void {
    this.lastBoundaryReason = reason;
    this.session = null;
    this.gateway.clearCredentials();
    this.storage.remove(SESSION_KEY);
    this.storage.remove(LEGACY_SESSION_KEY);
    this.emit(null);
  }
  private emit(session: AuthSession | null): void { this.listeners.forEach((listener) => listener(session)); }
}

const developmentRuntime = new DevelopmentAuthRuntime();
let connectedRuntime: ConnectedAuthSessionRuntime | undefined;
let connectedGateway: ConnectedAuthGateway | undefined;

export function configureConnectedAuthGateway(gateway: ConnectedAuthGateway): void {
  connectedGateway = gateway;
  connectedRuntime = new ConnectedAuthSessionRuntime(gateway);
}
export function resetConnectedAuthGateway(): void { connectedGateway?.clearCredentials(); connectedGateway = undefined; connectedRuntime = undefined; }
export const isConnectedAuthRuntime = () => connectedRuntime !== undefined;
export const bootstrapAuthSession = async () => { if (connectedRuntime) await connectedRuntime.bootstrap(); };
export const getConnectedAuthAccessToken = () => connectedRuntime?.getAccessToken();

export const getAuthSessionSnapshot = () => connectedRuntime ? connectedRuntime.getSnapshot() : developmentRuntime.getSnapshot();
export const subscribeToAuthSession = (listener: SessionListener) => connectedRuntime ? connectedRuntime.subscribe(listener) : developmentRuntime.subscribe(listener);
export const consumeAuthBoundaryReason = () => connectedRuntime ? connectedRuntime.consumeBoundaryReason() : developmentRuntime.consumeBoundaryReason();
export const getSecurityEventsSnapshot = () => developmentRuntime.getSecurityEventsSnapshot();
export const subscribeToSecurityEvents = (listener: SecurityEventListener) => developmentRuntime.subscribeToSecurityEvents(listener);

/** Canonical async UI boundary; works in both demo and connected modes. */
export const authenticateUser = (command: SignInCommand): Promise<AuthResult<AuthSession>> => connectedRuntime ? connectedRuntime.signIn(command) : Promise.resolve(developmentRuntime.signIn(command));
export const verifyMfaAuthentication = (command: VerifyMfaCommand): Promise<AuthResult<AuthSession>> => connectedRuntime ? connectedRuntime.verifyMfa(command) : Promise.resolve(developmentRuntime.verifyMfa(command));
export const refreshAuthSession = (): Promise<AuthResult<AuthSession>> => connectedRuntime ? connectedRuntime.refresh() : Promise.resolve(developmentRuntime.refresh());
export const terminateAuthSession = async (reason?: string): Promise<void> => { if (connectedRuntime) await connectedRuntime.signOut(reason); else developmentRuntime.signOut(reason); };
export const registerAccount = (command: RegisterCommand): Promise<AuthResult<UserAccount>> => connectedGateway ? connectedGateway.register(command, { idempotencyKey: createAuthAttemptId("register") }) : Promise.resolve(developmentRuntime.register(command));
export const verifyAccountEmail = (token: string): Promise<AuthResult<UserAccount>> => connectedGateway ? connectedGateway.verifyEmail({ token }, { idempotencyKey: createAuthAttemptId("verify-email") }) : Promise.resolve(developmentRuntime.verifyEmail(token));
export const requestAccountPasswordReset = (email: string) => connectedGateway
  ? connectedGateway.requestPasswordReset({ email }, { idempotencyKey: createAuthAttemptId("request-password-reset") })
  : Promise.resolve(mapDevelopmentPasswordResetRequest(developmentRuntime.requestPasswordReset(email)));
export const completeAccountPasswordReset = (token: string, nextPassword: string) => connectedGateway ? connectedGateway.resetPassword({ token, nextPassword }, { idempotencyKey: createAuthAttemptId("reset-password") }) : Promise.resolve(mapDevelopmentPasswordReset(developmentRuntime.resetPassword(token, nextPassword)));
export const acceptWorkspaceInvitation = (token: string) => connectedGateway ? connectedGateway.acceptInvitation({ token }, { idempotencyKey: createAuthAttemptId("accept-invitation") }) : Promise.resolve(mapDevelopmentInvitation(developmentRuntime.acceptInvitation(token)));

function mapDevelopmentPasswordResetRequest(result: AuthResult<{ requestId: string }>) {
  return result.ok ? { ok: true as const, value: { requestId: result.value.requestId, acceptedAt: new Date().toISOString() } } : result;
}
function mapDevelopmentPasswordReset(result: AuthResult<void>) {
  return result.ok ? { ok: true as const, value: { completedAt: new Date().toISOString() } } : result;
}
function mapDevelopmentInvitation(result: AuthResult<{ workspaceId: string }>) {
  return result.ok ? { ok: true as const, value: { workspaceId: result.value.workspaceId, membershipId: `development-${result.value.workspaceId}`, acceptedAt: new Date().toISOString() } } : result;
}

/** Legacy synchronous demo contract retained for source-level demo tests only. */
export const signIn = (command: SignInCommand) => connectedRuntime ? ({ ok: false, code: "AUTH_ADAPTER_UNAVAILABLE", message: "Use authenticateUser in connected mode." } as const) : developmentRuntime.signIn(command);
export const verifyMfaChallenge = (command: VerifyMfaCommand) => connectedRuntime ? ({ ok: false, code: "AUTH_ADAPTER_UNAVAILABLE", message: "Use verifyMfaAuthentication in connected mode." } as const) : developmentRuntime.verifyMfa(command);
export const developmentMfaCodeHint = (challengeId: string) => !connectedRuntime && configuredEnvironmentMode() === "development" ? getDevelopmentMfaCodeHint(challengeId) : undefined;
export const refreshSession = () => connectedRuntime ? ({ ok: false, code: "AUTH_ADAPTER_UNAVAILABLE", message: "Use refreshAuthSession in connected mode." } as const) : developmentRuntime.refresh();
export const signOut = (reason?: string) => { if (connectedRuntime) void connectedRuntime.signOut(reason); else developmentRuntime.signOut(reason); };
export const revokeAccountSessions = (accountId: string, reason?: string) => { if (connectedRuntime) throw new Error("Account-wide session revocation requires the Phase 9 access-control backend boundary."); developmentRuntime.revokeAccountSessions(accountId, reason); };
export const registerUser = (command: RegisterCommand) => connectedRuntime ? ({ ok: false, code: "AUTH_ADAPTER_UNAVAILABLE", message: "Use registerAccount in connected mode." } as const) : developmentRuntime.register(command);
export const verifyEmail = (token: string) => connectedRuntime ? ({ ok: false, code: "AUTH_ADAPTER_UNAVAILABLE", message: "Use verifyAccountEmail in connected mode." } as const) : developmentRuntime.verifyEmail(token);
export const requestPasswordReset = (email: string) => connectedRuntime ? ({ ok: false, code: "AUTH_ADAPTER_UNAVAILABLE", message: "Use requestAccountPasswordReset in connected mode." } as const) : developmentRuntime.requestPasswordReset(email);
export const resetPassword = (token: string, nextPassword: string) => connectedRuntime ? ({ ok: false, code: "AUTH_ADAPTER_UNAVAILABLE", message: "Use completeAccountPasswordReset in connected mode." } as const) : developmentRuntime.resetPassword(token, nextPassword);
export const acceptInvitation = (token: string) => connectedRuntime ? ({ ok: false, code: "AUTH_ADAPTER_UNAVAILABLE", message: "Use acceptWorkspaceInvitation in connected mode." } as const) : developmentRuntime.acceptInvitation(token);
export const listDevelopmentAccounts = () => !connectedRuntime && configuredEnvironmentMode() === "development" ? listDevelopmentAccountDescriptors().map((account) => ({ ...account })) : [];
export const isDevelopmentAuthAdapter = () => !connectedRuntime && configuredEnvironmentMode() === "development";
export const provisionUserAccount = (command: ProvisionUserAccountCommand): ProvisionedUserAccount => { if (connectedRuntime || configuredEnvironmentMode() !== "development") throw new Error("Direct account provisioning requires the Phase 9 server-backed access adapter."); return provisionDevelopmentAccount(command); };
export const removeProvisionedUserAccount = (accountId: string): void => { if (connectedRuntime || configuredEnvironmentMode() !== "development") throw new Error("Direct account provisioning requires the Phase 9 server-backed access adapter."); removeProvisionedDevelopmentAccount(accountId); };
export const rotateProvisionedUserPassword = (accountId: string): string => { if (connectedRuntime || configuredEnvironmentMode() !== "development") throw new Error("Password rotation requires the Phase 9 server-backed access adapter."); return rotateProvisionedDevelopmentAccountPassword(accountId); };
export const isProvisionedUserAccount = (accountId?: string): boolean => !connectedRuntime && configuredEnvironmentMode() === "development" && isProvisionedDevelopmentAccount(accountId);
