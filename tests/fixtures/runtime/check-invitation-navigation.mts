import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import type { ConnectedAuthGateway } from "@/platform/identity-auth/application/ConnectedAuthGateway";
import type { AuthSession, AuthResult, InvitationAcceptanceResult } from "@/platform/identity-auth/domain/auth.types";
import type { WorkspaceMembership } from "@/platform/workspace-membership";

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: "http://localhost", pretendToBeVisual: true });
const { window } = dom;
for (const key of ["window", "document", "navigator", "localStorage", "HTMLElement", "SVGElement", "Element", "Node", "Event", "CustomEvent", "EventTarget", "MutationObserver"] as const) {
  Object.defineProperty(globalThis, key, { value: key === "window" ? window : window[key], configurable: true });
}
Object.defineProperties(globalThis, {
  IS_REACT_ACT_ENVIRONMENT: { value: true, configurable: true },
  getComputedStyle: { value: window.getComputedStyle.bind(window), configurable: true },
  requestAnimationFrame: { value: window.requestAnimationFrame.bind(window), configurable: true },
  cancelAnimationFrame: { value: window.cancelAnimationFrame.bind(window), configurable: true },
});
Object.defineProperty(window, "matchMedia", { value: () => ({ matches: true, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }) });
const React = await import("react");
const { act } = React;
const { createRoot } = await import("react-dom/client");
const { createMemoryRouter, RouterProvider } = await import("react-router-dom");
const { I18nProvider } = await import("@/i18n");
const { ROUTE_KEYS, productSpaceHome } = await import("@/platform/navigation");
const { configureConnectedAuthGateway, bootstrapAuthSession, resetConnectedAuthGateway } = await import("@/platform/identity-auth");
const { configureConnectedWorkspaceBootstrapGateway, resetConnectedWorkspaceBootstrapGateway } = await import("@/platform/workspace-context");
const { resolveSafePostLoginRedirect, withRedirectQuery } = await import("@/features/auth/routing/postLoginRedirect");
const { LoginPage } = await import("@/features/auth/pages/LoginPage");
const { RegisterPage } = await import("@/features/auth/pages/RegisterPage");
const { VerifyEmailPage } = await import("@/features/auth/pages/VerifyEmailPage");
const { InvitationAcceptancePage } = await import("@/features/auth/pages/InvitationAcceptancePage");
const membershipRuntime = await import("@/platform/workspace-membership");

const now = new Date().toISOString();
const session: AuthSession = { sessionId: "session-invitation-fixture", principal: { accountId: "account-fixture", memberId: "member-fixture", email: "invitee@example.test", displayName: "Invitee" }, status: "ACTIVE", issuedAt: now, lastSeenAt: now, idleExpiresAt: new Date(Date.now() + 60_000).toISOString(), absoluteExpiresAt: new Date(Date.now() + 120_000).toISOString(), refreshCounter: 0, assuranceLevel: "AAL1", device: { deviceId: "fixture-browser", label: "Test", lastSeenAt: now } };
const unavailable = async () => ({ ok: false, code: "SERVICE_UNAVAILABLE", message: "not available" } as const);
let signInUnverified = false;
let calls = 0;
let finishAcceptance: ((value: AuthResult<InvitationAcceptanceResult>) => void) | undefined;
const gateway: ConnectedAuthGateway = {
  bootstrap: async () => ({ ok: true, value: session }),
  signIn: async () => signInUnverified ? ({ ok: false, code: "EMAIL_NOT_VERIFIED", message: "verification required" }) : ({ ok: true, value: { outcome: "AUTHENTICATED", grant: { session, accessToken: "memory-only-fixture", accessTokenExpiresAt: session.idleExpiresAt } } }),
  verifyMfa: unavailable, getCurrentSession: async () => ({ ok: true, value: session }), refreshSession: unavailable, signOut: unavailable,
  register: async () => ({ ok: true, value: { accountId: session.principal.accountId, email: session.principal.email, displayName: "Invitee", status: "PENDING_VERIFICATION", createdAt: now } }),
  verifyEmail: async () => ({ ok: true, value: { accountId: session.principal.accountId, email: session.principal.email, displayName: "Invitee", status: "ACTIVE", emailVerifiedAt: now, createdAt: now } }),
  requestEmailVerification: unavailable, requestPasswordReset: unavailable, resetPassword: unavailable,
  acceptInvitation: async () => { calls++; return new Promise(resolve => { finishAcceptance = resolve; }); },
  getAccessToken: () => "memory-only-fixture", clearCredentials() {},
};
configureConnectedAuthGateway(gateway);
await bootstrapAuthSession();

const host = window.document.getElementById("root");
assert.ok(host);
const root = createRoot(host);
const token = "invitation-fixture&must-stay-in-token";
const invitationPath = `${ROUTE_KEYS.INVITATION_ACCEPTANCE}?${new URLSearchParams({ token })}`;
const loginPath = withRedirectQuery(ROUTE_KEYS.LOGIN, invitationPath);
function routerAt(path: string) {
  return createMemoryRouter([
    { path: ROUTE_KEYS.LOGIN, element: React.createElement(LoginPage) },
    { path: ROUTE_KEYS.REGISTER, element: React.createElement(RegisterPage) },
    { path: ROUTE_KEYS.VERIFY_EMAIL, element: React.createElement(VerifyEmailPage) },
    { path: ROUTE_KEYS.INVITATION_ACCEPTANCE, element: React.createElement(InvitationAcceptancePage) },
    { path: productSpaceHome("real-invited-workspace", "crm"), element: React.createElement("div", null, "Authoritative workspace") },
  ], { initialEntries: [path] });
}
let mountCount = 0;
async function mount(router: ReturnType<typeof routerAt>) {
  await act(async () => root.render(React.createElement(I18nProvider, null, React.createElement(RouterProvider, { router, key: ++mountCount }))));
}
async function input(selector: string, value: string) {
  const element = host?.querySelector<HTMLInputElement>(selector);
  assert.ok(element, selector);
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set?.call(element, value);
    element.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
}
async function submit() {
  const form = host?.querySelector("form"); assert.ok(form);
  await act(async () => { form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); });
}
window.localStorage.setItem("unicore_last_login_email", session.principal.email);
let router = routerAt(loginPath);
await mount(router);
const registerLink = host.querySelector<HTMLAnchorElement>(`a[href^="${ROUTE_KEYS.REGISTER}"]`);
assert.ok(registerLink);
assert.equal(new URL(registerLink.href).searchParams.get("redirect"), invitationPath, "Registration link preserves the opaque invitation target");
await input('input[type="password"]', "fixture-password");
await submit();
assert.equal(router.state.location.pathname + router.state.location.search, invitationPath, "Connected sign-in returns to the invitation before workspace provisioning");

signInUnverified = true;
await act(async () => { await router.navigate(loginPath); });
await input('input[type="password"]', "fixture-password");
await submit();
assert.equal(router.state.location.pathname, ROUTE_KEYS.VERIFY_EMAIL);
assert.equal(new URLSearchParams(router.state.location.search).get("redirect"), invitationPath);
const backToLogin = host.querySelector<HTMLAnchorElement>(`a[href^="${ROUTE_KEYS.LOGIN}"]`);
assert.ok(backToLogin);
assert.equal(new URL(backToLogin.href).searchParams.get("redirect"), invitationPath, "Verification retains the validated invitation redirect");
signInUnverified = false;

await act(async () => { await router.navigate(withRedirectQuery(ROUTE_KEYS.REGISTER, invitationPath)); });
await input('input[autocomplete="name"]', "Invited person");
await input('input[autocomplete="email"]', session.principal.email);
await input('input[autocomplete="new-password"]', "fixture-password");
const terms = host.querySelector<HTMLInputElement>('input[type="checkbox"]'); assert.ok(terms);
await act(async () => { terms.click(); });
await submit();
assert.equal(router.state.location.pathname, ROUTE_KEYS.VERIFY_EMAIL);
assert.equal(new URLSearchParams(router.state.location.search).get("redirect"), invitationPath, "Invited registration preserves the return target through verification");
await input('input[autocomplete="one-time-code"]', "123456");
await submit();
const verifiedLogin = host.querySelector<HTMLAnchorElement>(`a[href^="${ROUTE_KEYS.LOGIN}"]`);
assert.ok(verifiedLogin);
assert.equal(new URL(verifiedLogin.href).searchParams.get("redirect"), invitationPath, "Successful verification preserves the invitation on return to login");

let memberships: WorkspaceMembership[] = [];
let provisions = 0;
let bootstraps = 0;
const invitedMembership: WorkspaceMembership = { accountId: session.principal.accountId, memberId: session.principal.memberId, membershipId: "real-invited-membership", workspaceId: "real-invited-id", workspaceKey: "real-invited-workspace", name: "Real workspace", logoText: "RW", status: "active", teamIds: [], roleAssignmentIds: [] };
configureConnectedWorkspaceBootstrapGateway({
  listMyWorkspaces: async () => memberships,
  ensureInitialWorkspace: async () => { provisions++; return "PROVISIONED"; },
  getWorkspaceBootstrap: async workspaceId => {
    bootstraps++; assert.equal(workspaceId, invitedMembership.workspaceId);
    return { workspace: invitedMembership, contextVersion: 1, capabilities: [], resolvedAt: now, configuration: { configurationVersion: 1, locale: "en", timeZone: "UTC", baseCurrency: "USD", enabledModuleKeys: [], availableProductSpaces: ["crm"] } };
  },
});
await act(async () => { await router.navigate(invitationPath); });
let button = host.querySelector<HTMLButtonElement>('button[type="button"][class*="bg-gradient"]'); assert.ok(button);
await act(async () => { button?.click(); button?.click(); });
assert.equal(calls, 1, "Repeated clicks cannot dispatch duplicate acceptance");
assert.ok(finishAcceptance);
await act(async () => { finishAcceptance?.({ ok: true, value: { workspaceId: invitedMembership.workspaceId, membershipId: invitedMembership.membershipId ?? "", acceptedAt: now } }); });
assert.equal(router.state.location.pathname, ROUTE_KEYS.INVITATION_ACCEPTANCE, "No navigation before authoritative membership exists");
assert.equal(bootstraps, 0);
assert.equal(provisions, 0, "Invitation acceptance never provisions a personal workspace");
memberships = [invitedMembership];
button = host.querySelector<HTMLButtonElement>('button[type="button"][class*="bg-gradient"]'); assert.ok(button);
await act(async () => { button?.click(); });
await act(async () => { finishAcceptance?.({ ok: true, value: { workspaceId: invitedMembership.workspaceId, membershipId: invitedMembership.membershipId ?? "", acceptedAt: now } }); });
assert.equal(router.state.location.pathname, productSpaceHome("real-invited-workspace", "crm"));
assert.equal(bootstraps, 1);
assert.equal(provisions, 0);

const storageKey = "unicore_workspace_people_v1:ws1";
const poisoned = JSON.stringify({ schemaVersion: 2, workspaceId: "ws1", revision: 99, invitations: [{ invitationId: "forged", status: "PENDING" }], additionalMemberships: [{ accountId: session.principal.accountId, workspaceId: "ws1", status: "active" }] });
window.localStorage.setItem(storageKey, poisoned);
assert.deepEqual(membershipRuntime.listWorkspaceMembershipDirectory("ws1"), []);
assert.deepEqual(membershipRuntime.listCurrentWorkspaceMemberships(), []);
assert.deepEqual(membershipRuntime.getWorkspacePeopleSnapshot("ws1").invitations, []);
assert.throws(() => membershipRuntime.updateWorkspaceMembershipStatus("ws1", "fake", "active"));
assert.equal(window.localStorage.getItem(storageKey), poisoned, "Connected paths neither consume nor overwrite Development authority");
for (const unsafe of ["https://evil.example/", "//evil.example/", "/\\evil.example", "/login", "/auth/../login", "%2F%2Fevil.example", "/%zz", "/\n/evil.example"]) assert.equal(resolveSafePostLoginRedirect(unsafe), null, unsafe);
assert.equal(resolveSafePostLoginRedirect(invitationPath), invitationPath);
await act(async () => root.unmount());
resetConnectedWorkspaceBootstrapGateway();
resetConnectedAuthGateway();
dom.window.close();
console.log("Invitation navigation: PASS (connected redirect, verification handover, authoritative entry, duplicate click, no provisioning, Development isolation, safe return URLs)");
