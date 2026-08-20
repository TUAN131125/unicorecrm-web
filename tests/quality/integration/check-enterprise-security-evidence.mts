import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  ENTERPRISE_SESSION_POLICY,
  appendTamperEvidentAuditRecord,
  applyWorkspaceRestore,
  createWorkspaceBackupArchive,
  getTamperEvidentAuditSnapshot,
  isValidSecretReference,
  planWorkspaceRestore,
  redactSecretReference,
  sanitizeSensitiveValue,
  canonicalStringify,
  sha256,
  validateEnterpriseSessionPolicy,
  verifyTamperEvidentAuditLedger,
  verifyWorkspaceBackupArchive,
} from "@/platform/enterprise-security";
import type { StoragePort } from "@/platform/persistence";

class MemoryPort implements StoragePort {
  values = new Map<string, unknown>();
  get<T>(key: string): T | null { return (this.values.get(key) ?? null) as T | null; }
  set<T>(key: string, value: T): void { this.values.set(key, structuredClone(value)); }
  remove(key: string): void { this.values.delete(key); }
}

class MemoryBrowserStorage implements Storage {
  values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

assert.equal(sha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
assert.equal(canonicalStringify({ b: undefined, a: 1 }), '{"a":1}', "Canonical JSON must omit undefined object properties like JSON.stringify");
assert.equal(canonicalStringify([1, undefined, 3]), '[1,null,3]', "Canonical JSON must preserve array positions like JSON.stringify");
assert.equal(canonicalStringify({ at: new Date("2026-07-13T00:00:00.000Z"), invalid: Number.NaN }), '{"at":"2026-07-13T00:00:00.000Z","invalid":null}', "Canonical JSON must honor toJSON and non-finite number semantics");
assert.deepEqual(validateEnterpriseSessionPolicy(ENTERPRISE_SESSION_POLICY), []);

const auditPort = new MemoryPort();
appendTamperEvidentAuditRecord({ scopeId: "ws-contract", category: "DATA_CHANGE", action: "Created", actorId: "acct-1", subjectId: undefined, metadata: { password: "must-not-leak", customer: "A", optional: undefined } }, auditPort);
appendTamperEvidentAuditRecord({ scopeId: "ws-contract", category: "AUTHORIZATION", action: "Denied", actorId: "acct-2", metadata: { token: "eyJabcdefghijklmnopqrstuvwxyz1234567890", reason: "scope" } }, auditPort);
const verification = verifyTamperEvidentAuditLedger("ws-contract", auditPort);
assert.equal(verification.valid, true);
assert.equal(verification.records, 2);
const records = getTamperEvidentAuditSnapshot("ws-contract", auditPort);
assert.equal(records[0].metadata?.password, "[REDACTED]");
assert.equal(records[1].metadata?.token, "[REDACTED]");
assert.equal(records[1].previousHash, records[0].recordHash);

const ledgerKey = "unicore_tamper_evident_audit_v1:ws-contract";
const tampered = structuredClone(auditPort.get<any[]>(ledgerKey)!);
tampered[0].action = "Changed after append";
auditPort.set(ledgerKey, tampered);
const tamperedVerification = verifyTamperEvidentAuditLedger("ws-contract", auditPort);
assert.equal(tamperedVerification.valid, false);
assert.equal(tamperedVerification.firstInvalidSequence, 1);

assert.equal(isValidSecretReference("vault://workspace/provider/credential"), true);
assert.equal(isValidSecretReference("sk_live_123"), false);
assert.equal(redactSecretReference("vault://workspace/provider/credential"), "vault://workspace/••••/credential");
assert.deepEqual(sanitizeSensitiveValue({ authorization: "Bearer abc", nested: { apiKey: "secret" }, safe: "visible" }), {
  authorization: "[REDACTED]",
  nested: { apiKey: "[REDACTED]" },
  safe: "visible",
});

const source = new MemoryBrowserStorage();
source.setItem("workspace:ws1:leads:records", JSON.stringify([{ id: "l1" }]));
source.setItem("unicore_access_control_v1:ws1", JSON.stringify({ revision: 2 }));
source.setItem("workspace:ws2:leads:records", JSON.stringify([{ id: "other" }]));
source.setItem("unicore_auth_session_v2", JSON.stringify({ token: "excluded" }));
const archive = createWorkspaceBackupArchive("ws1", "acct-admin", source);
assert.equal(verifyWorkspaceBackupArchive(archive), true);
assert.equal(archive.entries.length, 2);
assert.equal(archive.entries.some((entry) => entry.key.includes("ws2")), false);
assert.equal(archive.entries.some((entry) => /auth_session/i.test(entry.key)), false);

const target = new MemoryBrowserStorage();
target.setItem("workspace:ws1:leads:records", JSON.stringify([{ id: "older" }]));
const plan = planWorkspaceRestore(archive, "ws1", target);
assert.equal(plan.canApply, true);
assert.deepEqual(plan.keysToReplace, ["workspace:ws1:leads:records"]);
assert.deepEqual(plan.keysToCreate, ["unicore_access_control_v1:ws1"]);
applyWorkspaceRestore(archive, "ws1", target);
assert.equal(target.getItem("workspace:ws1:leads:records"), source.getItem("workspace:ws1:leads:records"));
assert.equal(planWorkspaceRestore(archive, "ws2", target).canApply, false, "Restore must reject a different tenant");

const root = repositoryRoot;
const operationalAudit = fs.readFileSync(path.join(root, "src/platform/operational-audit/index.ts"), "utf8");
assert.ok(operationalAudit.includes("appendTamperEvidentAuditRecord"), "Operational writes must append tamper-evident evidence");
assert.ok(operationalAudit.includes("unicore_operational_activity_v1") && operationalAudit.includes("MAX_ENTRIES_PER_WORKSPACE"), "Workspace activity must retain a bounded persistent log");
const peopleCommands = fs.readFileSync(path.join(root, "src/workspaces/people-access/application/peopleAccessCommands.ts"), "utf8");
assert.ok(peopleCommands.includes("revokeAccountSessions") && peopleCommands.includes("WorkspaceMemberSuspended"), "Suspending a member must revoke sessions and record activity evidence");
for (const action of ["MemberInvitationCreated", "WorkspaceMemberAdded", "MemberAccessChanged", "MemberInvitationRevoked"]) {
  assert.ok(peopleCommands.includes(action), `People & Access commands must record ${action}`);
}
const authRuntime = fs.readFileSync(path.join(root, "src/platform/identity-auth/runtime/authRuntime.ts"), "utf8");
assert.ok(authRuntime.includes("env?.PROD === true") && authRuntime.includes('return "unavailable"'), "Production auth must fail closed when no adapter is configured");
const auditPage = fs.readFileSync(path.join(root, "src/workspaces/people-access/presentation/pages/AuditLogsPage.tsx"), "utf8");
assert.ok(auditPage.includes("PeopleActivityLog") && auditPage.includes("Nhật ký hoạt động"), "People & Access must expose the administration activity log");
assert.doesNotMatch(auditPage, /Demo Mode|Sao lưu và khôi phục|createWorkspaceBackupArchive|applyWorkspaceRestore/, "The activity page must not mix demo, backup, or restore tools into member and permission history");

console.log("Enterprise security evidence: OK — session policy, tamper evidence, secret redaction, backup/restore tenant checks, and People & Access activity contracts verified");
