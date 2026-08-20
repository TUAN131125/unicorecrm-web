import type {
  AcceptInvitationCommand,
  AuthCommandOptions,
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

/**
 * Server-backed identity boundary. Implementations may keep short-lived access
 * tokens in memory, but must never persist secret credential material in the
 * browser session document.
 */
export interface ConnectedAuthGateway {
  bootstrap(options?: AuthCommandOptions): Promise<AuthResult<AuthSession | null>>;
  signIn(command: SignInCommand, options: AuthCommandOptions): Promise<AuthResult<ConnectedSignInOutcome>>;
  verifyMfa(command: VerifyMfaCommand, options: AuthCommandOptions): Promise<AuthResult<AuthSession>>;
  getCurrentSession(options?: AuthQueryOptions): Promise<AuthResult<AuthSession>>;
  refreshSession(options: AuthCommandOptions): Promise<AuthResult<AuthSession>>;
  signOut(command: SignOutCommand, options: AuthCommandOptions): Promise<AuthResult<SessionRevocationResult>>;
  register(command: RegisterCommand, options: AuthCommandOptions): Promise<AuthResult<UserAccount>>;
  verifyEmail(command: VerifyEmailCommand, options: AuthCommandOptions): Promise<AuthResult<UserAccount>>;
  requestPasswordReset(command: PasswordResetRequestCommand, options: AuthCommandOptions): Promise<AuthResult<PasswordResetRequestAccepted>>;
  resetPassword(command: PasswordResetCommand, options: AuthCommandOptions): Promise<AuthResult<PasswordResetCompleted>>;
  acceptInvitation(command: AcceptInvitationCommand, options: AuthCommandOptions): Promise<AuthResult<InvitationAcceptanceResult>>;
  getAccessToken(): string | undefined;
  clearCredentials(): void;
}
