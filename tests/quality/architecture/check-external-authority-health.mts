import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  HttpExternalAuthorityHealthAuthority,
} from "../../../src/platform/external-authority";
import type { HttpClient, HttpRequest } from "../../../src/platform/api";

let networkCalls = 0;
const client: HttpClient = {
  async request<TResponse>(_input: HttpRequest): Promise<TResponse> {
    networkCalls += 1;
    throw new Error("Unexpected network call");
  },
};
const authority = new HttpExternalAuthorityHealthAuthority(client);
await assert.rejects(
  authority.evaluate({ workspaceId: "workspace-1", capabilityKey: "orders" }),
  /CONTRACT_OPERATION_BLOCKED|blocked until its OpenAPI projection/u,
);
assert.equal(networkCalls, 0, "Blocked external-authority health must reject before network I/O.");

const read = (relative: string) => fs.readFileSync(path.join(repositoryRoot, relative), "utf8");
const composition = read("src/app/composition/applicationComposition.ts");
assert.match(composition, /configureExternalAuthorityHealthAuthority\(new HttpExternalAuthorityHealthAuthority/);
assert.match(composition, /resetExternalAuthorityHealthAuthority\(\)/);
assert.match(composition, /externalAuthorityHealthAuthority: mode === "connected" \? "connected-http" : "demo-local"/);

const authoritySource = read("src/platform/external-authority/infrastructure/HttpExternalAuthorityHealthAuthority.ts");
assert.match(authoritySource, /CONTRACT_OPERATION_BLOCKED/);
assert.doesNotMatch(authoritySource, /capability-health\//);

const hook = read("src/platform/external-authority/react/useExternalAuthorityHealth.ts");
assert.match(hook, /isExternalAuthorityHealthAuthorityConfigured\(\)/);
assert.match(hook, /workspaceId: workspace\.workspaceId/);
assert.match(hook, /resource\.cancel\(\)/);
assert.match(hook, /status: "UNCONFIGURED"/);
assert.match(hook, /accessMode: "BLOCKED"/);

const panel = read("src/platform/external-authority/react/ExternalAuthorityHealthPanel.tsx");
for (const status of [
  "HEALTHY",
  "DEGRADED",
  "UNAVAILABLE",
  "AUTHENTICATION_EXPIRED",
  "SYNC_DELAYED",
  "RECONCILIATION_REQUIRED",
  "UNCONFIGURED",
]) {
  assert.ok(panel.includes(status), `Provider health UI must cover ${status}.`);
}
assert.match(panel, /data-external-authority-access="BLOCKED"/);
assert.match(panel, /Open Integration Center/);
assert.match(panel, /outstandingReconciliationCount/);
assert.match(panel, /tokenExpiresAt/);

const unavailableState = read("src/components/CapabilityUnavailableState.tsx");
assert.match(unavailableState, /entry\.mode === "EXTERNAL" && <ExternalAuthorityHealthPanel/);
const studioIntegrations = read("src/workspaces/studio/presentation/views/IntegrationsView.tsx");
assert.match(studioIntegrations, /connection service|dịch vụ kết nối/);
assert.doesNotMatch(studioIntegrations, /Kết nối thành công|Connection successful|Test Connection/);

console.log("External authority health: PASS (OpenAPI-blocked connected authority, fail-closed provider states, sync/auth/reconciliation UX)");
