import type {
  AuthResult,
  AuthSession,
  RegisterCommand,
  SignInCommand,
  UserAccount,
  VerifyMfaCommand,
} from "../domain/auth.types";

export interface AuthGateway {
  signIn(command: SignInCommand): AuthResult<AuthSession>;
  verifyMfa(command: VerifyMfaCommand): AuthResult<AuthSession>;
  validateSession(session: AuthSession): AuthResult<AuthSession>;
  revokeAccountSessions(accountId: string, reason?: string): void;
  signOut(sessionId: string): void;
  refreshSession(session: AuthSession): AuthResult<AuthSession>;
  revokeSession(sessionId: string, reason?: string): void;
  register(command: RegisterCommand): AuthResult<UserAccount>;
  verifyEmail(token: string): AuthResult<UserAccount>;
  requestPasswordReset(email: string): AuthResult<{ requestId: string }>;
  resetPassword(token: string, nextPassword: string): AuthResult<void>;
  acceptInvitation(token: string): AuthResult<{ workspaceId: string }>;
}
