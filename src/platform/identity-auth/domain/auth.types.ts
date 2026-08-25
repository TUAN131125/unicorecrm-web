export type UserAccountStatus = "PENDING_VERIFICATION" | "ACTIVE" | "SUSPENDED";
export type SessionStatus = "ACTIVE" | "EXPIRED" | "REVOKED";
export type SessionAssuranceLevel = "AAL1" | "AAL2";

export interface UserAccount {
  accountId: string;
  email: string;
  displayName: string;
  status: UserAccountStatus;
  emailVerifiedAt?: string;
  createdAt: string;
}
export interface ProvisionUserAccountCommand {
  email: string;
  displayName: string;
  initialPassword?: string;
  provisionedByAccountId: string;
}

export interface ProvisionedAccountDescriptor extends UserAccount {
  memberId: string;
  provisionedAt: string;
}

export interface ProvisionedUserAccount {
  account: ProvisionedAccountDescriptor;
  temporaryPassword: string;
}



export type IdentityProvider = "LOCAL" | "OIDC" | "SAML" | "PASSKEY" | "MAGIC_LINK";

/** Global login identity linked to exactly one UserAccount. */
export interface UserIdentity {
  identityId: string;
  accountId: string;
  provider: IdentityProvider;
  providerSubject: string;
  email?: string;
  verifiedAt?: string;
  linkedAt: string;
}

/** Metadata-only credential reference. Secret material never belongs in frontend state. */
export interface UserCredentialReference {
  credentialId: string;
  accountId: string;
  type: "PASSWORD" | "PASSKEY" | "SSO";
  status: "ACTIVE" | "REVOKED";
  createdAt: string;
  lastUsedAt?: string;
}

export interface WorkspaceInvitation {
  invitationId: string;
  workspaceId: string;
  email: string;
  status: "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";
  invitedByAccountId?: string;
  expiresAt: string;
  acceptedAt?: string;
}

export interface AuthenticationChallenge {
  challengeId: string;
  accountId?: string;
  type: "EMAIL_VERIFICATION" | "PASSWORD_RESET" | "MFA" | "MAGIC_LINK" | "INVITATION";
  status: "PENDING" | "CONSUMED" | "EXPIRED" | "REVOKED";
  expiresAt: string;
  consumedAt?: string;
  attempts: number;
}

export interface AuthenticatedPrincipal {
  accountId: string;
  memberId: string;
  email: string;
  displayName: string;
}

export interface SessionDevice {
  deviceId: string;
  label: string;
  userAgent?: string;
  lastSeenAt: string;
}

export interface AuthSession {
  sessionId: string;
  principal: AuthenticatedPrincipal;
  status: SessionStatus;
  issuedAt: string;
  lastSeenAt: string;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
  refreshCounter: number;
  assuranceLevel: SessionAssuranceLevel;
  mfaVerifiedAt?: string;
  device: SessionDevice;
  revokedAt?: string;
  revokeReason?: string;
}

export type AuthFailureCode =
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_SUSPENDED"
  | "ACCOUNT_ALREADY_EXISTS"
  | "PASSWORD_POLICY_VIOLATION"
  | "RATE_LIMITED"
  | "ACCESS_DENIED"
  | "AUTHENTICATION_REQUIRED"
  | "EMAIL_NOT_VERIFIED"
  | "MFA_REQUIRED"
  | "MFA_INVALID"
  | "MFA_EXPIRED"
  | "MFA_LOCKED"
  | "SESSION_EXPIRED"
  | "SESSION_REVOKED"
  | "AUTH_ADAPTER_UNAVAILABLE"
  /** The identity backend could not be reached, timed out, or failed unexpectedly. */
  | "SERVICE_UNAVAILABLE"
  | "TOKEN_INVALID"
  | "TOKEN_EXPIRED"
  /** The submitted values do not satisfy the contract. */
  | "VALIDATION_FAILED"
  /** The identity backend has no usable email boundary, so no code can be delivered. */
  | "EMAIL_DELIVERY_UNAVAILABLE"
  | "INVITATION_INVALID"
  | "UNKNOWN";

export interface AuthFailure {
  ok: false;
  code: AuthFailureCode;
  message: string;
  challengeId?: string;
  challengeExpiresAt?: string;
}

export interface AuthSuccess<T> {
  ok: true;
  value: T;
}

export type AuthResult<T> = AuthSuccess<T> | AuthFailure;

export interface SignInCommand {
  email: string;
  password: string;
  deviceLabel?: string;
}

export interface VerifyMfaCommand {
  challengeId: string;
  code: string;
  deviceLabel?: string;
}

export interface RegisterCommand {
  email: string;
  password: string;
  displayName: string;
}

export interface SecurityEvent {
  eventId: string;
  accountId?: string;
  sessionId?: string;
  type:
    | "SIGN_IN_SUCCEEDED"
    | "SIGN_IN_FAILED"
    | "MFA_CHALLENGE_CREATED"
    | "MFA_VERIFIED"
    | "MFA_FAILED"
    | "SESSION_REFRESHED"
    | "SESSION_REVOKED"
    | "PASSWORD_RESET_REQUESTED"
    | "PASSWORD_RESET_COMPLETED"
    | "EMAIL_VERIFIED"
    | "INVITATION_ACCEPTED";
  occurredAt: string;
  metadata?: Record<string, string>;
}

/**
 * Connected identity grant returned by the backend. Access tokens are held in
 * memory only by the connected adapter and are never persisted with AuthSession.
 */
export interface AuthenticatedSessionGrant {
  session: AuthSession;
  accessToken: string;
  accessTokenExpiresAt: string;
}

export type ConnectedSignInOutcome =
  | { outcome: "AUTHENTICATED"; grant: AuthenticatedSessionGrant }
  | {
      outcome: "MFA_REQUIRED";
      challengeId: string;
      challengeExpiresAt: string;
    };

export interface AuthCommandOptions {
  idempotencyKey: string;
  signal?: AbortSignal;
}

export interface AuthQueryOptions {
  signal?: AbortSignal;
}

export interface SignOutCommand {
  reason?: string;
}

export interface PasswordResetRequestCommand {
  email: string;
}

export interface PasswordResetCommand {
  token: string;
  nextPassword: string;
}

/**
 * Email verification is a six-digit one-time code delivered to the address being
 * verified. The retired token-based shape carried an opaque link credential; there is
 * no verification link anywhere in this flow.
 */
export interface VerifyEmailCommand {
  email: string;
  code: string;
}

export interface EmailVerificationRequestCommand {
  email: string;
}

export interface AcceptInvitationCommand {
  token: string;
}

export interface PasswordResetRequestAccepted {
  requestId: string;
  acceptedAt: string;
}

/**
 * Acceptance of a resend. The identifier is owner-assigned and carries no account
 * identity, so nothing in this value may be read as evidence that an account exists,
 * is still pending, or that a code was actually issued.
 */
export interface EmailVerificationRequestAccepted {
  requestId: string;
  acceptedAt: string;
}

export interface PasswordResetCompleted {
  completedAt: string;
}

export interface InvitationAcceptanceResult {
  workspaceId: string;
  membershipId: string;
  acceptedAt: string;
}

export interface SessionRevocationResult {
  sessionId: string;
  revokedAt: string;
}
