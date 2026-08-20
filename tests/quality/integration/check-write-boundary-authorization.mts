import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = repositoryRoot;
const expectedBoundaries: Array<{ file: string; marker: RegExp }> = [
  { file: "src/modules/contacts/application/commands/contactRepositoryCommands.ts", marker: /assertRuntime(?:CommandAccess|Capability)/ },
  { file: "src/modules/customers/application/commands/customerCommands.ts", marker: /assertRuntime(?:CommandAccess|Capability|WorkspaceAccess)/ },
  { file: "src/modules/deals/application/commands/dealRepositoryCommands.ts", marker: /assertRuntime(?:CommandAccess|Capability)/ },
  { file: "src/modules/leads/application/commands/leadRepositoryCommands.ts", marker: /assertRuntime(?:CommandAccess|Capability)/ },
  { file: "src/modules/orders/application/commands/orderRepositoryCommands.ts", marker: /assertRuntime(?:CommandAccess|Capability)/ },
  { file: "src/modules/organizations/application/commands/organizationAccountRepositoryCommands.ts", marker: /assertRuntime(?:CommandAccess|Capability)/ },
  { file: "src/modules/payments/application/commands/paymentCommands.ts", marker: /assertRuntime(?:CommandAccess|Capability)/ },
  { file: "src/modules/products/application/commands/productCatalogCommands.ts", marker: /assertRuntime(?:CommandAccess|Capability)/ },
  { file: "src/modules/quotes/application/commands/quoteRepositoryCommands.ts", marker: /assertRuntime(?:CommandAccess|Capability)/ },
  { file: "src/modules/returns/application/commands/returnCommands.ts", marker: /assertRuntime(?:CommandAccess|Capability)/ },
  { file: "src/modules/shipping/application/commands/shippingCommands.ts", marker: /assertRuntime(?:CommandAccess|Capability)/ },
  { file: "src/modules/support/application/commands/supportCaseRepositoryCommands.ts", marker: /assertRuntime(?:CommandAccess|Capability)/ },
  { file: "src/modules/tasks/application/commands/taskCommands.ts", marker: /assertRuntime(?:CommandAccess|Capability)/ },
  { file: "src/workspaces/people-access/application/peopleAccessCommands.ts", marker: /assert(?:AccessConfigurationAllowed|MembershipStatusChangeAllowed)/ },
  { file: "src/modules/commercial-evidence/application/commands/purchaseEvidenceCommands.ts", marker: /assertRuntimeWorkspaceAccess/ },
];

for (const boundary of expectedBoundaries) {
  const absolute = path.join(root, boundary.file);
  assert.equal(fs.existsSync(absolute), true, `Write boundary is missing: ${boundary.file}`);
  const source = fs.readFileSync(absolute, "utf8");
  assert.match(source, boundary.marker, `${boundary.file} must authorize outside the presentation layer`);
}

const runtimeAuthorization = fs.readFileSync(path.join(root, "src/platform/access-control/runtime/runtimeCommandAuthorization.ts"), "utf8");
for (const marker of ["assertRuntimeWorkspaceAccess", "WorkspaceBoundaryDenied", "WorkspaceMembershipDenied", "CapabilityDenied", "DataScopeDenied", "appendTamperEvidentAuditRecord"]) {
  assert.ok(runtimeAuthorization.includes(marker), `Runtime authorization must include ${marker}`);
}
const accessEvaluation = fs.readFileSync(path.join(root, "src/platform/access-control/domain/evaluateEffectiveAccess.ts"), "utf8");
assert.ok(accessEvaluation.includes("workspaceId !== snapshot.workspaceId"), "Record access must reject cross-workspace records before scope evaluation");

const routeGuard = fs.readFileSync(path.join(root, "src/components/PermissionRouteGuard.tsx"), "utf8");
assert.ok(routeGuard.includes("capability?: Capability"), "PermissionRouteGuard must accept an explicit action capability");
const crmRoutes = fs.readFileSync(path.join(root, "src/app/router/workspaces/crmWorkspaceRoutes.tsx"), "utf8");
assert.ok(crmRoutes.includes("<PermissionRouteGuard capability={capability}>"), "Direct write routes must continue to pass action capabilities to PermissionRouteGuard");

console.log(`Write-boundary authorization: OK — ${expectedBoundaries.length} mutation owners plus tenant, capability, scope, denial-audit, and route contracts verified`);
