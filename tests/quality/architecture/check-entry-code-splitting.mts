import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = repositoryRoot;
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");
const app = read("src/App.tsx");
const vite = read("vite.config.ts");
const packageJson = JSON.parse(read("package.json"));
const budget = read("tests/quality/architecture/check-bundle-budget.mjs");

assert.equal(app.includes('import { ProtectedCrmApp } from "./ProtectedCrmApp"'), false, "Authenticated shell must not be statically imported by the public entry.");
assert.ok(app.includes('React.lazy(() => import("./ProtectedCrmApp")'), "Authenticated shell must be a lazy route boundary.");
for (const page of [
  "LoginPage",
  "MfaVerificationPage",
  "RegisterPage",
  "VerifyEmailPage",
  "ForgotPasswordPage",
  "ResetPasswordPage",
  "InvitationAcceptancePage",
  "WorkspaceSelectionPage",
]) {
  assert.ok(app.includes(`const ${page} = React.lazy(`), `${page} must be lazy-loaded from the public entry.`);
}
assert.ok(app.includes('import("./features/auth/pages/AuthStatusPages")'), "Authentication status pages must share a lazy chunk.");
assert.ok(vite.includes("manifest: true"), "Vite must emit a manifest so build output can be budgeted deterministically.");
assert.ok(packageJson.scripts.build.includes("check-bundle-budget.mjs"), "Production build must enforce the bundle budget.");
assert.ok(budget.includes("500 * 1024"), "Bundle budget must remain fixed at 500 KiB per JavaScript chunk.");
assert.ok(budget.includes("Every production JavaScript chunk"), "Budget guard must cover every JavaScript chunk, not only the entry.");

console.log("Entry code-splitting contracts: PASS (auth routes and authenticated shell are lazy; 500 KiB build budget enforced)");
