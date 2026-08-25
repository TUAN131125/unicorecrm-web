import type {
  AuthenticatedSessionResponse,
  IdentityApiClient,
  InvitationAcceptanceResponse,
  MfaChallengeResponse,
  PasswordResetCompletedResponse,
  PasswordResetRequestAcceptedResponse,
  SessionRevocationResponse,
  UserAccountDocument,
} from "@/platform/api/generated/identityApi";
import { ApiClientError } from "@/platform/api/errors/ApiClientError";
import type { ConnectedAuthGateway } from "../application/ConnectedAuthGateway";
import type {
  AcceptInvitationCommand,
  AuthCommandOptions,
  AuthFailureCode,
  AuthQueryOptions,
  AuthResult,
  AuthSession,
  ConnectedSignInOutcome,
  InvitationAcceptanceResult,
  PasswordResetCommand,
  PasswordResetCompleted,
  PasswordResetRequestAccepted,
  PasswordResetRequestCommand,
  RegisterCommand,
  SessionRevocationResult,
  SignInCommand,
  SignOutCommand,
  UserAccount,
  VerifyEmailCommand,
  VerifyMfaCommand,
} from "../domain/auth.types";

const AUTH_FAILURE_CODES = new Set<AuthFailureCode>([
  "INVALID_CREDENTIALS",
  "ACCOUNT_SUSPENDED",
  "ACCOUNT_ALREADY_EXISTS",
  "PASSWORD_POLICY_VIOLATION",
  "RATE_LIMITED",
  "ACCESS_DENIED",
  "AUTHENTICATION_REQUIRED",
  "EMAIL_NOT_VERIFIED",
  "MFA_REQUIRED",
  "MFA_INVALID",
  "MFA_EXPIRED",
  "MFA_LOCKED",
  "SESSION_EXPIRED",
  "SESSION_REVOKED",
  "AUTH_ADAPTER_UNAVAILABLE",
  "SERVICE_UNAVAILABLE",
  "TOKEN_INVALID",
  "TOKEN_EXPIRED",
  "INVITATION_INVALID",
  "UNKNOWN",
]);

/**
 * Production Identity/Auth boundary. The backend owns credential validation,
 * session creation/rotation/revocation and all security evidence. The adapter
 * keeps only the short-lived access token in memory.
 */
export class IdentityAuthHttpAdapter implements ConnectedAuthGateway {
  private accessToken: string | undefined;
  private accessTokenExpiresAt: string | undefined;

  constructor(private readonly api: IdentityApiClient) {}

  async bootstrap(options: AuthCommandOptions = { idempotencyKey: createAuthAttemptId("bootstrap") }): Promise<AuthResult<AuthSession | null>> {
    const result = await this.refreshSession(options);
    if (result.ok) return result;
    if (["SESSION_EXPIRED", "SESSION_REVOKED", "TOKEN_INVALID", "TOKEN_EXPIRED", "INVALID_CREDENTIALS"].includes(result.code)) {
      this.clearCredentials();
      return { ok: true, value: null };
    }
    return result;
  }

  async signIn(command: SignInCommand, options: AuthCommandOptions): Promise<AuthResult<ConnectedSignInOutcome>> {
    try {
      const response = await this.api.signIn<AuthenticatedSessionResponse | MfaChallengeResponse>({
        email: command.email.trim(),
        password: command.password,
        ...(command.deviceLabel ? { deviceLabel: command.deviceLabel } : {}),
      }, requestOptions(options));
      if (isMfaChallengeResponse(response)) {
        this.clearCredentials();
        return {
          ok: true,
          value: {
            outcome: "MFA_REQUIRED",
            challengeId: response.challengeId,
            challengeExpiresAt: response.challengeExpiresAt,
          },
        };
      }
      const session = this.acceptGrant(response);
      return { ok: true, value: { outcome: "AUTHENTICATED", grant: { session, accessToken: response.accessToken, accessTokenExpiresAt: response.accessTokenExpiresAt } } };
    } catch (error) {
      return authFailure(error);
    }
  }

  async verifyMfa(command: VerifyMfaCommand, options: AuthCommandOptions): Promise<AuthResult<AuthSession>> {
    try {
      const response = await this.api.verifyMfa(command.challengeId, {
        code: command.code,
        ...(command.deviceLabel ? { deviceLabel: command.deviceLabel } : {}),
      }, requestOptions(options));
      return { ok: true, value: this.acceptGrant(response) };
    } catch (error) {
      return authFailure(error);
    }
  }

  async getCurrentSession(options: AuthQueryOptions = {}): Promise<AuthResult<AuthSession>> {
    try {
      const response = await this.api.getCurrentSession({}, options.signal);
      return { ok: true, value: mapSession(response) };
    } catch (error) {
      return authFailure(error);
    }
  }

  async refreshSession(options: AuthCommandOptions): Promise<AuthResult<AuthSession>> {
    try {
      const response = await this.api.refreshSession({}, requestOptions(options));
      return { ok: true, value: this.acceptGrant(response) };
    } catch (error) {
      this.clearCredentials();
      return authFailure(error);
    }
  }

  async signOut(command: SignOutCommand, options: AuthCommandOptions): Promise<AuthResult<SessionRevocationResult>> {
    try {
      const response = await this.api.signOut(command.reason ? { reason: command.reason } : {}, requestOptions(options));
      this.clearCredentials();
      return { ok: true, value: mapRevocation(response) };
    } catch (error) {
      this.clearCredentials();
      return authFailure(error);
    }
  }

  async register(command: RegisterCommand, options: AuthCommandOptions): Promise<AuthResult<UserAccount>> {
    try {
      const response = await this.api.registerAccount({ email: command.email.trim(), password: command.password, displayName: command.displayName.trim() }, requestOptions(options));
      return { ok: true, value: mapAccount(response) };
    } catch (error) {
      return authFailure(error);
    }
  }

  async verifyEmail(command: VerifyEmailCommand, options: AuthCommandOptions): Promise<AuthResult<UserAccount>> {
    try {
      return { ok: true, value: mapAccount(await this.api.verifyEmail({ token: command.token }, requestOptions(options))) };
    } catch (error) {
      return authFailure(error);
    }
  }

  async requestPasswordReset(command: PasswordResetRequestCommand, options: AuthCommandOptions): Promise<AuthResult<PasswordResetRequestAccepted>> {
    try {
      return { ok: true, value: mapPasswordResetAccepted(await this.api.requestPasswordReset({ email: command.email.trim() }, requestOptions(options))) };
    } catch (error) {
      return authFailure(error);
    }
  }

  async resetPassword(command: PasswordResetCommand, options: AuthCommandOptions): Promise<AuthResult<PasswordResetCompleted>> {
    try {
      return { ok: true, value: mapPasswordResetCompleted(await this.api.resetPassword({ token: command.token, nextPassword: command.nextPassword }, requestOptions(options))) };
    } catch (error) {
      return authFailure(error);
    }
  }

  async acceptInvitation(command: AcceptInvitationCommand, options: AuthCommandOptions): Promise<AuthResult<InvitationAcceptanceResult>> {
    try {
      return { ok: true, value: mapInvitation(await this.api.acceptWorkspaceInvitation({ token: command.token }, requestOptions(options))) };
    } catch (error) {
      return authFailure(error);
    }
  }

  getAccessToken(): string | undefined {
    if (!this.accessToken || !this.accessTokenExpiresAt) return undefined;
    if (Date.parse(this.accessTokenExpiresAt) <= Date.now()) {
      this.clearCredentials();
      return undefined;
    }
    return this.accessToken;
  }

  clearCredentials(): void {
    this.accessToken = undefined;
    this.accessTokenExpiresAt = undefined;
  }

  private acceptGrant(response: AuthenticatedSessionResponse): AuthSession {
    if (!response.accessToken.trim()) throw new Error("Connected identity response omitted the access token.");
    if (!Number.isFinite(Date.parse(response.accessTokenExpiresAt))) throw new Error("Connected identity response returned an invalid token expiry.");
    const session = mapSession(response.session);
    if (session.status !== "ACTIVE") throw new Error("Connected identity response did not return an active session.");
    this.accessToken = response.accessToken;
    this.accessTokenExpiresAt = response.accessTokenExpiresAt;
    return session;
  }
}

function requestOptions(options: AuthCommandOptions) {
  return {
    idempotencyKey: options.idempotencyKey,
    ...(options.signal ? { signal: options.signal } : {}),
    retry: "idempotent" as const,
  };
}

function isMfaChallengeResponse(value: AuthenticatedSessionResponse | MfaChallengeResponse): value is MfaChallengeResponse {
  return "outcome" in value && value.outcome === "MFA_REQUIRED";
}

function mapSession(value: AuthenticatedSessionResponse["session"]): AuthSession {
  return {
    sessionId: value.sessionId,
    principal: { ...value.principal },
    status: value.status,
    issuedAt: value.issuedAt,
    lastSeenAt: value.lastSeenAt,
    idleExpiresAt: value.idleExpiresAt,
    absoluteExpiresAt: value.absoluteExpiresAt,
    refreshCounter: value.refreshCounter,
    assuranceLevel: value.assuranceLevel,
    ...(value.mfaVerifiedAt ? { mfaVerifiedAt: value.mfaVerifiedAt } : {}),
    device: { ...value.device },
    ...(value.revokedAt ? { revokedAt: value.revokedAt } : {}),
    ...(value.revokeReason ? { revokeReason: value.revokeReason } : {}),
  };
}

function mapAccount(value: UserAccountDocument): UserAccount {
  return {
    accountId: value.accountId,
    email: value.email,
    displayName: value.displayName,
    status: value.status,
    ...(value.emailVerifiedAt ? { emailVerifiedAt: value.emailVerifiedAt } : {}),
    createdAt: value.createdAt,
  };
}

function mapRevocation(value: SessionRevocationResponse): SessionRevocationResult {
  return { sessionId: value.sessionId, revokedAt: value.revokedAt };
}
function mapPasswordResetAccepted(value: PasswordResetRequestAcceptedResponse): PasswordResetRequestAccepted {
  return { requestId: value.requestId, acceptedAt: value.acceptedAt };
}
function mapPasswordResetCompleted(value: PasswordResetCompletedResponse): PasswordResetCompleted {
  return { completedAt: value.completedAt };
}
function mapInvitation(value: InvitationAcceptanceResponse): InvitationAcceptanceResult {
  return { workspaceId: value.workspaceId, membershipId: value.membershipId, acceptedAt: value.acceptedAt };
}

/**
 * Transport-level outcomes that mean "the identity backend did not answer".
 * They must never be presented as a rejected credential.
 */
const TRANSPORT_FAILURE_CODES = new Set([
  "NETWORK_UNAVAILABLE",
  "REQUEST_TIMEOUT",
  "HTTP_RETRY_EXHAUSTED",
  "AUTH_TOKEN_UNAVAILABLE",
]);

function authFailure<T>(error: unknown): AuthResult<T> {
  if (error instanceof ApiClientError) {
    return { ok: false, code: mapAuthFailureCode(error), message: error.userMessage ?? error.message };
  }
  return { ok: false, code: "SERVICE_UNAVAILABLE", message: error instanceof Error ? error.message : "Identity service is unavailable." };
}

function mapAuthFailureCode(error: ApiClientError): AuthFailureCode {
  if (AUTH_FAILURE_CODES.has(error.code as AuthFailureCode)) return error.code as AuthFailureCode;
  if (error.code === "INTEGRATION_UNAVAILABLE") return "AUTH_ADAPTER_UNAVAILABLE";
  if (TRANSPORT_FAILURE_CODES.has(error.code) || error.status === undefined) return "SERVICE_UNAVAILABLE";
  // A backend fault is a backend fault. Only the contract-declared 401/403 codes
  // above describe the submitted credential.
  if (error.status >= 500) return "SERVICE_UNAVAILABLE";
  return "UNKNOWN";
}

export function createAuthAttemptId(purpose: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `auth-${purpose}-${crypto.randomUUID()}`;
  return `auth-${purpose}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
