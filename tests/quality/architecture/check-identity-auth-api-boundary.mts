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

const adapter = read("src/platform/identity-auth/infrastructure/IdentityAuthHttpAdapter.ts");
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
assert.match(bootstrap, /new IdentityAuthHttpAdapter\(new IdentityApiClient\(identityHttp\)\)/u);
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
