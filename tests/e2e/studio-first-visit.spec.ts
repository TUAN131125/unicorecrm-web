import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { writeFile, access } from "node:fs/promises";
import path from "node:path";

test("Studio first visit uses persisted workspace Quick Setup and currency", async ({ browser, page }, info) => {
  test.setTimeout(180_000);
  const results: { test: string; status: string }[] = [];
  const http: { method: string; path: string; status: number; correlationId: string | undefined }[] = [];
  const control = process.env.UNICORECRM_TEST_CONTROL_DIR;
  if (!control) throw new Error("Requires the isolated Studio verifier (no demo fallback)");
  const controlDirectory: string = control;
  const currencies: { phase: string; currency: string; connectedProjection: boolean }[] = [];
  const pass = (name: string) => results.push({ test: name, status: "PASS" });
  const sheet = (p: Page) => p.locator('[data-quick-setup-sheet="true"]');
  const workspaceId = process.env.UNICORECRM_TEST_WORKSPACE_ID ?? "";
  const key = process.env.UNICORECRM_TEST_WORKSPACE_KEY ?? "";
  const secondKey = process.env.UNICORECRM_TEST_SECOND_KEY ?? "";
  const studio = `/#/w/${key}/studio`;
  function observe(p: Page) {
    p.on("response", response => {
      const pathname = new URL(response.url()).pathname;
      if (/studio\/quick-setup|workspace-configuration|\/bootstrap$/u.test(pathname)) http.push({ method: response.request().method(), path: pathname, status: response.status(), correlationId: response.request().headers()["x-correlation-id"] });
    });
  }
  async function login(p: Page) {
    await p.goto("/#/login");
    await p.getByLabel("Email", { exact: true }).fill(process.env.UNICORECRM_TEST_EMAIL ?? "");
    await p.getByLabel(/Mật khẩu|Password/u, { exact: true }).fill(process.env.UNICORECRM_TEST_PASSWORD ?? "");
    await p.getByRole("button", { name: /^(Đăng nhập|Sign in)$/u }).click();
    await p.waitForURL(/#\/(?:select-workspace|w\/[^/]+\/crm\/)/u);
    await p.goto(`/#/w/${key}/crm/leads`);
    await p.waitForURL(/#\/w\/[^/]+\/crm\//u);
    await expect(p.getByRole("button", { name: "Thiết lập", exact: true })).toBeVisible();
  }
  async function observeCurrency(p: Page, phase: string) {
    const value = await p.evaluate(async () => {
      const modulePath = "/src/platform/workspace-config/workspaceOperationalConfigurationRuntime.ts";
      const runtime = await import(modulePath);
      return { currency: runtime.getWorkspaceOperationalConfiguration().localeRegion.currencies.baseCurrency as string,
        connectedProjection: runtime.isConnectedWorkspaceOperationalConfigurationProjection() as boolean };
    });
    currencies.push({ phase, ...value });
  }
  async function close(p: Page) {
    const dismissed = p.waitForResponse(r => r.request().method() === "POST" && r.url().endsWith("/studio/quick-setup/dismiss-auto-open"));
    await sheet(p).getByRole("button", { name: /Đóng|Close/u, exact: true }).click();
    expect((await dismissed).status()).toBe(200);
    await expect(sheet(p)).toBeHidden();
  }
  async function signal(name: string) {
    await writeFile(path.join(controlDirectory, `${name}.request`), "test control only");
    await expect.poll(async () => { try { await access(path.join(controlDirectory, `${name}.done`)); return true; } catch { return false; } }, { timeout: 30_000 }).toBe(true);
  }
  async function enter(p: Page) { await p.goto(studio); }
  async function absent(p: Page) {
    await expect(p).toHaveURL(/studio\/settings\/business-information/u);
    await expect(sheet(p)).toBeHidden();
  }
  let other: BrowserContext | undefined;
  try {
    observe(page);
    await login(page);
    await observeCurrency(page, "CRM fresh login before Studio");
    // Hold the real HTTP response to prove no popup is rendered before authority loads.
    let release: (() => void) | undefined;
    const held = new Promise<void>(resolve => { release = resolve; });
    await page.route("**/studio/quick-setup", async route => { await held; await route.continue(); });
    await enter(page);
    await expect(page.getByRole("status").filter({ hasText: /cấu hình Studio|Studio configuration|Thiết lập nhanh|Quick Setup/u })).toBeVisible();
    await expect(sheet(page)).toBeHidden();
    release?.();
    await expect(sheet(page)).toBeVisible();
    await page.unroute("**/studio/quick-setup");
    pass("First Studio visit opens after authoritative load, without popup flash");
    await page.screenshot({ path: info.outputPath("first-visit.png") });
    await close(page);
    pass("Close persists dismissal without completing setup");
    await enter(page); await absent(page);
    pass("Second Studio visit does not reopen");
    await page.getByRole("button", { name: "CRM", exact: true }).click();
    await page.getByRole("button", { name: "Thiết lập", exact: true }).click();
    await absent(page);
    pass("SPA navigation back to Studio reloads authority without reopening");
    await page.reload(); await absent(page);
    pass("Refresh does not reopen");
    await page.locator("#user-profile-dropdown").click();
    await page.getByRole("menuitem", { name: "Đăng xuất", exact: true }).click();
    await page.waitForURL(/#\/login/u);
    await login(page); await enter(page); await absent(page);
    pass("Explicit logout/login does not reopen");
    other = await browser.newContext();
    const fresh = await other.newPage(); observe(fresh); await login(fresh); await enter(fresh); await absent(fresh);
    pass("Fresh browser context with independent sign-in does not reopen");
    await other.close(); other = undefined;
    await page.getByRole("link", { name: /Thiết lập nhanh|Quick Setup/u }).first().click();
    await expect(sheet(page)).toBeVisible();
    pass("Manual Studio entry still opens");
    for (let i = 0; i < 3; i++) {
      const response = page.waitForResponse(r => r.request().method() === "POST" && /\/steps\/.+\/skip$/u.test(new URL(r.url()).pathname));
      await sheet(page).getByRole("button", { name: /^(Bỏ qua|Skip)$/u }).click();
      expect((await response).status()).toBe(200);
    }
    await expect(sheet(page)).toContainText(/Mọi thứ đã sẵn sàng|Everything is ready/u);
    pass("All three skipped steps persist COMPLETED");
    await close(page); await enter(page); await absent(page);
    pass("Completed setup does not reopen");
    await page.goto(`/#/w/${key}/studio/settings/locale-region`);
    const currency = page.locator("select").filter({ has: page.locator('option[value="EUR"]') }).filter({ has: page.locator('option[value="USD"]') }).first();
    await expect(currency).toHaveValue("USD");
    await currency.selectOption("EUR");
    const saved = page.waitForResponse(r => r.request().method() === "PATCH" && r.url().endsWith("/workspace-configuration/locale-region"));
    await page.getByRole("button", { name: /^(Lưu|Save)$/u }).first().click();
    expect((await saved).status()).toBe(200);
    await page.reload(); await expect(currency).toHaveValue("EUR");
    await observeCurrency(page, "Studio refreshed after EUR update");
    pass("Studio currency UI saves EUR and survives refresh");
    await page.getByRole("button", { name: "CRM", exact: true }).click();
    await page.getByRole("link", { name: /^(Sản phẩm|Products)$/u, exact: true }).click();
    await page.getByRole("button", { name: /^(Thêm sản phẩm|Add product)$/u, exact: true }).first().click();
    await expect(page.locator("#form-currency")).toHaveValue("EUR");
    await page.screenshot({ path: info.outputPath("connected-product-currency.png") });
    pass("Connected Product form consumes the saved EUR projection, not demo VND");
    await page.keyboard.press("Escape");
    await expect(page.locator("#form-currency")).toBeHidden();
    await signal("restart");
    other = await browser.newContext();
    const relogin = await other.newPage(); observe(relogin); await login(relogin);
    await observeCurrency(relogin, "CRM new login after restart before Studio");
    await relogin.goto(`/#/w/${key}/studio/settings/locale-region`);
    await expect(relogin.locator("select").filter({ has: relogin.locator('option[value="EUR"]') }).filter({ has: relogin.locator('option[value="USD"]') }).first()).toHaveValue("EUR");
    await enter(relogin); await absent(relogin);
    pass("New login after actual ApiHost restart retains currency and completed setup");
    await signal("read-only");
    await other.close(); other = await browser.newContext();
    const reader = await other.newPage(); observe(reader); await login(reader);
    await reader.goto(`/#/w/${secondKey}/studio`);
    await expect(reader).toHaveURL(/studio\/settings\/business-information/u);
    await expect(sheet(reader)).toBeHidden();
    pass("studio.read without studio.configure does not auto-open even NOT_STARTED workspace");
    await signal("configure");
    await other.close(); other = await browser.newContext();
    const second = await other.newPage(); observe(second); await login(second);
    await second.goto(`/#/w/${secondKey}/studio`);
    await expect(sheet(second)).toBeVisible();
    pass("Other workspace retains independent first-visit state");
    await close(second);
    await signal("stop");
    await second.goto(`/#/w/${secondKey}/studio`);
    await expect(second.getByRole("alert").filter({ hasText: /máy chủ|server|không thể tải|could not be loaded/iu }).first()).toBeVisible();
    await expect(sheet(second)).toBeHidden();
    pass("Actual unavailable ApiHost shows error, never fabricated NOT_STARTED state");
  } finally {
    await other?.close();
    await writeFile(info.outputPath("studio-results.json"), JSON.stringify({ workspaceId, results, http, currencies }, null, 2));
  }
});
