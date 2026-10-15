import assert from "node:assert/strict";
import { IdentityApiClient, type AuthenticatedSessionResponse } from "@/platform/api/generated/identityApi";
import { EmailVerificationApiClient } from "@/platform/api/extensions/emailVerificationApi";
import type { HttpClient, HttpRequest } from "@/platform/api/client/HttpClient";
import { ApiClientError } from "@/platform/api/errors/ApiClientError";
import { IdentityAuthHttpAdapter } from "@/platform/identity-auth/infrastructure/IdentityAuthHttpAdapter";
import { configureConnectedAuthGateway, resetConnectedAuthGateway, authenticateUser, refreshAuthSession, getAuthSessionSnapshot, getConnectedAuthAccessToken } from "@/platform/identity-auth";

// Deterministic boundary regression, separate from real connected acceptance.
export async function runSharedAuthorityRecoveryRegression(): Promise<void> {
  const grant = (id: string): AuthenticatedSessionResponse => ({
    accessToken: `credential-${id}`, accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    session: { sessionId: `session-${id}`, principal: { accountId: id, memberId: `member-${id}`, email: `${id}@example.test`, displayName: id },
      status: "ACTIVE", issuedAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(), idleExpiresAt: new Date(Date.now() + 600_000).toISOString(),
      absoluteExpiresAt: new Date(Date.now() + 600_000).toISOString(), refreshCounter: 0, assuranceLevel: "AAL1", device: { deviceId: "fixture-device", label: "fixture", lastSeenAt: new Date().toISOString() } },
  });
  let pending: { resolve(value: AuthenticatedSessionResponse): void; reject(error: unknown): void } | undefined;
  let refreshCalls = 0;
  const http: HttpClient = { async request<TResponse>(input: HttpRequest): Promise<TResponse> {
    if (input.operationId === "signIn") {
      const body = input.body as { email: string };
      return grant(body.email.split("@")[0] ?? "missing") as TResponse;
    }
    if (input.operationId === "refreshSession") {
      refreshCalls++;
      return await new Promise<AuthenticatedSessionResponse>((resolve, reject) => { pending = { resolve, reject }; }) as TResponse;
    }
    throw new Error(`Unexpected operation ${input.operationId}`);
  } };
  configureConnectedAuthGateway(new IdentityAuthHttpAdapter(new IdentityApiClient(http), new EmailVerificationApiClient(http)));
  try {
    assert((await authenticateUser({ email: "A@example.test", password: "fixture" })).ok);
    const first = refreshAuthSession(), joined = refreshAuthSession();
    assert.equal(refreshCalls, 1, "Same-owner concurrent refresh is coalesced");
    assert(pending); pending.resolve(grant("A"));
    assert((await first).ok && (await joined).ok);
    const staleSuccess = refreshAuthSession();
    assert((await authenticateUser({ email: "B@example.test", password: "fixture" })).ok);
    assert((await authenticateUser({ email: "A@example.test", password: "fixture" })).ok);
    assert(pending); pending.resolve({ ...grant("A"), accessToken: "old-A-credential" });
    assert.equal((await staleSuccess).ok, false, "A/B/A cannot accept an old A grant");
    assert.equal(getConnectedAuthAccessToken(), "credential-A");
    const staleFailure = refreshAuthSession();
    assert((await authenticateUser({ email: "B@example.test", password: "fixture" })).ok);
    assert(pending); pending.reject(new ApiClientError({ code: "SESSION_REVOKED", status: 401, message: "fixture refusal", retryable: false }));
    assert.equal((await staleFailure).ok, false);
    assert.equal(getAuthSessionSnapshot()?.principal.accountId, "B");
    assert.equal(getConnectedAuthAccessToken(), "credential-B", "Old failure cannot clear new credentials");
    const failedCurrent = refreshAuthSession();
    assert(pending); pending.reject(new ApiClientError({ code: "SESSION_REVOKED", status: 401, message: "fixture refusal", retryable: false }));
    assert.equal((await failedCurrent).ok, false);
    assert.equal(getAuthSessionSnapshot(), null);
    assert.equal(getConnectedAuthAccessToken(), undefined);
  } finally { resetConnectedAuthGateway(); }
  console.log("Shared identity recovery: coalescing, A/B/A stale grant, stale failure and current failure PASS.");
}
