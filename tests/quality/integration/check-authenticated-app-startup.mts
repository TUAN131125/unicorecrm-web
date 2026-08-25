import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { build, stop } from "esbuild";
import { JSDOM } from "jsdom";

const root = repositoryRoot;
const mainSource = fs.readFileSync(path.join(root, "src/main.tsx"), "utf8");

assert.ok(mainSource.includes("createHashRouter"), "Authenticated shell startup must use a hash-based data router");
assert.ok(mainSource.includes("RouterProvider"), "Authenticated shell startup must provide DataRouterContext");
assert.match(mainSource, /<RouterProvider\s+router=\{router\}\s+useTransitions=\{false\}/, "Router transitions must remain synchronous at the owner boundary");
assert.equal(/import\s*\{[^}]*\bHashRouter\b/.test(mainSource), false, "Declarative HashRouter cannot host the shell useBlocker contract");

const result = await build({
  absWorkingDir: root,
  entryPoints: ["src/main.tsx"],
  outfile: "authenticated-app-startup.js",
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
assert.ok(browserBundle, "The authenticated startup bundle must be generated in memory");

function createBrowser(url: string) {
  const dom = new JSDOM('<!doctype html><html lang="vi"><body><div id="root"></div></body></html>', {
    url,
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
  browser.scrollTo = () => {};
  browser.Element.prototype.scrollIntoView = () => {};
  Object.defineProperty(browser, "structuredClone", {
    configurable: true,
    value: globalThis.structuredClone,
  });

  type ForeignAbortSignal = {
    readonly aborted: boolean;
    readonly reason?: unknown;
    addEventListener(
      type: "abort",
      listener: () => void,
      options?: { once?: boolean },
    ): void;
  };

  class BrowserRequest extends globalThis.Request {
    constructor(input: RequestInfo | URL, init?: RequestInit) {
      const signal = init?.signal as unknown as
        | ForeignAbortSignal
        | null
        | undefined;

      if (signal && !(signal instanceof globalThis.AbortSignal)) {
        const controller = new globalThis.AbortController();
        const abort = () => controller.abort(signal.reason);

        if (signal.aborted) {
          abort();
        } else {
          signal.addEventListener("abort", abort, { once: true });
        }

        super(input, {
          ...init,
          signal: controller.signal,
        });
        return;
      }

      super(input, init);
    }
  }

  for (const [name, value] of Object.entries({
    Request: BrowserRequest,
    Response: globalThis.Response,
    Headers: globalThis.Headers,
  })) {
    Object.defineProperty(browser, name, {
      configurable: true,
      writable: true,
      value,
    });
  }

  Object.defineProperty(browser, "fetch", {
    configurable: true,
    writable: true,
    value: globalThis.fetch.bind(globalThis),
  });

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

  return { dom, browser, runtimeErrors };
}

async function waitForSelector(browser: ReturnType<typeof createBrowser>["browser"], selector: string): Promise<void> {
  const deadline = Date.now() + 8_000;
  while (!browser.document.querySelector(selector) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

const unauthenticated = createBrowser("https://runtime.test/#/");
unauthenticated.browser.eval(browserBundle.text);
await waitForSelector(unauthenticated.browser, '[data-auth-shell="true"]');
assert.ok(
  unauthenticated.browser.document.querySelector('[data-auth-shell="true"]'),
  `Unauthenticated application startup must render the login shell. Runtime errors:\n${unauthenticated.runtimeErrors.join("\n---\n")}`,
);
assert.ok(unauthenticated.browser.document.querySelector('[data-auth-form="true"]'), "Unauthenticated startup must render the login form");
assert.equal(
  unauthenticated.runtimeErrors.some((message) => message.includes("No workspace membership is available")),
  false,
  "Workspace-scoped subscriptions must not require a workspace before login",
);
unauthenticated.dom.window.close();

const authenticated = createBrowser("https://runtime.test/#/w/unicore-vietnam/crm/dashboard");
const browser = authenticated.browser;
const now = Date.now();
const iso = (value: number) => new Date(value).toISOString();
browser.localStorage.setItem("unicore_auth_session_v2", JSON.stringify({
  sessionId: "dev_session_acct_admin_startup_contract",
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
    deviceId: "dev_device_acct_admin",
    label: "Authenticated startup contract",
    userAgent: "jsdom",
    lastSeenAt: iso(now),
  },
}));
browser.localStorage.setItem("unicore_active_workspace_key_v2", JSON.stringify("unicore-vietnam"));

browser.eval(browserBundle.text);
await waitForSelector(browser, "#unicore-root");

assert.ok(browser.document.querySelector("#unicore-root"), `Authenticated application shell must render. Runtime errors:\n${authenticated.runtimeErrors.join("\n---\n")}`);
assert.ok(browser.document.querySelector('[data-router-pathname="/w/unicore-vietnam/crm/dashboard"]'), "The canonical Dashboard route must commit inside the authenticated shell");
assert.equal(browser.document.body.textContent?.includes("Không thể tải ứng dụng"), false, "Authenticated startup must not fall through to AppErrorBoundary");
assert.equal(authenticated.runtimeErrors.some((message) => message.includes("useBlocker must be used within a data router")), false, "The Studio route blocker must receive DataRouterContext");

authenticated.dom.window.close();

stop();
console.log("Application startup: PASS (unauthenticated login, hash data router, authenticated Dashboard shell)");
