import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import type { HttpRequest } from "@/platform/api/client/HttpClient";

const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/reset-password?token=recovery-fixture-secret", pretendToBeVisual: true });
for (const key of ["window", "document", "navigator", "HTMLElement", "Element", "Node", "MutationObserver", "localStorage"] as const) {
  Object.defineProperty(globalThis, key, { value: key === "window" ? dom.window : dom.window[key], configurable: true });
}
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { value: true, configurable: true });
dom.window.localStorage.setItem("centrix_locale", "en");
dom.window.matchMedia = (query: string) => ({ matches: true, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } });
const React = await import("react");
const { act } = React;
const { createRoot } = await import("react-dom/client");
const { BrowserRouter, useNavigate } = await import("react-router-dom");
const { I18nProvider } = await import("@/i18n");
const { ForgotPasswordPage } = await import("@/features/auth/pages/ForgotPasswordPage");
const { ResetPasswordPage } = await import("@/features/auth/pages/ResetPasswordPage");
const { IdentityApiClient } = await import("@/platform/api/generated/identityApi");
const { EmailVerificationApiClient } = await import("@/platform/api/extensions/emailVerificationApi");
const { IdentityAuthHttpAdapter } = await import("@/platform/identity-auth/infrastructure/IdentityAuthHttpAdapter");
const { configureConnectedAuthGateway, resetConnectedAuthGateway } = await import("@/platform/identity-auth");
const { ApiClientError } = await import("@/platform/api/errors/ApiClientError");
let failure: string | null = "INTEGRATION_UNAVAILABLE";
let release: (() => void) | undefined;
const requests: HttpRequest[] = [];
const http = { async request<T>(request: HttpRequest): Promise<T> {
  requests.push(request);
  if (release) await new Promise<void>(resolve => { release = resolve; });
  if (failure) throw new ApiClientError({ code: failure, status: failure === "TOKEN_EXPIRED" || failure === "TOKEN_INVALID" ? 401 : 503, message: "sensitive-provider-diagnostic" });
  return (request.operationId === "requestPasswordReset" ? { requestId: "request-is-not-a-secret", acceptedAt: "2026-10-29T00:00:00Z" } : { completedAt: "2026-10-29T00:00:00Z" }) as T;
} };
configureConnectedAuthGateway(new IdentityAuthHttpAdapter(new IdentityApiClient(http), new EmailVerificationApiClient(http)));
const element = dom.window.document.getElementById("root");
assert.ok(element);
const root = createRoot(element);
let navigateWithinPage: ReturnType<typeof useNavigate> | undefined;
function NavigationProbe() { navigateWithinPage = useNavigate(); return null; }
const settle = async (action: () => void) => { await act(async () => { action(); }); };
const mount = async (page: typeof ForgotPasswordPage | typeof ResetPasswordPage, key: string) => {
  await settle(() => root.render(React.createElement(BrowserRouter, { key }, React.createElement(I18nProvider, null, React.createElement(React.Fragment, null, React.createElement(NavigationProbe), React.createElement(page))))));
};
const fill = async (index: number, value: string) => {
  const input = element.querySelectorAll("input")[index];
  assert.ok(input);
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")?.set;
  assert.ok(setter);
  await settle(() => { setter.call(input, value); input.dispatchEvent(new dom.window.Event("input", { bubbles: true })); });
};
const submit = async () => {
  const form = element.querySelector("form"); assert.ok(form);
  await settle(() => { form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })); });
};
try {
  dom.window.history.replaceState(null, "", "/forgot-password");
  await mount(ForgotPasswordPage, "forgot");
  await fill(0, "member@example.test");
  await submit();
  assert.ok(element.querySelector("form"), "HTTP failure must leave the request form available");
  assert.match(element.textContent ?? "", /temporarily unavailable/);
  assert.equal(element.textContent?.includes("sensitive-provider-diagnostic"), false);
  failure = null;
  await submit();
  assert.equal(element.querySelector("form"), null);
  assert.match(element.textContent ?? "", /If the account is eligible/);
  assert.equal(element.querySelector('a[href*="token="]'), null, "Connected request IDs cannot become reset links");

  dom.window.history.replaceState(null, "", "/reset-password?token=recovery-fixture-secret");
  await mount(ResetPasswordPage, "reset");
  assert.equal(dom.window.location.search, "", "The token must be removed from the current history entry");
  assert.equal(JSON.stringify(dom.window.history.state).includes("recovery-fixture-secret"), false);
  await fill(0, "new-password-fixture"); await fill(1, "mismatched");
  const before = requests.length;
  await submit();
  assert.equal(requests.length, before, "Mismatched confirmation must not issue an HTTP command");
  await fill(1, "new-password-fixture");
  failure = "TOKEN_EXPIRED";
  await submit(); assert.match(element.textContent ?? "", /has expired/);
  failure = "TOKEN_INVALID";
  await submit(); assert.match(element.textContent ?? "", /already been used/);
  failure = "INTEGRATION_UNAVAILABLE";
  await submit(); assert.match(element.textContent ?? "", /temporarily unavailable/);
  failure = null; release = () => undefined;
  await submit();
  const count = requests.length;
  await submit();
  assert.equal(requests.length, count, "Repeated submit while pending must issue only one command");
  await settle(() => { release?.(); release = undefined; });
  assert.match(element.textContent ?? "", /Password updated/);
  assert.equal(element.querySelectorAll("input").length, 0);
  const body = requests.at(-1)?.body as { token: string; nextPassword: string };
  assert.equal(body.token, "recovery-fixture-secret", "Removing the URL must preserve the in-memory token through submission");
  assert.equal(body.nextPassword, "new-password-fixture");
  const persisted = Object.keys(dom.window.localStorage).map(key => dom.window.localStorage.getItem(key)).join("|");
  assert.equal(persisted.includes("recovery-fixture-secret"), false);
  assert.equal(persisted.includes("new-password-fixture"), false);

  dom.window.history.replaceState(null, "", "/reset-password");
  await mount(ResetPasswordPage, "missing");
  assert.equal(element.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled, true);

  assert.ok(navigateWithinPage);
  await settle(() => { void navigateWithinPage?.("/reset-password?token=token-A"); });
  await fill(0, "password-for-token-A"); await fill(1, "password-for-token-A");
  release = () => undefined;
  await submit();
  const finishOldRequest = release;
  assert.equal((requests.at(-1)?.body as { token: string }).token, "token-A");
  await settle(() => { void navigateWithinPage?.("/reset-password?token=token-B"); });
  assert.equal(dom.window.location.search, "");
  assert.equal(element.querySelector<HTMLInputElement>("input")?.value, "", "A new token must clear the old password");
  assert.equal(element.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled, false);
  await settle(() => { release = undefined; finishOldRequest?.(); });
  assert.ok(element.querySelector("form"), "Completion for token A cannot complete the replacement token B form");
  await fill(0, "password-for-token-B"); await fill(1, "password-for-token-B");
  await submit();
  assert.equal((requests.at(-1)?.body as { token: string }).token, "token-B", "Same-mounted route replacement must submit the incoming token");
  assert.match(element.textContent ?? "", /Password updated/);
  await settle(() => { void navigateWithinPage?.("/reset-password?token=token-C"); });
  assert.ok(element.querySelector("form"), "A new token must reopen a completed form");
  assert.equal(element.querySelector<HTMLInputElement>("input")?.value, "");
  await fill(0, "password-for-token-C"); await fill(1, "password-for-token-C");
  release = () => undefined;
  await submit();
  const failOldRequest = release;
  await settle(() => { void navigateWithinPage?.("/reset-password?token=token-D"); });
  await fill(0, "password-for-token-D"); await fill(1, "password-for-token-D");
  await submit();
  const finishCurrentRequest = release;
  failure = "TOKEN_EXPIRED";
  await settle(() => { failOldRequest?.(); });
  assert.equal(element.textContent?.includes("has expired"), false, "A stale failure cannot replace the current form feedback");
  const pendingCurrentCount = requests.length;
  await submit();
  assert.equal(requests.length, pendingCurrentCount, "A stale finally block cannot unlock the current pending command");
  failure = null;
  await settle(() => { release = undefined; finishCurrentRequest?.(); });
  assert.match(element.textContent ?? "", /Password updated/);
  console.log("Password recovery connected UI: errors, acceptance, token history and replacement, stale completion isolation, validation, duplicate submit and secret persistence PASS.");
} finally {
  await settle(() => root.unmount());
  resetConnectedAuthGateway(); dom.window.close();
}
