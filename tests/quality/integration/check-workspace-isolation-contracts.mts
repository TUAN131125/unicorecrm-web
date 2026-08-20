import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { StoragePort } from "@/platform/persistence";
import { WorkspaceContextStore, type WorkspaceMembership } from "@/platform/workspace-context/WorkspaceContextStore";

const root = repositoryRoot;
const source = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

class BrowserMemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

class PortMemoryStorage implements StoragePort {
  private values = new Map<string, unknown>();
  get<T>(key: string): T | null { return (this.values.get(key) ?? null) as T | null; }
  set<T>(key: string, value: T): void { this.values.set(key, value); }
  remove(key: string): void { this.values.delete(key); }
}

const memberships: WorkspaceMembership[] = [
  { workspaceId: "ws-a", workspaceKey: "alpha", name: "Alpha", status: "active", logoText: "A" },
  { workspaceId: "ws-b", workspaceKey: "beta", name: "Beta", status: "active", logoText: "B" },
  { workspaceId: "ws-c", workspaceKey: "suspended", name: "Suspended", status: "suspended", logoText: "S" },
];
const workspaceStore = new WorkspaceContextStore(new PortMemoryStorage(), memberships, "workspace-contract-test");
assert.equal(workspaceStore.getSnapshot().workspaceKey, "alpha");
let observedWorkspace = "";
workspaceStore.subscribe((workspace) => { observedWorkspace = workspace.workspaceKey; });
assert.equal(workspaceStore.switchTo("beta").workspaceKey, "beta");
assert.equal(workspaceStore.getSnapshot().workspaceKey, "beta");
assert.equal(observedWorkspace, "beta");
assert.throws(() => workspaceStore.switchTo("unknown"), /membership not found/i);
assert.throws(() => workspaceStore.switchTo("suspended"), /not active/i);

const localStorage = new BrowserMemoryStorage();
const eventTarget = new EventTarget();
const browserWindow = {
  localStorage,
  addEventListener: eventTarget.addEventListener.bind(eventTarget),
  removeEventListener: eventTarget.removeEventListener.bind(eventTarget),
  dispatchEvent: eventTarget.dispatchEvent.bind(eventTarget),
};
Object.defineProperty(globalThis, "window", { value: browserWindow, configurable: true });
Object.defineProperty(globalThis, "localStorage", { value: localStorage, configurable: true });
if (!("navigator" in globalThis)) {
  Object.defineProperty(globalThis, "navigator", { value: { userAgent: "workspace isolation node smoke" }, configurable: true });
}

const identity = await import("@/platform/identity-auth");
const signIn = await identity.authenticateUser({ email: "admin@unicorecrm.local", password: "admin123", deviceLabel: "workspace isolation test" });
assert.equal(signIn.ok, true, "Administrative demo sign-in must create an AAL1 session");

const { initializeApplicationComposition } = await import("@/app/composition");
await initializeApplicationComposition({ mode: "demo" });

const workspaceContext = await import("@/platform/workspace-context");
const workspaceScope = await import("@/platform/workspace-scope");
const leads = await import("@/modules/leads");
const leadCommands = await import("@/modules/leads/application/commands/leadRepositoryCommands");
const leadRuntime = await import("@/modules/leads/runtime/leadModuleRuntime");
const workspaceConfig = await import("@/platform/workspace-config");
const accessControl = await import("@/platform/access-control");

workspaceContext.resetWorkspaceContextSelection();
assert.equal(workspaceContext.getWorkspaceContextSnapshot().workspaceId, "ws1");
await accessControl.loadAccessGovernance("ws1");
assert.equal(workspaceContext.listWorkspaceMemberships().length, 4, "Development admin must resolve membership-scoped workspace choices");
assert.equal(
  accessControl.resolveEffectiveAccess("ws1").canAccessRecord("leads", { workspaceId: "ws2", ownerId: "u1" }),
  false,
  "Record scope must reject a record owned by a different workspace before evaluating owner/team scope",
);

const ws1LeadId = "workspace_one_isolation_sentinel";
const ws2LeadId = "workspace_two_isolation_sentinel";
const ws1Seed = leads.getLeadsSnapshot();
const ws1Template = ws1Seed.find((lead) => lead.leadWorkState === "NEW");
if (!ws1Template) throw new Error(`Workspace 1 needs a NEW Lead template for the isolation contract; visible states=${JSON.stringify(ws1Seed.map((lead) => lead.leadWorkState))}.`);
leadCommands.saveLead(leadRuntime.leadRepository, { ...ws1Template, id: ws1LeadId, name: "Workspace 1 sentinel", ownerId: "u1" });
workspaceConfig.updateWorkspaceConfig((current) => ({ ...current, name: "Workspace One Contract Test" }));

const scopePhases: string[] = [];
const unsubscribeScope = workspaceScope.subscribeToWorkspaceScope((event) => scopePhases.push(event.phase));
const revisionBefore = workspaceScope.getWorkspaceScopeRevision();
workspaceContext.switchWorkspaceContext("unicore-global");
assert.equal(workspaceContext.getWorkspaceContextSnapshot().workspaceId, "ws2");
await accessControl.loadAccessGovernance("ws2");
assert.equal(workspaceScope.getWorkspaceScopeRevision(), revisionBefore + 1);
assert.deepEqual(scopePhases, ["DISPOSING", "INVALIDATING", "LOADING", "READY"], "Workspace switch must dispose and invalidate the previous scope before rendering the next scope");
assert.equal(leads.getLeadsSnapshot().some((lead) => lead.id === ws1LeadId), false, "Workspace 2 must not reuse Workspace 1 repository data");
assert.notEqual(workspaceConfig.getWorkspaceConfigSnapshot().name, "Workspace One Contract Test", "Workspace configuration must be isolated per workspace");

const ws2Seed = leads.getLeadsSnapshot();
const ws2Template = ws2Seed.find((lead) => lead.leadWorkState === "NEW");
if (!ws2Template) throw new Error("Workspace 2 needs a NEW Lead template for the isolation contract.");
leadCommands.saveLead(leadRuntime.leadRepository, { ...ws2Template, id: ws2LeadId, name: "Workspace 2 sentinel", ownerId: "u1" });
workspaceConfig.updateWorkspaceConfig((current) => ({ ...current, name: "Workspace Two Contract Test" }));

scopePhases.length = 0;
workspaceContext.switchWorkspaceContext("unicore-vietnam");
await accessControl.loadAccessGovernance("ws1");
assert.equal(leads.getLeadsSnapshot().some((lead) => lead.id === ws1LeadId), true, "Returning to Workspace 1 must restore its own repository instance");
assert.equal(leads.getLeadsSnapshot().some((lead) => lead.id === ws2LeadId), false, "Workspace 2 data must not leak into Workspace 1");
assert.equal(workspaceConfig.getWorkspaceConfigSnapshot().name, "Workspace One Contract Test");
assert.deepEqual(scopePhases, ["DISPOSING", "INVALIDATING", "LOADING", "READY"]);
unsubscribeScope();

const scopedRuntimeFiles = [
  "src/modules/commercial-evidence/runtime/purchaseEvidenceModuleRuntime.ts",
  "src/modules/contacts/runtime/contactModuleRuntime.ts",
  "src/modules/deals/runtime/dealModuleRuntime.ts",
  "src/modules/leads/runtime/leadModuleRuntime.ts",
  "src/modules/orders/runtime/orderModuleRuntime.ts",
  "src/modules/organizations/runtime/organizationAccountModuleRuntime.ts",
  "src/modules/payments/runtime/paymentModuleRuntime.ts",
  "src/modules/products/runtime/productModuleRuntime.ts",
  "src/modules/quotes/runtime/quoteModuleRuntime.ts",
  "src/modules/returns/runtime/returnModuleRuntime.ts",
  "src/modules/shipping/runtime/shippingModuleRuntime.ts",
  "src/modules/support/runtime/supportModuleRuntime.ts",
  "src/modules/tasks/runtime/taskModuleRuntime.ts",
];
for (const file of scopedRuntimeFiles) {
  const runtime = source(file);
  assert.ok(runtime.includes("createWorkspaceScopedRepository") || runtime.includes("WorkspaceScopedStorageAdapter"), `${file} must use a workspace-scoped runtime boundary`);
}
assert.ok(source("src/platform/workspace-config/workspaceConfigRuntime.ts").includes("WorkspaceScopedStorageAdapter"), "Workspace configuration must use workspace-scoped storage");

const productConfig = source("src/modules/products/infrastructure/productConfiguration.store.ts");
assert.ok(productConfig.includes("WorkspaceScopedStorageAdapter"), "Product configuration must be workspace-scoped");
assert.equal(/\blocalStorage\s*\./.test(productConfig), false, "Product configuration must not directly own global localStorage");

const scopeCoordinator = source("src/platform/workspace-scope/WorkspaceScopeCoordinator.ts");
for (const phase of ["DISPOSING", "INVALIDATING", "LOADING", "READY"]) {
  assert.ok(scopeCoordinator.includes(`"${phase}"`), `Workspace scope coordinator must expose ${phase}`);
}
assert.ok(scopeCoordinator.includes("commitContext()"));

console.log("Workspace isolation contracts: OK");
