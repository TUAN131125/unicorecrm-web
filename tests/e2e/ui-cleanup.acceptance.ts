import { expect, request as isolatedRequest, type Page } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export async function runUiCleanupAcceptance(page: Page, directory: string, phase: string) {
  const checks: string[] = [];
  const expected = JSON.parse(await readFile(path.join(directory, "expected.json"), "utf8")) as { openDeals: number };
  const banners: { module: string; present: boolean; afterWait: boolean }[] = [];
  const auth: { path: string; method: string; status: number }[] = [];
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.name));
  page.on("response", response => { const url = new URL(response.url()); if (url.pathname.startsWith("/auth/")) auth.push({ path: url.pathname, method: response.request().method(), status: response.status() }); });
  let workspaceKey = "unicore-demo-anh-duong";
  const dashboard = () => `/#/w/${workspaceKey}/crm/dashboard`;
  const banner = page.locator('[data-guidance-id="access.read-only.notice"]');
  const wait = async (ms: number) => { await page.waitForTimeout(ms); }; // Verify a real elapsed visibility requirement.
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1366, height: 768 });
    await expect(page.locator('[data-dashboard-metric="pipeline"][data-state="READY"]')).toBeVisible();
    const sidebar = page.locator("#unicore-sidebar");
    if (phase === "before") await expect(sidebar.getByText("Không gian theo quyền", { exact: true })).toBeVisible();
    else await expect(sidebar.getByText("Không gian theo quyền", { exact: true })).toHaveCount(0);
    await page.screenshot({ path: path.join(directory, `cleanup-${phase}-branding.png`) });
    const qaEmail = process.env.UNICORECRM_UI_READONLY_EMAIL;
    const qaPassword = process.env.UNICORECRM_UI_READONLY_PASSWORD;
    if (qaEmail && qaPassword) {
      const probe = await isolatedRequest.newContext({ baseURL: process.env.UNICORECRM_TEST_API_BASE_URL });
      const headers = () => { const id = crypto.randomUUID(); return { "Idempotency-Key": id, "X-Request-Id": id, "X-Correlation-Id": id }; };
      const signed = await probe.post("/auth/sessions", { headers: headers(), data: { email: qaEmail, password: qaPassword, deviceLabel: "UI verification preflight" } });
      expect(signed.status(), "Provided QA account can authenticate").toBe(200);
      const grant = await signed.json();
      const authorized = { Authorization: `Bearer ${grant.accessToken}` };
      const memberships = await probe.get("/workspaces", { headers: { ...headers(), ...authorized } });
      expect(memberships.status()).toBe(200);
      const available = (await memberships.json()).items as { workspaceKey: string; status: string }[];
      const activeKeys = available.filter(item => item.status === "active").map(item => item.workspaceKey);
      await probe.post("/auth/session/logout", { headers: { ...headers(), ...authorized }, data: { reason: "UI_PREFLIGHT_COMPLETE" } });
      await probe.dispose();
      expect(activeKeys.length, "No workspace is provisioned by this verification").toBeGreaterThan(0);
      await page.locator("#user-profile-dropdown").click();
      await page.getByRole("menuitem", { name: "Đăng xuất", exact: true }).click();
      await page.waitForURL(/#\/login(?:\?|$)/u);
      await page.getByLabel("Email", { exact: true }).fill(qaEmail);
      await page.getByLabel("Mật khẩu", { exact: true }).fill(qaPassword);
      await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
      await page.waitForURL(/#\/w\/[^/]+\/crm\/dashboard$/u);
      workspaceKey = page.url().split("#/w/")[1]?.split("/")[0] ?? "";
      expect(activeKeys).toContain(workspaceKey);
      await expect(page.locator("#unicore-sidebar")).toBeVisible();
      checks.push("Provided QA account preflight confirmed existing memberships; actual UI account switch succeeded");
    }
    for (const module of ["customers", "customers/segments", "customers/health", "orders", "payments"]) {
      await page.goto(`/#/w/${workspaceKey}/crm/${module}`);
      await expect(page.locator(`[data-module-key="${module.split("/")[0]}"],#permission-denied-route-view`).first()).toBeVisible();
      if (await page.locator("#permission-denied-route-view").count()) {
        await wait(4_500);
        await expect(page.locator("#permission-denied-route-view")).toBeVisible();
        checks.push(`${module} denied route remains visible after timeout`);
        continue;
      }
      await page.screenshot({ path: path.join(directory, `cleanup-${phase}-${module.replaceAll("/", "-")}-page.png`) });
      const present = await banner.count() > 0;
      if (present) {
        await expect(banner).toBeVisible();
        await page.screenshot({ path: path.join(directory, `cleanup-${phase}-${module.replaceAll("/", "-")}-notice.png`) });
        await wait(4_500);
        if (phase === "before") await expect(banner).toBeVisible();
        else await expect(banner).toHaveCount(0);
        banners.push({ module, present, afterWait: await banner.count() > 0 });
        if (phase !== "before") {
          const search = page.locator('input[type="text"],input[type="search"]').filter({ visible: true }).first();
          if (await search.count()) { await search.fill("Ánh Dương"); await search.fill(""); }
          await expect(banner).toHaveCount(0);
          await page.screenshot({ path: path.join(directory, `cleanup-${phase}-${module.replaceAll("/", "-")}-hidden.png`) });
        }
      } else banners.push({ module, present, afterWait: false });
    }
    await page.goto(`/#/w/${workspaceKey}/crm/customers`);
    if (banners.find(item => item.module === "customers")?.present) {
      await expect(banner).toBeVisible();
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(banner).toBeVisible({ timeout: 15_000 });
      await wait(4_500);
      if (phase !== "before") await expect(banner).toHaveCount(0);
      else await expect(banner).toBeVisible();
      checks.push("Customer notice reappears on return/refresh; visibility after elapsed time recorded");
    }
    await page.goto(dashboard());
    await expect(page.locator('[data-dashboard-metric="pipeline"][data-state="READY"]')).toBeVisible();
    for (let cycle = 1; cycle <= 3; cycle++) {
      await page.locator("#user-profile-dropdown").click();
      const loggedOut = page.waitForResponse(response => new URL(response.url()).pathname === "/auth/session/logout");
      await page.getByRole("menuitem", { name: "Đăng xuất", exact: true }).click();
      expect((await loggedOut).status()).toBe(200);
      await page.waitForURL(/#\/login(?:\?|$)/u);
      expect(await page.evaluate(() => ({ session: sessionStorage.getItem("unicore_auth_session_v3"), workspace: sessionStorage.getItem("unicore_connected_active_workspace_key_v1") }))).toEqual({ session: null, workspace: null });
      if (cycle === 1) await page.screenshot({ path: path.join(directory, `cleanup-${phase}-logout.png`) });
      await page.getByLabel("Email", { exact: true }).fill(qaEmail ?? process.env.UNICORECRM_TEST_EMAIL ?? "");
      await page.getByLabel("Mật khẩu", { exact: true }).fill(qaPassword ?? process.env.UNICORECRM_TEST_PASSWORD ?? "");
      const signedIn = page.waitForResponse(response => new URL(response.url()).pathname === "/auth/sessions" && response.request().method() === "POST");
      await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
      expect((await signedIn).status()).toBe(200);
      // Connected selection resolves the canonical existing Workspace on the server.
      await page.waitForURL(url => url.hash === `#/w/${workspaceKey}/crm/dashboard`);
      await expect(page.locator('[data-dashboard-metric="pipeline"][data-state="READY"]')).toBeVisible();
      await page.reload();
      await expect(page.locator("#connected-dashboard")).toBeVisible();
      if (!qaEmail) await expect(page.locator('[data-dashboard-metric="pipeline"][data-state="READY"]')).toHaveAttribute("data-count", String(expected.openDeals));
      checks.push(`Login/logout/relogin/workspace selection/refresh cycle ${cycle}: PASS`);
    }
    await page.screenshot({ path: path.join(directory, `cleanup-${phase}-relogin.png`) });
    if (phase !== "before") {
      await page.getByRole("button", { name: "Thu gọn thanh điều hướng", exact: true }).click();
      await expect(sidebar.getByText("Không gian theo quyền", { exact: true })).toHaveCount(0);
      await page.screenshot({ path: path.join(directory, "cleanup-after-collapsed.png") });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole("button", { name: "Mở điều hướng", exact: true }).click();
      await expect(sidebar.getByRole("heading", { name: "UnicoreCRM", exact: true })).toBeVisible();
      await expect(sidebar.getByText("Không gian theo quyền", { exact: true })).toHaveCount(0);
      await page.screenshot({ path: path.join(directory, "cleanup-after-mobile.png") });
    }
    if (qaEmail) {
      await page.setViewportSize({ width: 1366, height: 768 });
      if (await page.getByRole("button", { name: "Đóng điều hướng", exact: true }).isVisible()) await page.getByRole("button", { name: "Đóng điều hướng", exact: true }).click();
      await page.locator("#user-profile-dropdown").click();
      await page.getByRole("menuitem", { name: "Đăng xuất", exact: true }).click();
      await page.waitForURL(/#\/login(?:\?|$)/u);
      await page.getByLabel("Email", { exact: true }).fill(process.env.UNICORECRM_TEST_EMAIL ?? "");
      await page.getByLabel("Mật khẩu", { exact: true }).fill(process.env.UNICORECRM_TEST_PASSWORD ?? "");
      await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
      await page.waitForURL(/#\/w\/unicore-demo-anh-duong\/crm\/dashboard$/u);
      await expect(page.locator('[data-dashboard-metric="pipeline"][data-state="READY"]')).toHaveAttribute("data-count", String(expected.openDeals));
      checks.push("Logout QA account and login demo account: correct Workspace and real dataset restored");
    }
    expect(errors).toEqual([]);
  } finally {
    await writeFile(path.join(directory, `cleanup-${phase}-checks.json`), JSON.stringify({ checks, banners, auth, pageErrors: errors }, null, 2));
  }
}
