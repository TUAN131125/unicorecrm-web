import { walkAllFiles } from "../../../scripts/quality/core/filesystem.mjs";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ENTERPRISE_SESSION_POLICY, validateEnterpriseSessionPolicy } from "@/platform/enterprise-security";
import { DevelopmentAuthAdapter } from "@/platform/identity-auth/infrastructure/DevelopmentAuthAdapter";

const root = repositoryRoot;
const source = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

assert.deepEqual(validateEnterpriseSessionPolicy(ENTERPRISE_SESSION_POLICY), [], "Enterprise session policy must be internally valid");
assert.equal(ENTERPRISE_SESSION_POLICY.idleTimeoutMinutes, 30);
assert.equal(ENTERPRISE_SESSION_POLICY.requireMfaForAdministrativeAccounts, true);

const developmentAuth = new DevelopmentAuthAdapter();
const adminSignIn = developmentAuth.signIn({ email: "admin@unicorecrm.local", password: "admin123", deviceLabel: "auth contract test" });
assert.equal(adminSignIn.ok, true, "Administrative development accounts must authenticate without demo MFA");
if (!adminSignIn.ok) throw new Error("Expected development admin sign-in success");
assert.equal(adminSignIn.value.principal.accountId, "acct_admin");
assert.equal(adminSignIn.value.principal.memberId, "u1");
assert.equal(adminSignIn.value.assuranceLevel, "AAL1");
assert.equal(adminSignIn.value.mfaVerifiedAt, undefined);
assert.equal(adminSignIn.value.status, "ACTIVE");
assert.ok(adminSignIn.value.idleExpiresAt);
assert.ok(adminSignIn.value.absoluteExpiresAt);
assert.ok(adminSignIn.value.device.deviceId);
assert.equal(developmentAuth.validateSession(adminSignIn.value).ok, true, "Demo admin AAL1 session must remain valid");

const successfulSignIn = developmentAuth.signIn({ email: "sales.rep@unicorecrm.local", password: "welcome123", deviceLabel: "auth contract test" });
assert.equal(successfulSignIn.ok, true, "Non-administrative development account must authenticate after valid credentials");
if (!successfulSignIn.ok) throw new Error("Expected development sign-in success");
assert.equal(successfulSignIn.value.assuranceLevel, "AAL1");

const invalidSignIn = developmentAuth.signIn({ email: "sales.rep@unicorecrm.local", password: "incorrect" });
assert.equal(invalidSignIn.ok, false);
if (invalidSignIn.ok) throw new Error("Expected invalid credentials failure");
assert.equal(invalidSignIn.code, "INVALID_CREDENTIALS");

const refreshed = developmentAuth.refreshSession(successfulSignIn.value);
assert.equal(refreshed.ok, true);
if (!refreshed.ok) throw new Error("Expected development refresh success");
assert.equal(refreshed.value.refreshCounter, successfulSignIn.value.refreshCounter + 1);
assert.equal(refreshed.value.absoluteExpiresAt, successfulSignIn.value.absoluteExpiresAt, "Refresh must not extend the absolute timeout");

developmentAuth.revokeSession(refreshed.value.sessionId, "CONTRACT_TEST");
const revoked = developmentAuth.validateSession(refreshed.value);
assert.equal(revoked.ok, false);
if (revoked.ok) throw new Error("Expected revoked session failure");
assert.equal(revoked.code, "SESSION_REVOKED");

const expiredSession = {
  ...adminSignIn.value,
  idleExpiresAt: new Date(Date.now() - 1_000).toISOString(),
};
const expired = developmentAuth.validateSession(expiredSession);
assert.equal(expired.ok, false);
if (expired.ok) throw new Error("Expected expired session failure");
assert.equal(expired.code, "SESSION_EXPIRED");

const registration = developmentAuth.register({ email: "new.user@example.com", password: "not-used-outside-dev", displayName: "New User" });
assert.equal(registration.ok, true);
if (!registration.ok) throw new Error("Expected development registration contract success");
assert.equal(registration.value.status, "PENDING_VERIFICATION");

const connectedGateway = source("src/platform/identity-auth/application/ConnectedAuthGateway.ts");
const connectedAdapter = source("src/platform/identity-auth/infrastructure/IdentityAuthHttpAdapter.ts");
const bootstrapSource = source("src/app/bootstrap/applicationBootstrap.ts");
assert.ok(connectedGateway.includes("interface ConnectedAuthGateway"), "Connected authentication must expose an application port");
assert.ok(connectedAdapter.includes("class IdentityAuthHttpAdapter"), "Production authentication must have a dedicated HTTP adapter");
assert.ok(connectedAdapter.includes("private accessToken") && connectedAdapter.includes("clearCredentials"), "The connected adapter must own and clear the in-memory access token");
for (const forbidden of ["localStorage", "sessionStorage", "BrowserStorageAdapter"]) {
  assert.equal(connectedAdapter.includes(forbidden), false, `The connected HTTP adapter must not persist credentials through ${forbidden}`);
}
assert.ok(bootstrapSource.includes("new IdentityApiClient") && bootstrapSource.includes("new IdentityAuthHttpAdapter"), "Connected startup must compose the built-in Identity HTTP boundary");
assert.equal(bootstrapSource.includes("Connected runtime requires window.__UNICORECRM_CONNECTED_RUNTIME__.getAccessToken"), false, "Connected startup must render login without a host-injected access token");

const authContracts = source("src/platform/identity-auth/domain/auth.types.ts");
for (const contract of ["UserAccount", "UserIdentity", "UserCredentialReference", "AuthSession", "SessionDevice", "WorkspaceInvitation", "AuthenticationChallenge", "SecurityEvent", "VerifyMfaCommand", "AuthenticatedSessionGrant"]) {
  assert.ok(authContracts.includes(`interface ${contract}`), `Identity/Auth must define the ${contract} contract`);
}
const authRuntimeSource = source("src/platform/identity-auth/runtime/authRuntime.ts");
assert.ok(authRuntimeSource.includes("getSecurityEventsSnapshot"), "Auth runtime must expose security-event audit snapshots");
assert.ok(authRuntimeSource.includes("MFA_CHALLENGE_CREATED") && authRuntimeSource.includes("MFA_VERIFIED"), "MFA lifecycle must produce explicit security events");
assert.ok(authRuntimeSource.includes("validateSession"), "Every persisted session must be revalidated by the configured adapter");
assert.ok(authRuntimeSource.includes("configureConnectedAuthGateway") && authRuntimeSource.includes("bootstrapAuthSession"), "Production runtime must expose explicit connected composition and bootstrap");
assert.ok(authRuntimeSource.includes("unicore_auth_session_v3"), "Connected runtime may persist non-secret session metadata for reload UX");
assert.equal(authRuntimeSource.includes("storage.set(SESSION_KEY, this.gateway.getAccessToken"), false, "Connected runtime must never persist the access token");

assert.equal(fs.existsSync(path.join(root, "src/auth/demoAccounts.ts")), false, "Legacy demoAccounts owner must remain removed");
const loginPage = source("src/features/auth/pages/LoginPage.tsx");
assert.ok(loginPage.includes("@/platform/identity-auth"), "Login page must use the Identity/Auth runtime");
assert.ok(loginPage.includes("await authenticateUser"), "Login page must use the canonical asynchronous authentication boundary");
assert.ok(loginPage.includes("MFA_REQUIRED") && loginPage.includes("MFA_VERIFICATION"), "Login must continue through the MFA challenge route when required");
for (const forbidden of ["@/auth/demoAccounts", "permissionResolver", "saveAuthSession", "centrix_auth_session_v1"]) {
  assert.equal(loginPage.includes(forbidden), false, `Login page must not depend on ${forbidden}`);
}

const credentialFiles = walkAllFiles(path.join(root, "src"))
  .filter((file) => /\.(ts|tsx)$/.test(file))
  .filter((file) => /admin123|welcome123|246810/.test(fs.readFileSync(file, "utf8")));
assert.deepEqual(
  credentialFiles.map((file) => path.relative(root, file).replaceAll("\\", "/")),
  ["src/platform/identity-auth/development/developmentIdentityCatalog.ts"],
  "Known development credentials and MFA code must exist only in the development identity catalog",
);

console.log("Auth and session contracts: OK — demo MFA/session semantics and connected HTTP boundary verified");
