import { walkAllFiles } from "../../../scripts/quality/core/filesystem.mjs";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  createConnectedApplicationServiceBundle,
  getApplicationCompositionStatus,
  getApplicationRuntimeMode,
  initializeApplicationComposition,
} from "../../../src/app/composition/index";
import { resolveApplicationBootstrapPlan } from "../../../src/app/bootstrap/applicationBootstrap";
import { getContactApplicationServices } from "../../../src/modules/contacts/application/composition/contactApplicationServices";
import { getInvoiceApplicationServices } from "../../../src/modules/invoices/application/composition/invoiceApplicationServices";
import { getPaymentApplicationServices } from "../../../src/modules/payments/application/composition/paymentApplicationServices";
import { runBackendProjection } from "../../../src/shared/application/index";
import {
  ConnectedCollectionProjection,
  ConnectedSnapshotProjection,
} from "../../../src/app/composition/connected/connectedProjectionRepositories";
import type { HttpClient } from "../../../src/platform/api/index";

const root = repositoryRoot;
const compositionHttpClient: HttpClient = {
  async request<TResponse>(): Promise<TResponse> {
    return {} as TResponse;
  },
};

const sourceRoots = [
  path.join(root, "src", "modules"),
  path.join(root, "src", "workflows"),
  path.join(root, "src", "workspaces", "people-access", "pilot-acceptance"),
];
const publicRuntimeImports: string[] = [];
for (const sourceRoot of sourceRoots) {
  for (const file of walkAllFiles(sourceRoot)) {
    const relative = path.relative(root, file).replaceAll(path.sep, "/");
    const isPublicBoundary = /\/public\//u.test(relative) || /\/index\.ts$/u.test(relative);
    if (!isPublicBoundary || !/\.(ts|tsx)$/u.test(file)) continue;
    const source = fs.readFileSync(file, "utf8");
    if (/from\s+["'][^"']*\/runtime\//u.test(source) || /from\s+["']\.\.?\/runtime/u.test(source)) {
      publicRuntimeImports.push(relative);
    }
  }
}
assert.deepEqual(publicRuntimeImports, [], `Public boundaries still import runtime: ${publicRuntimeImports.join(", ")}`);

const requiredCompositionFiles = [
  "commercial-evidence", "contacts", "customers", "deals", "invoices", "leads", "orders", "organizations",
  "payments", "products", "quotes", "returns", "shipping", "support", "tasks",
];
for (const moduleKey of requiredCompositionFiles) {
  const compositionDir = path.join(root, "src", "modules", moduleKey, "application", "composition");
  assert.ok(fs.existsSync(compositionDir), `${moduleKey} is missing an application composition boundary.`);
  assert.ok(fs.readdirSync(compositionDir).some((name) => name.endsWith("ApplicationServices.ts")), `${moduleKey} is missing an application services binding.`);
}

const connectedGraphRoots = [
  path.join(root, "src", "app", "composition", "connectedApplicationServiceBundle.ts"),
  path.join(root, "src", "app", "composition", "connected"),
];
const forbiddenConnectedTokens = [
  "demoApplicationServiceBundle",
  "DevelopmentAuthAdapter",
  "BrowserStorageAdapter",
  "LocalMutationAuthority",
  "localStorage",
  "/runtime/",
];
const connectedGraphViolations: string[] = [];
for (const connectedRoot of connectedGraphRoots) {
  const files = fs.statSync(connectedRoot).isDirectory() ? walkAllFiles(connectedRoot) : [connectedRoot];
  for (const file of files.filter((candidate) => /\.ts$/u.test(candidate))) {
    const source = fs.readFileSync(file, "utf8");
    for (const token of forbiddenConnectedTokens) {
      if (source.includes(token)) connectedGraphViolations.push(`${path.relative(root, file)}:${token}`);
    }
  }
}
assert.deepEqual(connectedGraphViolations, [], `Connected graph contains demo/local authority: ${connectedGraphViolations.join(", ")}`);

let telemetryEvents = 0;
const created = createConnectedApplicationServiceBundle(compositionHttpClient, {
  telemetry: (event) => {
    telemetryEvents += 1;
    assert.equal(event.moduleCount, 15);
    assert.equal(event.workflowCount, 5);
  },
});
assert.equal(Object.keys(created.modules).length, 15);
assert.equal(Object.keys(created.workflows).length, 5);
assert.equal(telemetryEvents, 1);
createConnectedApplicationServiceBundle(compositionHttpClient, {
  telemetry: async () => {
    throw new Error("telemetry unavailable");
  },
});
await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0));

await initializeApplicationComposition({ mode: "connected", http: { client: compositionHttpClient } });
assert.equal(getApplicationRuntimeMode(), "connected");
assert.equal(getPaymentApplicationServices().api.constructor.name, "PaymentHttpAdapter");
assert.equal(getInvoiceApplicationServices().api.constructor.name, "InvoiceHttpAdapter");
assert.deepEqual(getApplicationCompositionStatus(), {
  mode: "connected",
  serviceAuthority: "connected-http",
  mutationAuthority: "connected-http",
  httpConfigured: true,
  moduleDataAuthority: "connected-http",
  effectiveRecordAccessAuthority: "connected-http",
  externalAuthorityHealthAuthority: "connected-http",
  auditTrailAuthority: "connected-http",
  configurationAuthority: "generated-http",
});

const contacts = getContactApplicationServices().repository;
assert.throws(
  () => contacts.replace([]),
  (error: unknown) => error instanceof Error && "code" in error && error.code === "CONNECTED_LOCAL_WRITE_FORBIDDEN",
  "Connected projection repositories must reject direct local writes.",
);
runBackendProjection("contacts", () => contacts.replace([]));

const collectionProjection = new ConnectedCollectionProjection<{ id: string; nested: { value: string } }>(
  "contacts",
  (record) => record.id,
);
runBackendProjection("contacts", () => collectionProjection.replace([{ id: "contact-1", nested: { value: "server" } }]));
const mutableCollectionRead = collectionProjection.list();
mutableCollectionRead[0]!.nested.value = "local-mutation";
mutableCollectionRead.push({ id: "contact-2", nested: { value: "local" } });
assert.deepEqual(collectionProjection.list(), [{ id: "contact-1", nested: { value: "server" } }]);

const snapshotProjection = new ConnectedSnapshotProjection("customers", {
  records: [{ id: "customer-1", value: "server" }],
});
const mutableSnapshotRead = snapshotProjection.snapshot();
mutableSnapshotRead.records[0]!.value = "local-mutation";
assert.deepEqual(snapshotProjection.snapshot(), { records: [{ id: "customer-1", value: "server" }] });

const mainSource = fs.readFileSync(path.join(root, "src", "main.tsx"), "utf8");
assert.match(mainSource, /bootstrapApplicationComposition\(\)/u);
assert.match(mainSource, /renderApplication\(\)\.catch\(renderApplicationBootstrapFailure\)/u);
assert.match(mainSource, /renderApplicationBootstrapFailure/u);
assert.doesNotMatch(mainSource, /initializeApplicationComposition\(\{ mode: ["']demo["'] \}\)/u);

// Connected is the default in every environment. Demo stays available, but a deployment has
// to ask for it, so no runtime silently authenticates against browser-local state.
const demoPlan = resolveApplicationBootstrapPlan({ DEV: true, VITE_RUNTIME_MODE: "demo" });
assert.equal(demoPlan.mode, "demo");
assert.deepEqual(demoPlan.composition, { mode: "demo" });
assert.equal(
  resolveApplicationBootstrapPlan({ DEV: true }).mode,
  "connected",
  "A development host must not fall back to demo authority on its own.",
);

let unauthorizedCalls = 0;
let logoutCalls = 0;
const connectedPlan = resolveApplicationBootstrapPlan(
  {
    PROD: true,
    VITE_API_BASE_URL: "https://api.example.test/v1/",
    VITE_API_TIMEOUT_MS: "20000",
  },
  {
    getAccessToken: () => "test-token",
    getWorkspaceId: () => "workspace-test",
    refreshSession: () => false,
    onUnauthorized: () => { unauthorizedCalls += 1; },
    logout: () => { logoutCalls += 1; },
  },
);
assert.equal(connectedPlan.mode, "connected");
assert.equal(connectedPlan.composition.services, undefined);
assert.equal(connectedPlan.composition.http?.baseUrl, "https://api.example.test/v1/");
assert.equal(connectedPlan.composition.http?.defaultTimeoutMs, 20_000);
assert.equal(await connectedPlan.composition.http?.accessTokenProvider?.getAccessToken(), "test-token");
assert.equal(connectedPlan.composition.http?.workspaceIdProvider?.getWorkspaceId(), "workspace-test");
await connectedPlan.composition.http?.onUnauthorized?.();
assert.equal(unauthorizedCalls, 1);
assert.equal(logoutCalls, 1);

let logoutAfterCallbackFailure = 0;
const callbackFailurePlan = resolveApplicationBootstrapPlan(
  { PROD: true, VITE_API_BASE_URL: "https://api.example.test" },
  {
    getAccessToken: () => "token",
    getWorkspaceId: () => "workspace-test",
    onUnauthorized: () => { throw new Error("host notification failed"); },
    logout: () => { logoutAfterCallbackFailure += 1; },
  },
);
await assert.rejects(
  () => callbackFailurePlan.composition.http?.onUnauthorized?.() ?? Promise.resolve(),
  /host notification failed/u,
);
assert.equal(logoutAfterCallbackFailure, 1, "Logout must run even when the host unauthorized callback fails.");

let refreshedUnauthorizedCalls = 0;
const refreshedPlan = resolveApplicationBootstrapPlan(
  { PROD: true, VITE_API_BASE_URL: "https://api.example.test" },
  {
    getAccessToken: () => "token",
    getWorkspaceId: () => "workspace-test",
    refreshSession: () => true,
    onUnauthorized: () => { refreshedUnauthorizedCalls += 1; },
  },
);
await refreshedPlan.composition.http?.onUnauthorized?.();
assert.equal(refreshedUnauthorizedCalls, 0, "A successful session refresh must not trigger logout handling.");

assert.throws(() => resolveApplicationBootstrapPlan({ PROD: true }), /VITE_API_BASE_URL/u);
const internalIdentityPlan = resolveApplicationBootstrapPlan({ PROD: true, VITE_API_BASE_URL: "https://api.example.test" });
assert.equal(internalIdentityPlan.mode, "connected");
assert.equal(await internalIdentityPlan.composition.http?.accessTokenProvider?.getAccessToken(), undefined, "The built-in Identity runtime may start without an authenticated session.");
assert.equal(internalIdentityPlan.composition.http?.workspaceIdProvider?.getWorkspaceId(), undefined, "Workspace bootstrap remains a separate connected boundary.");
assert.throws(
  () => resolveApplicationBootstrapPlan({ PROD: true, VITE_RUNTIME_MODE: "demo" }),
  /VITE_ALLOW_PRODUCTION_DEMO/u,
);
assert.throws(
  () => resolveApplicationBootstrapPlan(
    { PROD: true, VITE_API_BASE_URL: "https://api.example.test", VITE_AUTH_ADAPTER: "development" },
    { getAccessToken: () => "token", getWorkspaceId: () => "workspace-test" },
  ),
  /development authentication adapter/u,
);
await assert.rejects(
  () => initializeApplicationComposition({ mode: "connected", services: created, http: { client: compositionHttpClient } }),
  /Host-injected ApplicationServiceBundle/u,
);
await assert.rejects(
  () => initializeApplicationComposition({ mode: "connected" }),
  /HTTP client or API base URL/u,
);

const compositionSource = fs.readFileSync(path.join(root, "src", "app", "composition", "applicationComposition.ts"), "utf8");
assert.doesNotMatch(compositionSource, /^import[^\n]+demoApplicationServiceBundle/mu);
assert.match(compositionSource, /await import\("\.\/demoApplicationServiceBundle"\)/u);
assert.doesNotMatch(compositionSource, /^import[^\n]+LocalMutationAuthority/mu);
assert.match(compositionSource, /await import\(\s*"@\/shared\/application\/mutation\/LocalMutationAuthority"\s*\)/u);

const bootstrapSource = fs.readFileSync(path.join(root, "src", "app", "bootstrap", "applicationBootstrap.ts"), "utf8");
assert.doesNotMatch(bootstrapSource, /getApplicationServices/u);
assert.match(bootstrapSource, /getWorkspaceId/u);
assert.match(bootstrapSource, /refreshSession/u);
assert.match(bootstrapSource, /logout/u);
assert.match(bootstrapSource, /telemetry/u);

console.log("Application composition contracts: PASS (15 self-composed connected modules, 5 workflows, fail-closed projection writes, narrow host bindings)");
