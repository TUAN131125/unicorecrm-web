import type { AuthGateway } from "../application/AuthGateway";
import type { AuthResult, AuthSession, EmailVerificationRequestAccepted, RegisterCommand, SignInCommand, UserAccount, VerifyEmailCommand, VerifyMfaCommand } from "../domain/auth.types";

const unavailable = <T>(): AuthResult<T> => ({
  ok: false,
  code: "AUTH_ADAPTER_UNAVAILABLE",
  message: "No production authentication adapter is configured. Connect a server-backed AuthGateway before production use.",
});

export class UnavailableProductionAuthAdapter implements AuthGateway {
  signIn(_command: SignInCommand): AuthResult<AuthSession> { return unavailable(); }
  verifyMfa(_command: VerifyMfaCommand): AuthResult<AuthSession> { return unavailable(); }
  validateSession(_session: AuthSession): AuthResult<AuthSession> { return unavailable(); }
  revokeAccountSessions(_accountId: string, _reason?: string): void {}
  signOut(_sessionId: string): void {}
  refreshSession(_session: AuthSession): AuthResult<AuthSession> { return unavailable(); }
  revokeSession(_sessionId: string, _reason?: string): void {}
  register(_command: RegisterCommand): AuthResult<UserAccount> { return unavailable(); }
  verifyEmail(_token: string): AuthResult<UserAccount> { return unavailable(); }
  verifyEmailCode(_command: VerifyEmailCommand): AuthResult<UserAccount> { return unavailable(); }
  requestEmailVerification(_email: string): AuthResult<EmailVerificationRequestAccepted> { return unavailable(); }
  requestPasswordReset(_email: string): AuthResult<{ requestId: string }> { return unavailable(); }
  resetPassword(_token: string, _nextPassword: string): AuthResult<void> { return unavailable(); }
  acceptInvitation(_token: string): AuthResult<{ workspaceId: string }> { return unavailable(); }
}
