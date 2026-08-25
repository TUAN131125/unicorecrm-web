import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import { walkAllFiles } from "../../../scripts/quality/core/filesystem.mjs";

const root = repositoryRoot;
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");
const requiredFiles = [
  "src/platform/identity-auth/application/ConnectedAuthGateway.ts",
  "src/platform/identity-auth/infrastructure/IdentityAuthHttpAdapter.ts",
  "src/platform/identity-auth/runtime/authRuntime.ts",
  "src/platform/api/generated/identityApi.ts",
  "src/platform/api/extensions/emailVerificationApi.ts",
];
for (const relative of requiredFiles) assert.ok(fs.existsSync(path.join(root, relative)), `Missing Identity/Auth boundary artifact: ${relative}`);

const spec = JSON.parse(read("docs/api/openapi.json"));
const operations = Object.entries(spec.paths).flatMap(([route, item]: [string, any]) =>
  ["get", "post", "put", "patch", "delete"].flatMap((method) => item[method] ? [{ route, method: method.toUpperCase(), ...item[method] }] : []),
);
const identityOperations = operations.filter((operation: any) => operation.tags?.includes("Identity"));
const expectedIds = [
  "acceptWorkspaceInvitation",
  "getCurrentSession",
  "refreshSession",
  "registerAccount",
  "requestPasswordReset",
  "resetPassword",
  "signIn",
  "signOut",
  "verifyEmail",
  "verifyMfa",
];
assert.deepEqual(identityOperations.map((operation: any) => operation.operationId).sort(), expectedIds);
for (const operation of identityOperations) {
  assert.equal(operation["x-contract-status"], "PRODUCTION_CONTRACT_READY", `${operation.operationId} must be production-ready.`);
  assert.equal(operation["x-workspace-required"], false, `${operation.operationId} must not require workspace bootstrap.`);
  assert.equal(operation["x-credentials-policy"], "INCLUDE", `${operation.operationId} must include the cookie-assisted session credential.`);
}
for (const operationId of ["signIn", "verifyMfa", "refreshSession", "registerAccount", "verifyEmail", "requestPasswordReset", "resetPassword"]) {
  const operation = identityOperations.find((candidate: any) => candidate.operationId === operationId);
  assert.deepEqual(operation.security, [], `${operationId} must be callable before an access token exists.`);
}
for (const operationId of ["getCurrentSession", "signOut", "acceptWorkspaceInvitation"]) {
  const operation = identityOperations.find((candidate: any) => candidate.operationId === operationId);
  assert.notDeepEqual(operation.security, [], `${operationId} must require an authenticated principal.`);
}

const ownership = JSON.parse(read("scripts/api/openapi/client-ownership.json"));
const identityClient = ownership.clients.find((client: { id: string }) => client.id === "identity");
assert.ok(identityClient, "Identity generated client ownership is missing.");
assert.equal(identityClient.adapterByTag.Identity, "src/platform/identity-auth/infrastructure/IdentityAuthHttpAdapter.ts");
assert.ok(identityClient.testGateIds.includes("quality.identity-auth-api-boundary"));

const generated = read("src/platform/api/generated/identityApi.ts");
for (const operationId of expectedIds) assert.match(generated, new RegExp(`operationId: "${operationId}"`));
assert.match(generated, /workspace: "none"/u);
assert.match(generated, /credentials: "include"/u);
assert.match(generated, /operationId: "signIn"[\s\S]*?auth: "none"/u);
assert.match(generated, /operationId: "refreshSession"[\s\S]*?auth: "none"/u);

// Email verification is the one Identity operation the pinned OpenAPI document no longer
// describes correctly: it declares an opaque `token`, while the implemented contract carries
// `{ email, code }`, and the resend operation is absent altogether. Both therefore run through
// the semantic-extension client, and the retired token request shape must not come back.
const emailVerification = read("src/platform/api/extensions/emailVerificationApi.ts");
assert.match(emailVerification, /path: "\/auth\/email-verifications"/u, "The OTP client must own POST /auth/email-verifications.");
assert.match(emailVerification, /path: "\/auth\/email-verification-requests"/u, "The OTP client must own POST /auth/email-verification-requests.");
assert.match(emailVerification, /contractAuthority: "semantic-extension"/u, "The OTP operations must declare their own contract authority.");
assert.doesNotMatch(emailVerification, /\btoken\??\s*:/u, "The retired token-based verification request member must not reappear.");
assert.match(emailVerification, /interface VerifyEmailCodeRequest \{\s*email: string;\s*code: string;\s*\}/u, "The verification request carries the address and the six-digit code.");
assert.match(emailVerification, /auth: "none"/u, "Verification necessarily runs before any access token exists.");
assert.match(emailVerification, /workspace: "none"/u, "Verification must not require a workspace.");
const generatedVerifyEmailRequest = /interface VerifyEmailRequest \{[^}]*\}/u.exec(generated)?.[0] ?? "";
assert.match(generatedVerifyEmailRequest, /token: string/u, "The generated client still reflects the retired contract, so the adapter must not depend on it.");

// A verification attempt is spent when it is sent: the server counts it against a ceiling of
// five before it answers. Replaying one therefore burns the holder's remaining attempts
// against a problem no retry can fix, and a resend replayed after its cooldown restarts is a
// second code nobody asked for. Both operations must declare `retry: "never"`, which is also
// what keeps a 401 from being read as an expired session and answered with a refresh replay.
const OTP_OPERATION_PATHS = ["/auth/email-verifications", "/auth/email-verification-requests"] as const;
const REPLAYABLE_RETRY_MODES = ["idempotent", "default"] as const;

function otpRequestBlock(source: string, operationPath: string): string {
  const block = new RegExp(`path: "${operationPath.replaceAll("/", "\\/")}"[\\s\\S]*?\\}\\);`, "u").exec(source)?.[0];
  assert.ok(block, `The OTP client must declare a request for ${operationPath}.`);
  return block;
}

function assertOtpRequestsAreNonReplayable(source: string): void {
  for (const operationPath of OTP_OPERATION_PATHS) {
    const block = otpRequestBlock(source, operationPath);
    assert.match(block, /retry: "never"/u, `${operationPath} must declare a non-replayable retry mode.`);
    assert.doesNotMatch(block, /retry: "(?:idempotent|default)"/u, `${operationPath} must not declare a replayable retry mode.`);
  }
}

assertOtpRequestsAreNonReplayable(emailVerification);

// Negative control: the assertion above must be capable of failing. Each operation is
// rewritten in memory to every replayable mode in turn and the check must reject it. Nothing
// is written to disk, so the control cannot leave the tree mutated.
for (const operationPath of OTP_OPERATION_PATHS) {
  for (const mode of REPLAYABLE_RETRY_MODES) {
    const block = otpRequestBlock(emailVerification, operationPath);
    const mutated = emailVerification.replace(block, block.replace(/retry: "never"/u, `retry: "${mode}"`));
    assert.notEqual(mutated, emailVerification, `The negative control for ${operationPath} did not change the source.`);
    assert.throws(
      () => assertOtpRequestsAreNonReplayable(mutated),
      /must declare a non-replayable retry mode|must not declare a replayable retry mode/u,
      `The gate must fail when ${operationPath} is changed to retry: "${mode}".`,
    );
  }
}

// `retry: "never"` only means anything while the transport keeps honouring it, in both of the
// places that can put a spent attempt back on the wire: the retry loop, and the 401 handler
// that replays a request once a refresh succeeds.
const httpClientSource = read("src/platform/api/client/FetchHttpClient.ts");
assert.match(
  httpClientSource,
  /if \(input\.retry === "never"\) return 1;/u,
  'FetchHttpClient must cap a "never" request at a single attempt.',
);
const replayAfterRefreshGuard = /private canReplayAfterRefresh\([\s\S]*?\n  \}/u.exec(httpClientSource)?.[0] ?? "";
assert.match(
  replayAfterRefreshGuard,
  /input\.retry === "idempotent"/u,
  "Only an explicitly idempotent request may be replayed after an unauthorized refresh; a verification attempt must not be.",
);
assert.match(
  replayAfterRefreshGuard,
  /isSafeMethod\(input\.method\)/u,
  "The unauthorized replay guard must keep distinguishing safe methods from command retries.",
);

const adapter = read("src/platform/identity-auth/infrastructure/IdentityAuthHttpAdapter.ts");
assert.doesNotMatch(adapter, /this\.api\.verifyEmail\(/u, "The adapter must not issue the retired token-based verifyEmail request.");
assert.match(adapter, /this\.emailVerification\.verifyEmail\(/u, "Email verification must go through the OTP client.");
assert.match(adapter, /this\.emailVerification\.requestEmailVerification\(/u, "Resend must go through the OTP client.");
assert.match(adapter, /code: command\.code\.trim\(\)/u, "The verification request must carry the submitted code.");
assert.match(adapter, /private accessToken: string \| undefined/u);
assert.match(adapter, /clearCredentials\(\)/u);
assert.doesNotMatch(adapter, /localStorage|sessionStorage/u, "The connected adapter must not persist tokens in browser storage.");
const runtime = read("src/platform/identity-auth/runtime/authRuntime.ts");
assert.match(runtime, /new BrowserStorageAdapter\(browserSessionStorage\)/u, "Only non-secret session metadata may use sessionStorage.");
assert.doesNotMatch(runtime, /storage\.set\([^\n]*accessToken/u, "Access tokens must never be persisted.");
assert.match(runtime, /authenticateUser/u);
assert.match(runtime, /terminateAuthSession/u);

const login = read("src/features/auth/pages/LoginPage.tsx");
assert.match(login, /await authenticateUser/u);
assert.doesNotMatch(login, /\bsignIn\s*\(/u);
assert.doesNotMatch(login, /setTimeout\s*\(/u, "Login must await the backend rather than simulate latency.");
const pageContracts: Array<[string, RegExp, RegExp]> = [
  ["src/features/auth/pages/MfaVerificationPage.tsx", /await verifyMfaAuthentication/u, /verifyMfaChallenge/u],
  ["src/features/auth/pages/RegisterPage.tsx", /await registerAccount/u, /registerUser/u],
  ["src/features/auth/pages/VerifyEmailPage.tsx", /await verifyAccountEmail/u, /\bverifyEmail\s*\(/u],
  ["src/features/auth/pages/VerifyEmailPage.tsx", /await requestAccountEmailVerification/u, /\brequestEmailVerification\s*\(/u],
  ["src/features/auth/pages/ForgotPasswordPage.tsx", /await requestAccountPasswordReset/u, /\brequestPasswordReset\s*\(/u],
  ["src/features/auth/pages/ResetPasswordPage.tsx", /await completeAccountPasswordReset/u, /\bresetPassword\s*\(/u],
  ["src/features/auth/pages/InvitationAcceptancePage.tsx", /await acceptWorkspaceInvitation/u, /\bacceptInvitation\s*\(/u],
];
for (const [relative, required, forbidden] of pageContracts) {
  const source = read(relative);
  assert.match(source, required, `${relative} must use the async connected boundary.`);
  assert.doesNotMatch(source, forbidden, `${relative} still calls the legacy synchronous boundary.`);
}

const bootstrap = read("src/app/bootstrap/applicationBootstrap.ts");
assert.match(bootstrap, /new IdentityAuthHttpAdapter\(new IdentityApiClient\(identityHttp\), new EmailVerificationApiClient\(identityHttp\)\)/u);
assert.match(bootstrap, /await bootstrapAuthSession\(\)/u);
assert.match(bootstrap, /getConnectedAuthAccessToken/u);
assert.doesNotMatch(bootstrap, /requires window\.__UNICORECRM_CONNECTED_RUNTIME__\.getAccessToken/u);

const violations: string[] = [];
for (const file of walkAllFiles(path.join(root, "src")).filter((file) => /\.(?:ts|tsx)$/u.test(file))) {
  const relative = path.relative(root, file).replaceAll(path.sep, "/");
  const source = fs.readFileSync(file, "utf8");
  if (!/identityApi/u.test(source)) continue;
  const allowed = relative === "src/platform/identity-auth/infrastructure/IdentityAuthHttpAdapter.ts"
    || relative === "src/app/bootstrap/applicationBootstrap.ts"
    || relative === "src/platform/api/generated/index.ts"
    || relative === "src/platform/api/catalog/generatedApiOperationCatalog.ts";
  if (!allowed && relative !== "src/platform/api/generated/identityApi.ts") violations.push(relative);
}
assert.deepEqual(violations, [], `Generated Identity client leaked outside infrastructure/composition:\n${violations.join("\n")}`);

console.log(`[identity-auth-api-boundary] PASS ${identityOperations.length} operations, memory-only access token and async UI boundary`);
