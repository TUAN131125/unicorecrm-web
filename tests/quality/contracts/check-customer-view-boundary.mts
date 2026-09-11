import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = repositoryRoot;
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

for (const removed of [
  "src/workspaces/crm/customer-view",
  "src/compatibility/customer-view-presentation",
  "src/app/router/adapters/customer-view",
  "src/features/customers",
  "src/entities/customer",
]) assert.equal(fs.existsSync(path.join(root, removed)), false, `${removed} must be removed after Customer ownership migration.`);

const customerManifest = read("src/modules/customers/manifest.ts");
assert.match(customerManifest, /CUSTOMER_MODULE_MANIFEST/);
assert.match(customerManifest, /key:\s*["']customers["']/);
assert.equal(customerManifest.includes("customer_view"), false);

const routes = read("src/app/router/workspaces/crmWorkspaceRoutes.tsx");
assert.match(routes, /@\/modules\/customers\/list-route/);
assert.match(routes, /moduleRoute\("customers"/);
assert.equal(routes.includes("customer-view"), false);
assert.equal(routes.includes("customer_view"), false);

const customerRuntime = read("src/modules/customers/runtime/customerModuleRuntime.ts");
assert.match(customerRuntime, /ensureCustomerFromPurchaseEvidence/);
assert.match(customerRuntime, /getPurchaseEvidenceListSnapshot/);
assert.equal(customerRuntime.includes("profiles.flatMap"), false, "Customer runtime list must not be a profile projection.");

const customerList = read("src/modules/customers/presentation/pages/CustomerListPage.tsx");
assert.match(customerList, /customers\?: Customer\[\]/);
const customerListRoute = read("src/modules/customers/list-route.tsx");
assert.match(customerListRoute, /<CustomerListPage\s*\/>/, "Customer List route must delegate connected loading to the authoritative page boundary.");
assert.doesNotMatch(customerListRoute, /getCustomersSnapshot|subscribeToCustomers/, "Connected route must not subscribe to demo repository snapshots.");
assert.match(customerList, /ExistingCustomerOnboardingModal/, "Customer List must expose the admitted direct Customer create flow.");
assert.match(customerList, /Tạo Customer|Create Customer/, "The direct create action must use the admitted Customer contract.");

const customer360 = read("src/modules/customers/presentation/pages/Customer360Page.tsx");
for (const ownerWorkflow of ["createDealForCustomer", "TaskCreateModal"]) assert.match(customer360, new RegExp(ownerWorkflow), `Customer 360 must orchestrate through ${ownerWorkflow}.`);
assert.match(customer360, /support\/cases\/new\?customerId=/, "Customer 360 must delegate Care creation to the canonical Care Case route.");
assert.doesNotMatch(customer360, /createCustomerCareCardWithTask|careOpen|careDraft/, "Customer 360 must not keep a parallel Care Plan creation flow.");
assert.equal(customer360.includes("setCareTasks"), false);

console.log("Customer runtime ownership boundary: PASS");
