import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { build, stop } from "esbuild";
import { JSDOM } from "jsdom";
import { STUDIO_SECTIONS } from "@/workspaces/studio/navigation/studioSectionRegistry";
import { getConfigurationRuntimeSnapshot } from "@/platform/configuration-runtime";
import {
  classifyRouteScreenError,
  RouteModuleLoadError,
} from "@/app/router/runtime/routeScreenErrors";

const root = repositoryRoot;
const read = (relativePath: string): string => fs.readFileSync(path.join(root, relativePath), "utf8");

const firstConfigurationSnapshot = getConfigurationRuntimeSnapshot();
const secondConfigurationSnapshot = getConfigurationRuntimeSnapshot();
assert.equal(firstConfigurationSnapshot, secondConfigurationSnapshot, "Configuration runtime snapshots must remain referentially stable between writes");
assert.equal(classifyRouteScreenError(new RouteModuleLoadError("test", "IMPORT_FAILED", "test")), "MODULE_LOAD");
assert.equal(classifyRouteScreenError({ code: "CONFIGURATION_SCHEMA_INVALID" }), "CONFIGURATION");
assert.equal(classifyRouteScreenError(new Error("render")), "RENDER");

const saveBarSource = read("src/workspaces/studio/presentation/components/StudioPrimitives.tsx");
assert.ok(saveBarSource.includes("const saveRef = React.useRef(onSave)"), "StudioSaveBar must retain the latest save callback without re-registering unsaved work");
assert.equal(saveBarSource.includes("[dirty, dirtyLabel, onSave, registryId]"), false, "StudioSaveBar registration must not depend on render-local save callback identity");

for (const view of [
  "PaymentInformationView.tsx",
  "InvoiceInformationView.tsx",
  "IntegrationsView.tsx",
  "WebhooksApiView.tsx",
]) {
  const source = read(`src/workspaces/studio/presentation/views/${view}`);
  assert.equal(/useSubscribableSnapshot\([\s\S]{0,180}?\(listener\)\s*=>/u.test(source), false, `${view} must use a stable module-level subscription function`);
}
const pipelineSource = read("src/workspaces/studio/presentation/views/PipelinesStatusesView.tsx");
assert.ok(pipelineSource.includes("function subscribeToDealPipelineSnapshot"), "Pipeline Studio screen must use a stable pipeline snapshot adapter");

const result = await build({
  absWorkingDir: root,
  entryPoints: ["src/main.tsx"],
  outfile: "studio-route-runtime.js",
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
  target: ["es2022"],
  define: {
    // This harness boots the bundle in JSDOM with no API host, so it exercises the
    // browser-only demo runtime explicitly. Connected mode is the default everywhere
    // else and is covered by the connected end-to-end suite.
    "import.meta.env": JSON.stringify({ DEV: true, PROD: false, MODE: "test", BASE_URL: "/", VITE_RUNTIME_MODE: "demo" }),
  },
  loader: { ".css": "empty" },
  alias: { "@": "./src" },
  logLevel: "silent",
});

const browserBundle = result.outputFiles.find((file) => file.path.endsWith(".js"));
assert.ok(browserBundle, "The Studio runtime browser bundle must be generated in memory");

const orderedSections = [...STUDIO_SECTIONS].sort((left, right) => {
  if (left.id === "quick-setup") return 1;
  if (right.id === "quick-setup") return -1;
  return left.order - right.order;
});
const firstPath = `/w/unicore-vietnam/studio/${orderedSections[0].routePath}`;
const dom = new JSDOM('<!doctype html><html lang="vi"><body><div id="root"></div></body></html>', {
  url: `https://runtime.test/#${firstPath}`,
  pretendToBeVisual: true,
  runScripts: "dangerously",
});
const browser = dom.window;

browser.matchMedia = () => ({
  matches: false,
  media: "",
  onchange: null,
  addListener() {},
  removeListener() {},
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() { return false; },
});
browser.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
browser.IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
browser.requestAnimationFrame = (callback) => browser.setTimeout(() => callback(Date.now()), 0);
browser.cancelAnimationFrame = (handle) => browser.clearTimeout(handle);
browser.scrollTo = () => undefined;
browser.Element.prototype.scrollIntoView = () => undefined;
Object.defineProperty(browser, "structuredClone", {
  configurable: true,
  value: globalThis.structuredClone,
});
for (const [name, value] of [
  ["Request", globalThis.Request],
  ["Response", globalThis.Response],
  ["Headers", globalThis.Headers],
  ["AbortController", globalThis.AbortController],
  ["AbortSignal", globalThis.AbortSignal],
] as const) {
  Object.defineProperty(browser, name, { configurable: true, value });
}

const now = Date.now();
const iso = (value: number): string => new Date(value).toISOString();
browser.localStorage.setItem("unicore_auth_session_v2", JSON.stringify({
  sessionId: "dev_session_acct_admin_studio_runtime",
  principal: {
    accountId: "acct_admin",
    memberId: "u1",
    email: "admin@unicorecrm.local",
    displayName: "Nguyễn Văn Admin",
  },
  status: "ACTIVE",
  assuranceLevel: "AAL2",
  mfaVerifiedAt: iso(now),
  issuedAt: iso(now),
  lastSeenAt: iso(now),
  idleExpiresAt: iso(now + 60 * 60 * 1000),
  absoluteExpiresAt: iso(now + 12 * 60 * 60 * 1000),
  refreshCounter: 0,
  device: {
    deviceId: "dev_device_acct_admin_studio_runtime",
    label: "Studio runtime contract",
    userAgent: "jsdom",
    lastSeenAt: iso(now),
  },
}));
browser.localStorage.setItem("unicore_active_workspace_key_v2", JSON.stringify("unicore-vietnam"));

const runtimeErrors: string[] = [];
const originalConsoleError = browser.console.error.bind(browser.console);
browser.console.error = (...args: unknown[]) => {
  runtimeErrors.push(args.map((value) => value instanceof Error ? value.stack || value.message : String(value)).join(" | "));
  originalConsoleError(...args);
};
browser.addEventListener("error", (event) => {
  runtimeErrors.push(event.error instanceof Error ? event.error.stack || event.error.message : event.message);
});
browser.addEventListener("unhandledrejection", (event) => {
  runtimeErrors.push(event.reason instanceof Error ? event.reason.stack || event.reason.message : String(event.reason));
});

async function waitForSelector(selector: string, timeoutMs = 8_000): Promise<Element> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const match = browser.document.querySelector(selector);
    if (match) return match;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out waiting for ${selector} at ${browser.location.hash}.\nRendered UI: ${browser.document.body.textContent?.replace(/\s+/gu, " ").trim().slice(0, 1_000) || "<empty>"}\nRuntime errors:\n${runtimeErrors.join("\n---\n")}`);
}

browser.eval(browserBundle.text);
await waitForSelector("#unicore-root");

const fatalPatterns = [
  "Maximum update depth exceeded",
  "The result of getSnapshot should be cached",
  "Too many re-renders",
  "Uncaught route screen error",
  "RouteModuleLoadError",
];

for (const section of orderedSections) {
  const pathname = `/w/unicore-vietnam/studio/${section.routePath}`;
  if (browser.location.hash !== `#${pathname}`) browser.location.hash = pathname;
  await waitForSelector(`[data-router-pathname="${pathname}"]`);
  await waitForSelector(`[data-studio-route-section="${section.id}"]`);
  await new Promise((resolve) => setTimeout(resolve, 75));

  const routeError = browser.document.querySelector("[data-route-error-kind]");
  assert.equal(routeError, null, `${section.id} must render without falling into the route error boundary`);

  if (section.id === "quick-setup") {
    const sheet = await waitForSelector("[data-quick-setup-sheet]");
    assert.ok(browser.document.querySelector('[data-studio-route-section="business-information"]'), "Direct Quick Setup routes must preserve a valid Studio screen behind the sheet");
    assert.equal(sheet.getAttribute("role"), "dialog", "Quick Setup must render as an accessible dialog sheet");
    assert.equal(sheet.getAttribute("aria-modal"), "true", "Quick Setup sheet must be modal");
    assert.equal(sheet.querySelectorAll("[data-quick-setup-footer]").length, 1, "Quick Setup must expose exactly one footer");
    assert.equal(sheet.querySelector("[data-studio-surface=\"configuration\"]"), null, "Quick Setup must not nest a full Studio page surface");
    assert.equal(sheet.querySelector("[data-studio-save-bar]"), null, "Quick Setup must not nest page-level save bars");
  }

  const fatalError = runtimeErrors.find((message) => fatalPatterns.some((pattern) => message.includes(pattern)));
  assert.equal(fatalError, undefined, `${section.id} emitted a fatal React/runtime error:\n${fatalError ?? ""}`);
}

assert.equal(
  browser.document.body.textContent?.includes("Đã xảy ra lỗi khi tải dữ liệu giao diện"),
  false,
  "Studio must not show the retired catch-all loading-error message",
);

dom.window.close();
stop();
console.log(`Studio route runtime: PASS (${orderedSections.length} sections rendered, accessible Quick Setup sheet, stable subscriptions and snapshots, zero route-boundary failures).`);
