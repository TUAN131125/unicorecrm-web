import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { EFFECTIVE_RECORD_ACCESS_PROFILES } from "@/platform/access-control/domain/effectiveRecordAccessCatalog";
import { HttpEffectiveRecordAccessAuthority } from "@/platform/access-control/infrastructure/HttpEffectiveRecordAccessAuthority";
import { FetchHttpClient } from "@/platform/api/client/FetchHttpClient";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";

// This fixture tests frontend transport and response preservation, not server policy evaluation.
const profile = EFFECTIVE_RECORD_ACCESS_PROFILES.contacts;
assert.deepEqual([...profile.requestedFields], ["fullName", "workEmail", "personalEmail", "mobilePhone", "workPhone", "otherPhone", "organizationRelationships", "ownerId", "consent"]);
for (const alias of ["email", "phone", "organizationId", "consentStatus"]) {
  assert.ok(!profile.requestedFields.includes(alias), `Stale Contact alias: ${alias}`);
}
const response = {
  workspaceId: "fixture-workspace", resourceKey: "contacts",
  canRead: true, canUpdate: true, canDelete: true, canExport: false, canApprove: false,
  allowedCommands: [],
  fieldAccess: { fullName: "READ_WRITE", workEmail: "HIDDEN", personalEmail: "READ_ONLY" },
  decisionReasons: [], evaluatedAt: "2026-01-01T00:00:00Z", authority: "backend",
};
let requests = 0;
const http = new FetchHttpClient({
  baseUrl: "http://contact-profile.test",
  accessTokenProvider: { getAccessToken: () => "local-fixture" },
  workspaceIdProvider: { getWorkspaceId: () => "fixture-workspace" },
  fetchImplementation: async (url, init) => {
    requests++;
    assert.equal(String(url), "http://contact-profile.test/access/records/evaluate");
    assert.equal(init?.method, "POST");
    assert.equal(typeof init?.body, "string");
    const sent = JSON.parse(String(init?.body));
    assert.equal(sent.resourceKey, "contacts");
    assert.deepEqual(sent.requestedFields, [...profile.requestedFields], "Transport must preserve canonical keys.");
    return new Response(JSON.stringify(response), { status: 200, headers: { "Content-Type": "application/json" } });
  },
});
const decision = await new HttpEffectiveRecordAccessAuthority(http).evaluate({ resourceKey: "contacts", requestedFields: profile.requestedFields });
assert.equal(requests, 1);
assert.deepEqual(decision.fieldAccess, response.fieldAccess);
assert.equal(decision.fieldAccess.fullName, "READ_WRITE");
assert.equal(decision.fieldAccess.workEmail, "HIDDEN");
assert.equal(decision.fieldAccess.personalEmail, "READ_ONLY");
assert.equal(Object.values(decision.fieldAccess).filter((value) => value !== "READ_WRITE").length, 2);

// Guard the existing generic notice semantics; do not implement backend policy here.
const boundary = fs.readFileSync(path.join(repositoryRoot, "src/platform/access-control/react/EffectiveRecordAccessBoundary.tsx"), "utf8");
assert.match(boundary, /Object\.values\(access\.data\.fieldAccess\)\.filter\(\(value\) => value !== "READ_WRITE"\)\.length/u);
assert.match(boundary, /showNotice && \(readOnly \|\| restrictedFields > 0\)/u);
console.log("Contact effective-field profile: PASS (profile, HTTP transport, response preservation and generic notice guards).");
