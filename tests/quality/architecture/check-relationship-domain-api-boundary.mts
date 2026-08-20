import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";

const root = repositoryRoot;
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const spec = JSON.parse(read("docs/api/openapi.json"));

for (const [operationId, route, schema] of [
  ["getContactRelationshipSummary", "/contacts/{contactId}/relationship-summary", "ContactRelationshipSummaryReadModel"],
  ["getCustomer360", "/customers/{customerId}/360", "Customer360ReadModel"],
  ["getOrganizationOverview", "/organizations/{organizationId}/overview", "OrganizationOverviewReadModel"],
] as const) {
  const operation = spec.paths[route]?.get;
  assert.equal(operation?.operationId, operationId);
  assert.equal(operation?.["x-contract-status"], "PRODUCTION_CONTRACT_READY");
  assert.equal(operation?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, `#/components/schemas/${schema}`);
  assert.equal(operation?.["x-transaction-boundary"], "READ_ONLY_COMPOSED_PROJECTION");
}

const ownership = JSON.parse(read("scripts/api/openapi/client-ownership.json"));
const commercial = ownership.clients.find((client: any) => client.id === "commercial");
assert.equal(commercial.adapterByTag.Contacts, "src/modules/contacts/infrastructure/http/ContactHttpApiAdapter.ts");
assert.equal(commercial.adapterByTag.Customers, "src/modules/customers/infrastructure/http/CustomerHttpApiAdapter.ts");
assert.equal(commercial.adapterByTag.Organizations, "src/modules/organizations/infrastructure/http/OrganizationHttpApiAdapter.ts");

for (const [moduleName, files, expected] of [
  ["Contacts", [
    "src/modules/contacts/application/ports/ContactApiRuntime.ts",
    "src/modules/contacts/infrastructure/http/ContactApiMapper.ts",
    "src/modules/contacts/infrastructure/http/ContactHttpApiAdapter.ts",
    "src/modules/contacts/infrastructure/http/createContactConnectedApiRuntime.ts",
    "src/modules/contacts/runtime/createContactDemoApiRuntime.ts",
  ], ["getContactRelationshipSummary", "ContactHttpApiAdapter"]],
  ["Customers", [
    "src/modules/customers/application/ports/CustomerApiRuntime.ts",
    "src/modules/customers/infrastructure/http/CustomerApiMapper.ts",
    "src/modules/customers/infrastructure/http/CustomerHttpApiAdapter.ts",
    "src/modules/customers/infrastructure/http/createCustomerConnectedApiRuntime.ts",
    "src/modules/customers/runtime/createCustomerDemoApiRuntime.ts",
  ], ["getCustomer360", "CustomerHttpApiAdapter"]],
  ["Organizations", [
    "src/modules/organizations/application/ports/OrganizationApiRuntime.ts",
    "src/modules/organizations/infrastructure/http/OrganizationApiMapper.ts",
    "src/modules/organizations/infrastructure/http/OrganizationHttpApiAdapter.ts",
    "src/modules/organizations/infrastructure/http/createOrganizationConnectedApiRuntime.ts",
    "src/modules/organizations/runtime/createOrganizationDemoApiRuntime.ts",
  ], ["getOrganizationOverview", "OrganizationHttpApiAdapter"]],
] as const) {
  for (const file of files) assert.ok(fs.existsSync(path.join(root, file)), `${moduleName}: missing ${file}`);
  const source = files.map(read).join("\n");
  for (const marker of expected) assert.match(source, new RegExp(marker));
}

for (const file of [
  "src/modules/contacts/application/vertical-slice/contactAuthoritativeQueries.ts",
  "src/modules/customers/application/vertical-slice/customerAuthoritativeQueries.ts",
  "src/modules/organizations/application/vertical-slice/organizationAuthoritativeQueries.ts",
]) {
  const source = read(file);
  assert.doesNotMatch(source, /createModuleCollectionResource|getModuleDataAuthority|HttpModuleDataAuthority/u, `${file} must use its module API runtime`);
}

const customerProjection = read("src/modules/customers/presentation/model/customer360ReadModel.ts");
assert.match(customerProjection, /demo-only|connected projection/i, "Customer 360 local aggregation must be explicitly demo-only after Phase 13A");

console.log("[relationship-domain-api-boundary] PASS");
