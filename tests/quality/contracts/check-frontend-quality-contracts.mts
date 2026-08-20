import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { escapeSpreadsheetSafeCsvCell, neutralizeSpreadsheetFormula } from "../../../src/shared/lib/csv/spreadsheetSafeCsv";
import { serializeProductsAsCsv } from "../../../src/modules/products/application/import-export/productCsv";
import { resolveSafePostLoginRedirect, withRedirectQuery } from "../../../src/features/auth/routing/postLoginRedirect";

const root = repositoryRoot;
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

for (const value of [
  "=1+1",
  "+cmd|' /C calc'!A0",
  "-2+3",
  "@SUM(1,1)",
  "\t=1+1",
  "\r=1+1",
  " \u00A0=HYPERLINK(\"https://example.invalid\",\"Open\")",
]) {
  assert.equal(neutralizeSpreadsheetFormula(value).startsWith("'"), true, `CSV formula prefix must be neutralized: ${JSON.stringify(value)}`);
}
assert.equal(neutralizeSpreadsheetFormula("Normal customer"), "Normal customer");
assert.equal(escapeSpreadsheetSafeCsvCell('A "quoted" value'), '"A ""quoted"" value"');

const csv = serializeProductsAsCsv([{
  id: "prod_test",
  sku: "=1+1",
  name: "@SUM(1,1)",
  type: "service",
  category: "+Category",
  listPrice: 1,
  costPrice: 1,
  currency: "VND",
  billingCycle: "one_time",
  status: "active",
  tags: ["-unsafe"],
  unit: "item",
  taxRate: 0,
  taxMode: "exclusive",
  isSubscription: false,
  isRenewable: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
} as never]);
assert.match(csv, /"'=1\+1"/u);
assert.match(csv, /"'@SUM\(1,1\)"/u);

const canonical = "/w/unicore-vietnam/crm/dashboard?view=mine";
assert.equal(resolveSafePostLoginRedirect(canonical), canonical);
assert.equal(resolveSafePostLoginRedirect("/accept-invitation?token=abc"), "/accept-invitation?token=abc");
for (const hostile of [
  "%",
  "https://evil.example/path",
  "//evil.example/path",
  "/\\evil.example/path",
  "%2F%2Fevil.example/path",
  "/login",
  "/w/%/crm/dashboard",
]) {
  assert.equal(resolveSafePostLoginRedirect(hostile), null, `Unsafe redirect must be rejected: ${hostile}`);
}
const loginUrl = withRedirectQuery("/login", canonical);
assert.equal(new URLSearchParams(loginUrl.split("?")[1]).get("redirect"), canonical);

const dialog = read("src/shared/components/ui/Dialog.tsx");
const drawer = read("src/shared/components/ui/Drawer.tsx");
const overlayHook = read("src/shared/components/ui/useAccessibleOverlay.ts");
const topBar = read("src/app/shell/layout/TopBar.tsx");
assert.match(dialog, /aria-labelledby=\{title \? titleId : undefined\}/u);
assert.match(dialog, /useAccessibleOverlay/u);
assert.match(drawer, /aria-labelledby=\{title \? titleId : undefined\}/u);
assert.match(drawer, /useAccessibleOverlay/u);
assert.match(overlayHook, /event\.key !== "Tab"/u);
assert.match(overlayHook, /trigger\.focus/u);
assert.match(overlayHook, /element\.inert/u);
assert.match(topBar, /<Modal[\s\S]*id="global-search-dialog"/u);
assert.match(topBar, /role="combobox"/u);
assert.match(topBar, /aria-live="polite"/u);

const login = read("src/features/auth/pages/LoginPage.tsx");
const mfa = read("src/features/auth/pages/MfaVerificationPage.tsx");
assert.doesNotMatch(login, /decodeURIComponent\(redirect\)/u);
assert.doesNotMatch(mfa, /decodeURIComponent\(redirect\)/u);
assert.match(login, /common\.hidePassword/u);
assert.match(login, /common\.showPassword/u);

for (const [file, pattern] of [
  ["src/app/shell/layout/Sidebar.tsx", /aria-label=\{vi \? "Đóng điều hướng" : "Close navigation"\}/u],
  ["src/modules/deals/presentation/components/DealFormModal.tsx", /Remove \$\{item\.product\.name\}/u],
  ["src/components/crm/ColumnSettingsDrawer.tsx", /Move \$\{keyLabel\} up/u],
] as const) {
  assert.match(read(file), pattern, `${file} must expose localized accessible names for icon controls`);
}
assert.match(read("src/modules/contacts/presentation/detail/ContactCreateOpportunityModal.tsx"), /<DealFormModal/u, "Contact opportunity creation must delegate its icon controls to the accessible Deal form.");

console.log("Frontend quality contracts passed.");
