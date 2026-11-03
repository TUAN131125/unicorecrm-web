import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { writeFile, access } from "node:fs/promises";
import path from "node:path";

test("Currency authority and Lead lifecycle use Bootstrap independently of Studio", async ({ browser, page }, info) => {
  test.setTimeout(300_000);
  const results: { test: string; status: string }[] = [];
  const http: { method: string; path: string; status: number; correlationId: string | undefined }[] = [];
  const control = process.env.UNICORECRM_TEST_CONTROL_DIR ?? "";
  if (!control) throw new Error("Requires the isolated Studio verifier (no demo fallback)");
  const leads: { id: string; workspaceKey: string; phase: string; currency: string }[] = [];
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
    await p.waitForLoadState("networkidle");
    await p.getByLabel("Email", { exact: true }).fill(process.env.UNICORECRM_TEST_EMAIL ?? "");
    await p.getByLabel(/Mật khẩu|Password/u, { exact: true }).fill(process.env.UNICORECRM_TEST_PASSWORD ?? "");
    await p.getByRole("button", { name: /^(Đăng nhập|Sign in)$/u }).click();
    await p.waitForURL(/#\/(?:select-workspace|w\/[^/]+\/crm\/)/u);
    await p.goto(`/#/w/${key}/crm/leads`);
    await p.waitForURL(/#\/w\/[^/]+\/crm\//u);
    await expect(p.getByRole("button", { name: /^(Thiết lập|Settings)$/u })).toBeVisible();
  }
  async function observeCurrency(p: Page, phase: string, expected: string) {
    await expect(p.locator("main[data-workspace-key]")).toBeVisible();
    const value = await p.evaluate(async () => {
      const modulePath = "/src/platform/workspace-config/workspaceRuntimeSettings.ts";
      const runtime = await import(modulePath);
      return { currency: runtime.getWorkspaceRuntimeSettings().baseCurrency as string,
        connectedProjection: runtime.isConnectedWorkspaceRuntimeSettings() as boolean };
    });
    expect(value.currency).toBe(expected);
    expect(value.connectedProjection).toBe(true);
    currencies.push({ phase, ...value });
  }
  async function createLead(p: Page, phase: string, workspaceKey: string, expected: string) {
    await p.goto(`/#/w/${workspaceKey}/crm/leads`);
    await p.getByRole("button", { name: /Thêm Tiềm năng|Thêm Lead|Add Lead/iu }).first().click();
    const dialog = p.getByRole("dialog").filter({ has: p.locator("#lead-name") });
    const marker = `currency-${phase}-${Date.now()}`;
    await dialog.locator("#lead-name").fill(marker);
    await dialog.locator("#lead-email").fill(`${marker}@example.test`);
    await dialog.locator("#lead-phone").fill("0900000123");
    await dialog.locator('[data-guidance-id="leads.form.advanced-toggle"]').click();
    await dialog.locator("#lead-expected-value").fill("123");
    const response = p.waitForResponse(r => r.request().method() === "POST" && r.url().endsWith("/leads"));
    await dialog.locator('button[type="submit"]').click();
    const created = await response;
    expect(created.status()).toBe(201);
    const request = created.request().postDataJSON() as { estimatedValue: { amount: string; currency: string } };
    expect(request.estimatedValue).toEqual({ amount: "123", currency: expected });
    const body = await created.json() as { aggregateId: string };
    leads.push({ id: body.aggregateId, workspaceKey, phase, currency: expected });
    await expect(dialog).toBeHidden();
    pass(`Lead created through connected UI with ${expected}: ${phase}`);
    return body.aggregateId;
  }
  async function convertLead(p: Page, leadId: string) {
    const marker = `currency-contact-${Date.now()}`;
    await p.goto(`/#/w/${key}/crm/contacts`);
    await p.getByRole("button", { name: /^(Thêm liên hệ(?: mới)?|Add contact)$/iu }).first().click();
    const dialog = p.getByRole("dialog").filter({ has: p.locator("#contact-create-name") });
    await dialog.locator("#contact-create-name").fill(marker);
    await dialog.locator("#contact-create-email").fill(`${marker}@example.test`);
    const response = p.waitForResponse(r => r.request().method() === "POST" && r.url().endsWith("/contacts"));
    await dialog.locator('button[type="submit"]').click();
    const created = await response; expect(created.status()).toBe(201);
    const contact = await created.json() as { aggregateId: string };
    await expect(dialog).toBeHidden();
    await p.goto(`/#/w/${key}/crm/leads/${leadId}/convert`);
    await p.getByLabel(/^(Mã đối tượng hiện có|Existing subject ID)$/u).fill(contact.aggregateId);
    const converted = p.waitForResponse(r => r.request().method() === "POST" && r.url().endsWith(`/workflows/lead-customer-conversion/${leadId}`));
    await p.getByRole("button", { name: /^(Chuyển thành khách hàng|Convert to Customer)$/u }).click();
    const result = await converted; expect(result.status()).toBe(200);
    const value = await result.json() as { result: { customerId: string } };
    expect(value.result.customerId).toBeTruthy();
    await p.getByRole("link", { name: value.result.customerId, exact: true }).click();
    await expect(p.locator("[data-customer-connected-workspace]")).toBeVisible();
    pass("Lead to Customer works after changing Workspace base currency");
  }
  async function close(p: Page) {
    const dismissed = p.waitForResponse(r => r.request().method() === "POST" && r.url().endsWith("/studio/quick-setup/dismiss-auto-open"));
    await sheet(p).getByRole("button", { name: /Đóng|Close/u, exact: true }).click();
    expect((await dismissed).status()).toBe(200);
    await expect(sheet(p)).toBeHidden();
  }
  async function signal(name: string) {
    await writeFile(path.join(control, `${name}.request`), "test control only");
    await expect.poll(async () => { try { await access(path.join(control, `${name}.done`)); return true; } catch { return false; } }, { timeout: 30_000 }).toBe(true);
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
    await observeCurrency(page, "CRM fresh login before Studio", "USD");
    expect(http.filter(r => r.path.endsWith("/workspace-configuration"))).toHaveLength(0);
    await createLead(page, "initial", key, "USD");
    expect(http.filter(r => r.path.endsWith("/workspace-configuration"))).toHaveLength(0);
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
    await page.waitForLoadState("networkidle");
    await currency.selectOption("EUR");
    await expect(currency).toHaveValue("EUR");
    const saved = page.waitForResponse(r => r.request().method() === "PATCH" && r.url().endsWith("/workspace-configuration/locale-region"));
    await page.getByRole("button", { name: /^(Lưu|Save)$/u }).first().click();
    expect((await saved).status()).toBe(200);
    await page.reload(); await expect(currency).toHaveValue("EUR");
    await observeCurrency(page, "Studio refreshed after EUR update", "EUR");
    const eurLead = await createLead(page, "EUR", key, "EUR");
    await page.reload();
    await observeCurrency(page, "CRM refresh before Studio", "EUR");
    await createLead(page, "refresh", key, "EUR");
    await page.locator("#user-profile-dropdown").click();
    await page.getByRole("menuitem", { name: /^(Đăng xuất|Logout)$/u }).click();
    await page.waitForURL(/#\/login/u);
    await login(page);
    await observeCurrency(page, "Explicit logout/login after EUR before Studio", "EUR");
    await createLead(page, "relogin", key, "EUR");
    await convertLead(page, eurLead);
    pass("Studio currency UI saves EUR and survives refresh");
    await page.getByRole("button", { name: "CRM", exact: true }).click();
    await page.getByRole("link", { name: /^(Sản phẩm|Products)$/u, exact: true }).click();
    await page.getByRole("button", { name: /^(Thêm sản phẩm|Add product)$/iu, exact: true }).first().click();
    await expect(page.locator("#form-currency")).toHaveValue("EUR");
    await page.screenshot({ path: info.outputPath("connected-product-currency.png") });
    pass("Connected Product form consumes the saved EUR projection, not demo VND");
    await page.keyboard.press("Escape");
    await expect(page.locator("#form-currency")).toBeHidden();
    await signal("restart");
    other = await browser.newContext();
    const relogin = await other.newPage(); observe(relogin); await login(relogin);
    await observeCurrency(relogin, "CRM new login after restart before Studio", "EUR");
    await createLead(relogin, "restart", key, "EUR");
    await relogin.goto(`/#/w/${secondKey}/crm/leads`);
    await observeCurrency(relogin, "Workspace B before Studio", "USD");
    await createLead(relogin, "workspaceB", secondKey, "USD");
    await relogin.goto(`/#/w/${key}/crm/leads`);
    await observeCurrency(relogin, "Return Workspace A", "EUR");
    await createLead(relogin, "returnA", key, "EUR");
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
    await signal("no-studio");
    await second.goto(`/#/w/${secondKey}/crm/leads`);
    await second.reload();
    await observeCurrency(second, "Workspace B without studio.read", "USD");
    await createLead(second, "withoutStudio", secondKey, "USD");
    await second.goto(`/#/w/${secondKey}/crm/products`);
    await second.getByRole("button", { name: /^(Thêm sản phẩm|Add product)$/iu, exact: true }).first().click();
    await expect(second.locator("#form-currency")).toHaveValue("USD");
    await second.keyboard.press("Escape");
    pass("Lead and Product use Bootstrap without studio.read");
    await second.goto(`/#/w/${secondKey}/crm/payments`);
    await expect(second.locator("[data-route-error-kind]")).toBeVisible();
    expect(http.some(r => r.path.endsWith("/workspace-configuration") && r.status === 403)).toBe(true);
    pass("Full configuration permission failure shows an error without demo fallback");
    await second.goto(`/#/w/${secondKey}/crm/leads`);
    await observeCurrency(second, "Non-money page after full configuration failure", "USD");
    await signal("stop");
    await second.goto(`/#/w/${key}/crm/leads`);
    await expect(second.getByRole("alert").filter({ hasText: /máy chủ|server|không thể tải|could not be loaded/iu }).first()).toBeVisible({ timeout: 30_000 });
    expect(await second.evaluate(async () => {
      const modulePath = "/src/platform/workspace-config/workspaceRuntimeSettings.ts";
      const runtime = await import(modulePath);
      return runtime.isWorkspaceRuntimeSettingsReady() as boolean;
    })).toBe(false);
    await expect(sheet(second)).toBeHidden();
    pass("Actual unavailable ApiHost shows error, never fabricated NOT_STARTED state");
  } finally {
    await other?.close();
    await writeFile(info.outputPath("currency-results.json"), JSON.stringify({ workspaceId, results, http, currencies, leads }, null, 2));
  }
});
