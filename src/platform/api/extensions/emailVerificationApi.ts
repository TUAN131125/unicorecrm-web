import type { HttpClient } from "../client/HttpClient";
import { ApiClientError } from "../errors/ApiClientError";

/**
 * Email Verification OTP.
 *
 * The adopted OpenAPI document describes `POST /auth/email-verifications` with an opaque
 * `token`. That request shape is retired: the canonical email-verification credential is a
 * six-digit one-time code delivered by email, and the operation now carries `{ email, code }`.
 * `POST /auth/email-verification-requests` issues or re-issues that code and is not described
 * by the document at all.
 *
 * Neither operation can be expressed through the generated Identity client without
 * misrepresenting the current contract, so both use the semantic-extension contract authority
 * with colocated response validators - the same mechanism the other project extensions use.
 * Regenerating the client is not an option here: the OpenAPI document is a pinned baseline
 * referenced by hash, and the divergence for this one operation is deliberate and recorded.
 *
 * Nothing here ever carries the code anywhere except the request body of a verification
 * attempt. The acceptance identifier returned by a resend is owner-assigned, carries no
 * account identity and is not a credential.
 */
export interface VerifyEmailCodeRequest {
  email: string;
  code: string;
}

export interface RequestEmailVerificationRequest {
  email: string;
}

export type VerifiedAccountStatus = "PENDING_VERIFICATION" | "ACTIVE" | "SUSPENDED";

export interface VerifiedUserAccountResponse {
  accountId: string;
  email: string;
  displayName: string;
  status: VerifiedAccountStatus;
  emailVerifiedAt?: string;
  createdAt: string;
}

export interface EmailVerificationRequestAcceptedResponse {
  requestId: string;
  acceptedAt: string;
}

export interface EmailVerificationRequestOptions {
  idempotencyKey: string;
  signal?: AbortSignal;
}

export class EmailVerificationApiClient {
  constructor(private readonly http: HttpClient) {}

  /**
   * Consumes one six-digit code. A wrong code spends an attempt of the outstanding
   * challenge, so the transport never replays this request: a retry would burn the
   * caller's remaining attempts against a problem no retry can fix.
   */
  async verifyEmail(
    body: VerifyEmailCodeRequest,
    options: EmailVerificationRequestOptions,
  ): Promise<VerifiedUserAccountResponse> {
    const payload = await this.http.request<unknown, VerifyEmailCodeRequest>({
      operationId: "verifyEmail",
      method: "POST",
      path: "/auth/email-verifications",
      // Verification is how an account becomes usable, so it necessarily runs before any
      // access token or workspace exists.
      auth: "none",
      workspace: "none",
      credentials: "include",
      body,
      idempotencyKey: options.idempotencyKey,
      ...(options.signal === undefined ? {} : { signal: options.signal }),
      retry: "never",
      contractAuthority: "semantic-extension",
    });
    return validateVerifiedAccount(payload);
  }

  /**
   * Asks for a new code. The backend answers uniformly, so a `202` says only that the
   * request was accepted - never whether an account exists or whether a code was issued.
   */
  async requestEmailVerification(
    body: RequestEmailVerificationRequest,
    options: EmailVerificationRequestOptions,
  ): Promise<EmailVerificationRequestAcceptedResponse> {
    const payload = await this.http.request<unknown, RequestEmailVerificationRequest>({
      operationId: "requestEmailVerification",
      method: "POST",
      path: "/auth/email-verification-requests",
      auth: "none",
      workspace: "none",
      credentials: "include",
      body,
      idempotencyKey: options.idempotencyKey,
      ...(options.signal === undefined ? {} : { signal: options.signal }),
      retry: "never",
      contractAuthority: "semantic-extension",
    });
    return validateAcceptance(payload);
  }
}

function validateVerifiedAccount(value: unknown): VerifiedUserAccountResponse {
  if (!isRecord(value)
    || !isNonEmptyString(value.accountId)
    || !isNonEmptyString(value.email)
    || typeof value.displayName !== "string"
    || !isAccountStatus(value.status)
    || !isNonEmptyString(value.createdAt)
    || (value.emailVerifiedAt !== undefined && value.emailVerifiedAt !== null && !isNonEmptyString(value.emailVerifiedAt))) {
    throw contractViolation("The email verification response did not match the backend contract.");
  }
  return {
    accountId: value.accountId,
    email: value.email,
    displayName: value.displayName,
    status: value.status,
    ...(isNonEmptyString(value.emailVerifiedAt) ? { emailVerifiedAt: value.emailVerifiedAt } : {}),
    createdAt: value.createdAt,
  };
}

function validateAcceptance(value: unknown): EmailVerificationRequestAcceptedResponse {
  if (!isRecord(value) || !isNonEmptyString(value.requestId) || !isNonEmptyString(value.acceptedAt)) {
    throw contractViolation("The email verification request response did not match the backend contract.");
  }
  return { requestId: value.requestId, acceptedAt: value.acceptedAt };
}

function contractViolation(message: string): ApiClientError {
  return new ApiClientError({
    code: "EMAIL_VERIFICATION_RESPONSE_INVALID",
    message,
    status: 502,
    retryable: true,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isAccountStatus(value: unknown): value is VerifiedAccountStatus {
  return value === "PENDING_VERIFICATION" || value === "ACTIVE" || value === "SUSPENDED";
}
