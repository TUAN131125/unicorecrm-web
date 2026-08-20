import { walkAllFiles } from "../../../scripts/quality/core/filesystem.mjs";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = repositoryRoot;
const source = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");
const exists = (relativePath: string) => fs.existsSync(path.join(root, relativePath));

const routeKeys = source("src/platform/navigation/routeKeys.ts");
const app = source("src/App.tsx");
const authRoutes = [
  ["LOGIN", "LoginPage"],
  ["MFA_VERIFICATION", "MfaVerificationPage"],
  ["REGISTER", "RegisterPage"],
  ["VERIFY_EMAIL", "VerifyEmailPage"],
  ["FORGOT_PASSWORD", "ForgotPasswordPage"],
  ["RESET_PASSWORD", "ResetPasswordPage"],
  ["INVITATION_ACCEPTANCE", "InvitationAcceptancePage"],
  ["WORKSPACE_SELECTION", "WorkspaceSelectionPage"],
  ["SESSION_EXPIRED", "SessionExpiredPage"],
  ["ACCESS_DENIED", "AccessDeniedPage"],
  ["ACCOUNT_SUSPENDED", "AccountSuspendedPage"],
] as const;
for (const [key, component] of authRoutes) {
  assert.ok(routeKeys.includes(`${key}:`), `Route key ${key} is required`);
  assert.ok(app.includes(`ROUTE_KEYS.${key}`), `App must route ${key}`);
  assert.ok(app.includes(component), `App must render ${component}`);
}
assert.ok(app.includes("<RequireAuth>\n            <WorkspaceSelectionPage"), "Workspace selection must require an authenticated principal");

for (const file of [
  "src/features/auth/pages/LoginPage.tsx",
  "src/features/auth/pages/MfaVerificationPage.tsx",
  "src/features/auth/pages/RegisterPage.tsx",
  "src/features/auth/pages/VerifyEmailPage.tsx",
  "src/features/auth/pages/ForgotPasswordPage.tsx",
  "src/features/auth/pages/ResetPasswordPage.tsx",
  "src/features/auth/pages/InvitationAcceptancePage.tsx",
  "src/features/auth/pages/WorkspaceSelectionPage.tsx",
  "src/features/auth/pages/AuthStatusPages.tsx",
]) {
  assert.ok(exists(file), `${file} must exist`);
  assert.ok(source(file).includes("AuthShell"), `${file} must use the shared AuthShell experience`);
}

const authShell = source("src/features/auth/components/AuthShell.tsx");
const topBar = source("src/app/shell/layout/TopBar.tsx");
const languageSelector = source("src/shared/components/ui/LanguageSelector.tsx");
assert.ok(authShell.includes("UnicoreCRM"), "Auth experience must use UnicoreCRM branding");
assert.equal(authShell.includes("CentrixCRM"), false, "Auth experience must not use old product branding");
assert.ok(authShell.includes("<LanguageSelector") && topBar.includes("<LanguageSelector"), "Auth and Navbar must reuse the shared language selector");
assert.equal(authShell.includes('(["vi", "en"] as const).map'), false, "Auth must not render VI and EN as simultaneous controls");
for (const required of ["Tiếng Việt", "English", "CheckCircle2", 'role="menu"', 'role="menuitemradio"', 'event.key === "Escape"', "max-w-[calc(100vw-2rem)]"]) {
  assert.ok(languageSelector.includes(required), `Language selector must support dropdown behavior: ${required}`);
}
const loginPage = source("src/features/auth/pages/LoginPage.tsx");
assert.ok(loginPage.includes("authenticateUser") && loginPage.includes("await authenticateUser"), "Sign in must call the asynchronous Identity/Auth boundary");
assert.ok(loginPage.includes("isConnectedAuthRuntime") && loginPage.includes("listWorkspaceMembershipsForAccount"), "Connected login must stop at workspace bootstrap while demo login may resolve local memberships");

const authProviderButtons = source("src/features/auth/components/AuthProviderButtons.tsx");
const externalAuthRedirect = source("src/features/auth/routing/externalAuthRedirect.ts");
assert.ok(authProviderButtons.includes('google') && authProviderButtons.includes('microsoft'), "Authentication must offer Google and Microsoft entry points");
assert.ok(loginPage.includes("AuthProviderButtons"), "Sign in must expose external identity-provider choices");
const registerPage = source("src/features/auth/pages/RegisterPage.tsx");
assert.ok(registerPage.includes("AuthProviderButtons"), "Registration must expose external identity-provider choices");
assert.ok(externalAuthRedirect.includes("VITE_AUTH_GOOGLE_URL") && externalAuthRedirect.includes("VITE_AUTH_MICROSOFT_URL"), "External auth must use explicit deployment configuration");
assert.ok(externalAuthRedirect.includes("window.location.assign"), "Configured external auth must redirect through the browser");
assert.equal(registerPage.includes("response.message"), false, "Registration must not render raw identity diagnostics");

for (const forbidden of ["bg-slate-950", "font-black", "font-extrabold", "Session protected", "Bảo vệ phiên", "Security-bound", "biên bảo mật"]) {
  assert.equal(authShell.includes(forbidden), false, `Auth shell must avoid heavy or assurance-oriented presentation: ${forbidden}`);
}
assert.ok(authShell.includes('overflow-x-hidden'), "Auth shell must allow vertical page growth instead of clipping long auth screens");
assert.equal(authShell.includes('leading-[1.02]'), false, "Auth headline line-height must leave room for Vietnamese diacritics");
assert.ok(authShell.includes('data-auth-headline-line="primary"') && authShell.includes('data-auth-headline-line="accent"'), "Auth visual headline must use safe per-line rendering");
assert.ok(authShell.includes('overflow-visible py-[0.08em]') && authShell.includes('overflow-visible py-[0.1em]'), "Auth headline lines must reserve glyph breathing room");
assert.ok(authShell.includes('data-auth-page-title="true"') && authShell.includes('leading-[1.18]'), "Every auth page title must use the safe title rhythm");
assert.ok(authShell.includes('backgroundPosition') && authShell.includes('useReducedMotion'), "Auth headline motion must be subtle and reduced-motion safe");
for (const file of walkAllFiles(path.join(root, "src/features/auth/pages")).filter((candidate) => /\.tsx$/.test(candidate))) {
  const content = fs.readFileSync(file, "utf8");
  for (const forbidden of ["subtitle=", "eyebrow=", "AuthGateway", "backend", "production", "font-black", "font-extrabold"]) {
    assert.equal(content.includes(forbidden), false, `${path.relative(root, file)} must keep auth copy minimal and implementation-neutral: ${forbidden}`);
  }
}
assert.ok(source("src/features/auth/pages/MfaVerificationPage.tsx").includes("AuthCodeField"), "MFA must use the focused verification-code field");

const requireAuth = source("src/app/router/guards/RequireAuth.tsx");
assert.ok(requireAuth.includes("consumeAuthBoundaryReason"), "Expired sessions must resolve to the session-expired experience");
assert.ok(requireAuth.includes("ROUTE_KEYS.SESSION_EXPIRED"), "RequireAuth must route expired sessions explicitly");

for (const directory of ["src/features/auth", "src/app/shell"]) {
  for (const file of walkAllFiles(path.join(root, directory)).filter((candidate) => /\.(ts|tsx)$/.test(candidate))) {
    assert.equal(fs.readFileSync(file, "utf8").includes("CentrixCRM"), false, `${path.relative(root, file)} must not contain old product branding`);
  }
}

console.log("Authentication UX contracts: OK");
