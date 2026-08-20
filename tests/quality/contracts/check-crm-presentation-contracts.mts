import { walkAllFiles } from "../../../scripts/quality/core/filesystem.mjs";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { readPresentationComposition } from "../../../scripts/lib/presentationCompositionSource.mts";

const root = repositoryRoot;
const source = (relativePath: string) => readPresentationComposition(path.join(root, relativePath), "utf8");
const exists = (relativePath: string) => fs.existsSync(path.join(root, relativePath));

for (const file of [
  "src/components/crm/list-archetype/ListPageFrame.tsx",
  "src/components/crm/list-archetype/ListPageHeader.tsx",
  "src/components/crm/list-archetype/ListToolbar.tsx",
  "src/components/crm/list-archetype/ListBulkActionBar.tsx",
  "src/components/crm/list-archetype/ListStatePanel.tsx",
]) {
  assert.ok(exists(file), `${file} must exist`);
}
assert.ok(source("src/components/crm/list-archetype/ListPageFrame.tsx").includes('data-list-page-archetype="v1"'));
assert.ok(source("src/components/crm/list-archetype/ListToolbar.tsx").includes('data-list-toolbar="v1"'));
assert.ok(source("src/components/crm/list-archetype/ListBulkActionBar.tsx").includes('data-list-bulk-actions="v1"'));
for (const state of ["loading", "empty", "error", "permission"]) {
  assert.ok(source("src/components/crm/list-archetype/ListStatePanel.tsx").includes(`"${state}"`), `ListStatePanel must support ${state}`);
}

for (const file of [
  "src/modules/leads/presentation/pages/LeadListPage.tsx",
  "src/modules/contacts/presentation/pages/ContactListPage.tsx",
  "src/modules/customers/presentation/pages/CustomerListPage.tsx",
  "src/modules/quotes/presentation/pages/QuoteListPage.tsx",
  "src/modules/orders/presentation/pages/OrderListPage.tsx",
]) {
  const text = source(file);
  assert.ok(text.includes("ListPageFrame"), `${file} must use ListPageFrame`);
  assert.ok(text.includes("ListPageHeader"), `${file} must use ListPageHeader`);
  if (!file.includes("modules/customers/")) assert.ok(text.includes("ListStatePanel"), `${file} must use standardized list states`);
}
for (const file of [
  "src/modules/leads/presentation/pages/LeadListPage.tsx",
  "src/modules/contacts/presentation/pages/ContactListPage.tsx",
  "src/modules/quotes/presentation/pages/QuoteListPage.tsx",
  "src/modules/orders/presentation/list/OrderBulkActionBar.tsx",
]) {
  assert.ok(source(file).includes("ListBulkActionBar"), `${file} must use the shared bulk-action contract`);
}

const allSource = walkAllFiles(path.join(root, "src"))
  .filter((file) => /\.(ts|tsx)$/.test(file))
  .map((file) => readPresentationComposition(file, "utf8"))
  .join("\n");
assert.equal(allSource.includes("MegaGenericListPage"), false, "The CRM UI must not introduce a mega generic list component");

assert.ok(exists("src/components/crm/detail-archetype/RecordDetailFrame.tsx"));
assert.ok(source("src/components/crm/detail-archetype/RecordDetailFrame.tsx").includes('data-record-detail-archetype="v1"'));
for (const file of [
  "src/modules/leads/presentation/pages/LeadDetailPage.tsx",
  "src/modules/contacts/presentation/pages/ContactDetailPage.tsx",
  "src/modules/deals/presentation/pages/DealDetailPage.tsx",
  "src/modules/orders/presentation/pages/OrderDetailPage.tsx",
  "src/modules/customers/presentation/pages/Customer360Page.tsx",
]) {
  assert.ok(source(file).includes("RecordDetailFrame"), `${file} must use the detail-page outer contract`);
}

const permissionGuard = source("src/components/PermissionRouteGuard.tsx");
assert.ok(permissionGuard.includes('kind="permission"'));
assert.ok(permissionGuard.includes('data-access-state="permission-denied"'));

console.log("CRM presentation contracts: OK");

