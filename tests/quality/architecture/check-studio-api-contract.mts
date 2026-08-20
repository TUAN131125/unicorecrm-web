import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = repositoryRoot;
const document = JSON.parse(readFileSync(join(root, "docs/api/openapi.json"), "utf8")) as any;
const required: Record<string, string[]> = {
  WorkspaceConfiguration: [
    "/workspace-configuration",
    "/workspace-configuration/business-information",
    "/workspace-configuration/locale-region",
    "/workspace-configuration/blueprint",
    "/workspace-configuration/features",
    "/workspace-configuration/publish",
    "/workspace-configuration/audit",
    "/workspace-configuration/currencies",
    "/workspace-configuration/exchange-rates",
    "/workspace-configuration/exchange-rates/{rateId}",
  ],
  StudioQuickSetup: [
    "/studio/quick-setup",
    "/studio/quick-setup/open",
    "/studio/quick-setup/dismiss-auto-open",
    "/studio/quick-setup/steps/{stepId}/complete",
    "/studio/quick-setup/steps/{stepId}/skip",
  ],
  CrmConfiguration: [
    "/crm-configuration/pipelines",
    "/crm-configuration/pipelines/{pipelineId}",
    "/crm-configuration/pipelines/{pipelineId}/stages",
    "/crm-configuration/pipelines/{pipelineId}/stages/{stageId}",
    "/crm-configuration/object-schemas",
    "/crm-configuration/object-schemas/{objectKey}",
    "/crm-configuration/object-schemas/{objectKey}/fields",
    "/crm-configuration/object-schemas/{objectKey}/fields/{fieldId}",
  ],
  ProductConfiguration: ["/products/configuration/types", "/products/configuration/types/{typeId}"],
  FinancialConfiguration: [
    "/payments/configuration/receiving-accounts",
    "/invoices/configuration/seller-information",
    "/shipping/configuration/pickup-locations",
    "/shipping/configuration/return-locations",
  ],
  IntegrationConfiguration: [
    "/integrations/providers",
    "/integrations/connections",
    "/integrations/connections/{connectionId}",
    "/integrations/connections/{connectionId}/verify",
    "/integrations/connections/{connectionId}/disconnect",
  ],
};
const operationIds = new Set<string>();
let ready = 0;
let blocked = 0;
for (const [tag, paths] of Object.entries(required)) {
  for (const path of paths) {
    assert.ok(document.paths[path], `Missing ${path}`);
    for (const method of ["get", "post", "put", "patch", "delete"]) {
      const operation = document.paths[path][method];
      if (!operation || !operation.tags?.includes(tag)) continue;
      assert.ok(operation.operationId && !operationIds.has(operation.operationId), `Duplicate ${operation.operationId}`);
      operationIds.add(operation.operationId);
      assert.ok(operation.parameters?.some((item: any) => item.$ref?.endsWith("WorkspaceIdHeader")), `${operation.operationId} needs workspace context`);
      assert.equal(operation.parameters?.some((item: any) => item.in === "query" && item.name === "workspaceId"), false);
      const status = operation["x-contract-status"];
      if (status === "PRODUCTION_CONTRACT_READY") {
        ready += 1;
        assert.ok(Object.keys(operation.responses).some((code) => /^2\d\d$/u.test(code)), `${operation.operationId} needs typed success`);
        assert.ok(operation.responses["400"]?.content?.["application/problem+json"]?.schema?.$ref?.endsWith("ProblemDetails"), `${operation.operationId} needs Problem Details`);
        if (method !== "get") {
          assert.ok(operation.parameters?.some((item: any) => item.$ref?.endsWith("IfMatchHeader")), `${operation.operationId} needs If-Match`);
          assert.ok(operation.parameters?.some((item: any) => item.$ref?.endsWith("IdempotencyKeyHeader")), `${operation.operationId} needs Idempotency-Key`);
        }
      } else {
        blocked += 1;
        assert.equal(status, "BLOCKED", `${operation.operationId} has invalid status`);
        assert.equal(Object.keys(operation.responses).some((code) => /^2\d\d$/u.test(code)), false, `${operation.operationId} must fail closed`);
      }
    }
  }
}
for (const file of ["workspaceConfigurationApi.ts", "studioQuickSetupApi.ts", "crmConfigurationApi.ts", "productConfigurationApi.ts", "financialConfigurationApi.ts", "integrationConfigurationApi.ts"]) {
  assert.ok(existsSync(join(root, "src/platform/api/generated", file)), `Missing generated ${file}`);
}
const composition = readFileSync(join(root, "src/app/composition/applicationComposition.ts"), "utf8");
assert.ok(composition.includes("new StudioCoreHttpAdapter("), "Connected composition must install the Studio Core adapter");
assert.ok(composition.includes("configureConnectedStudioCoreGateway"), "Connected composition must bind Studio Core runtime");
const adapter = readFileSync(join(root, "src/workspaces/studio/infrastructure/StudioCoreHttpAdapter.ts"), "utf8");
for (const operationId of ["getWorkspaceConfiguration", "updateWorkspaceBusinessInformation", "updateWorkspaceLocaleRegion", "updateWorkspaceBlueprint", "updateWorkspaceFeatures", "publishWorkspaceConfiguration", "listWorkspaceConfigurationAudit", "getStudioQuickSetup", "openStudioQuickSetup", "dismissStudioQuickSetupAutoOpen", "completeStudioQuickSetupStep", "skipStudioQuickSetupStep"]) {
  assert.ok(adapter.includes(operationId), `StudioCoreHttpAdapter must own ${operationId}`);
}
assert.equal(existsSync(join(root, "src/workspaces/studio/infrastructure/HttpStudioConfigurationGateway.ts")), false);
console.log(`Studio API contract: PASS (${operationIds.size} operations; ${ready} ready; ${blocked} blocked).`);
