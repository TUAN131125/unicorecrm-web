import { walkAllFiles } from "../../../scripts/quality/core/filesystem.mjs";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { BrowserWorkspaceConfigRepository } from "../../../src/platform/workspace-config/BrowserWorkspaceConfigRepository";
import type { StoragePort } from "../../../src/platform/persistence/StoragePort";

class MemoryStorage implements StoragePort {
  private values = new Map<string, unknown>();

  get<T>(key: string): T | null {
    return (this.values.has(key) ? this.values.get(key) : null) as T | null;
  }

  set<T>(key: string, value: T): void {
    this.values.set(key, value);
  }

  remove(key: string): void {
    this.values.delete(key);
  }
}

assert.ok(!fs.existsSync(path.join(repositoryRoot, "src/platform/authorization")), "Legacy active-role impersonation storage must remain removed.");
const configStorage = new MemoryStorage();
configStorage.set("centrix_admin_system_config_v1", {
  organizationName: "Unicore",
  workspaceName: "Configured Workspace",
  enabledModules: { leads: false },
});
const configRepository = new BrowserWorkspaceConfigRepository(configStorage);
assert.equal(configRepository.getSnapshot().name, "Configured Workspace");
assert.equal(configRepository.getSnapshot().modules.leads, false);
let notifications = 0;
configRepository.subscribe(() => {
  notifications += 1;
});
configRepository.update((current) => ({
  ...current,
  name: "Updated Workspace",
  modules: { ...current.modules, deals: false },
}));
assert.equal(configRepository.getSnapshot().name, "Updated Workspace");
assert.equal(configRepository.getSnapshot().modules.deals, false);
assert.equal(notifications, 1);
const persisted = configStorage.get<Record<string, unknown>>("centrix_admin_system_config_v1");
assert.equal(persisted?.organizationName, "Unicore");
assert.equal(persisted?.workspaceName, "Updated Workspace");

const root = repositoryRoot;
const protectedApp = fs.readFileSync(path.join(root, "src/ProtectedCrmApp.tsx"), "utf8");
assert.ok(protectedApp.split("\n").length <= 30, "ProtectedCrmApp should remain a thin composition root.");
assert.ok(!protectedApp.includes("@/modules/"), "ProtectedCrmApp must not subscribe to business modules directly.");
assert.ok(!protectedApp.includes("LegacyCrmCompatibilityProvider"), "ProtectedCrmApp must not host the legacy CRM compatibility provider.");

const crmRoutesPath = path.join(root, "src/app/router/CrmRoutes.tsx");
const crmRoutes = fs.readFileSync(crmRoutesPath, "utf8");
assert.ok(crmRoutes.split("\n").length <= 80, "CrmRoutes should remain a thin workspace route composer.");
assert.ok(crmRoutes.includes("createCrmWorkspaceRoutes"));
assert.ok(crmRoutes.includes("createStudioWorkspaceRoutes"));
assert.ok(crmRoutes.includes("createPeopleAccessWorkspaceRoutes"));
assert.ok(!crmRoutes.includes("createConversationsWorkspaceRoutes"));
assert.ok(!crmRoutes.includes("LegacyCrmCompatibilityProvider"));
assert.ok(!fs.existsSync(path.join(root, "src/app/compatibility")), "Legacy CRM compatibility layer should be removed.");

for (const retiredCompatibilityFile of [
  "src/workspaces/studio/audit-logs.ts",
  "src/workspaces/studio/users-permissions.ts",
]) {
  assert.ok(
    !fs.existsSync(path.join(root, retiredCompatibilityFile)),
    `${retiredCompatibilityFile} must remain removed; People & Access is the runtime owner.`,
  );
}

const studioRoutes = fs.readFileSync(path.join(root, "src/app/router/workspaces/studioWorkspaceRoutes.tsx"), "utf8");
assert.ok(studioRoutes.includes("@/workspaces/studio/presentation/views/BusinessInformationView"));
assert.ok(studioRoutes.includes("@/workspaces/studio/presentation/views/WebhooksApiView"));
assert.equal(studioRoutes.includes("StudioSectionPage"), false);
assert.ok(!studioRoutes.includes("LegacyRedirect"));
assert.ok(!studioRoutes.includes("@/workspaces/studio/users-permissions"));

const peopleRoutes = fs.readFileSync(path.join(root, "src/app/router/workspaces/peopleAccessWorkspaceRoutes.tsx"), "utf8");
assert.ok(peopleRoutes.includes("@/workspaces/people-access/members"));
assert.ok(peopleRoutes.includes("@/workspaces/people-access/audit"));

const workspacePresentationRoots = [
  path.join(root, "src/workspaces/studio/presentation"),
  path.join(root, "src/workspaces/people-access/presentation"),
];
const workspacePresentationFiles = workspacePresentationRoots.flatMap((directory) => walkAllFiles(directory)).filter((file) => /\.(ts|tsx)$/.test(file));
for (const file of workspacePresentationFiles) {
  const source = fs.readFileSync(file, "utf8");
  assert.ok(!/\blocalStorage\b/.test(stripComments(source)), `${path.relative(root, file)} must use platform configuration storage.`);
}

console.log("Application foundation checks: OK");


function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}
