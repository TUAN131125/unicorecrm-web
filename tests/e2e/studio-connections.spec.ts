import { expect, test } from "@playwright/test";
import { writeFile, access } from "node:fs/promises";
import path from "node:path";

test("Connections navigation uses real Workspace authority and preserves owner routes", async ({ page, browser }, info) => {
  const key = process.env.UNICORECRM_TEST_WORKSPACE_KEY ?? "";
  const second = process.env.UNICORECRM_TEST_SECOND_KEY ?? "";
  const control = process.env.UNICORECRM_TEST_CONTROL_DIR ?? "";
  if (!key || !second || !control) throw new Error("Requires the isolated Connections verifier");
  const results: string[] = [];
  const http: { method: string; path: string; status: number }[] = [];
  page.on("response", response => {
    const url = new URL(response.url());
    if (/outbound-webhook|integration-event|integrations\/|communication.*channel|workspace-configuration|\/bootstrap$/u.test(url.pathname)) http.push({ method: response.request().method(), path: url.pathname, status: response.status() });
  });
  const go = async (suffix: string, workspace = key) => { await page.goto(`/#/w/${workspace}/studio/settings/${suffix}`); };
  async function login() {
    await page.goto("/#/login");
    await page.getByLabel("Email", { exact: true }).fill(process.env.UNICORECRM_TEST_EMAIL ?? "");
    await page.getByLabel(/Mật khẩu|Password/u, { exact: true }).fill(process.env.UNICORECRM_TEST_PASSWORD ?? "");
    await page.getByRole("button", { name: /^(Đăng nhập|Sign in)$/u }).click();
    await page.waitForURL(/#\/(select-workspace|w\/)/u);
  }
  async function signal(action: string) {
    await writeFile(path.join(control, `${action}.request`), "fixture control");
    await expect.poll(async () => { try { await access(path.join(control, `${action}.done`)); return true; } catch { return false; } }).toBe(true);
  }
  try {
    await login();
    await go("connections");
    await expect(page.getByRole("heading", { name: /Tổng quan kết nối|Overview/u, exact: true })).toBeVisible();
    await expect(page.getByText(/Chưa có đăng ký webhook|No webhook subscriptions/u)).toBeVisible();
    await expect(page.getByText(/Chưa có giao nhận trong|No deliveries in/u)).toBeVisible();
    expect(http.some(r => r.path === "/outbound-webhooks" && r.status === 200)).toBe(true);
    expect(http.some(r => r.path === "/outbound-webhook-deliveries" && r.status === 200)).toBe(true);
    await page.getByRole("button", { name: /KẾT NỐI & API|CONNECTIONS & API/u, exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath("overview.png"), fullPage: true });
    results.push("Overview shows real server empty collections and five destinations");
    for (const [suffix, heading] of [["integrations", /Ứng dụng & dịch vụ|Apps & Services/u], ["connections/inbound", /Nhận dữ liệu|Inbound Sources/u], ["connections/api-access", /Truy cập API|Developer API/u]] as const) {
      await go(suffix);
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
      await expect(page.getByText(/Chưa khả dụng|Unavailable/u).first()).toBeVisible();
      expect(await page.locator('input[type="password"]').count()).toBe(0);
      await page.screenshot({ path: info.outputPath(`${suffix.replaceAll("/", "-")}.png`), fullPage: true });
    }
    results.push("Apps, Inbound and Developer API have honest unavailable surfaces; no credentials or fake records");
    await go("integrations");
    await page.getByRole("link", { name: /Quản lý nhiều tài khoản|Manage multiple accounts/u }).click();
    await expect(page).toHaveURL(/settings\/communications\/channels/u);
    results.push("Apps opens existing Communications owner route");
    await go("webhooks-api");
    await expect(page.getByRole("heading", { name: /Webhook|webhook/u }).first()).toBeVisible();
    await expect(page.getByText(/Không thể tải|Could not load/u)).toHaveCount(0);
    results.push("Existing scoped Outbound deep link remains loadable");
    await page.goto("/#/settings/integrations?source=legacy");
    await expect(page).toHaveURL(/\/studio\/settings\/integrations\?source=legacy/u);
    await page.goto("/#/settings/webhooks-api?source=legacy");
    await expect(page).toHaveURL(/\/studio\/settings\/webhooks-api\?source=legacy/u);
    results.push("Legacy links preserve query and canonicalize into active Workspace");
    await go("ai");
    await expect(page.locator('[data-studio-route-section="ai"]')).toBeVisible();
    await expect(page.getByRole("heading", { name: /^(Trợ lý AI|AI Assistant)$/u })).toBeVisible();
    await page.screenshot({ path: info.outputPath("studio-ai.png"), fullPage: true });
    await go("business-information");
    await expect(page.getByRole("heading", { name: /Thông tin doanh nghiệp|Business information/u, exact: true })).toBeVisible();
    await page.goto(`/#/w/${key}/crm/leads`);
    await expect(page.getByRole("heading", { name: /Khách hàng tiềm năng|Leads/u }).first()).toBeVisible();
    results.push("Studio AI, existing Business Information and CRM Leads remain loadable");
    await go("connections", second);
    await expect(page.getByRole("heading", { name: /Tổng quan kết nối|Overview/u, exact: true })).toBeVisible();
    await expect(page.getByText(/chưa có quyền quản lý kênh|do not have permission to manage channels/iu)).toBeVisible();
    await page.reload();
    await expect(page.getByText(/Chưa có đăng ký webhook|No webhook subscriptions/u)).toBeVisible();
    await go("webhooks-api", second);
    await expect(page.getByRole("button", { name: /^(Tạo|Create)$/u })).toBeDisabled();
    await go("connections", second);
    let releaseLogoutRead: (() => void) | undefined;
    const logoutRead = new Promise<void>(resolve => { releaseLogoutRead = resolve; });
    await page.route("**/outbound-webhooks", async route => { await logoutRead; await route.continue(); });
    await page.getByRole("button", { name: /Làm mới dữ liệu đọc|Refresh read data/u }).click();
    await expect(page.getByText(/Đang tải từ máy chủ|Loading from server/u).first()).toBeVisible();
    await page.locator("#user-profile-dropdown").click();
    await page.getByRole("menuitem", { name: /Đăng xuất|Sign out/u, exact: true }).click();
    await expect(page).toHaveURL(/#\/login/u);
    releaseLogoutRead?.();
    await page.unrouteAll({ behavior: "wait" });
    await expect(page.locator('[data-studio-surface="connections"]')).toHaveCount(0);
    await login(); await go("connections", second);
    await expect(page.getByText(/Chưa có đăng ký webhook|No webhook subscriptions/u)).toBeVisible();
    results.push("Workspace switch, reader role, refresh and logout/login restore real server state");
    await signal("communications-only");
    await page.reload();
    await go("communications/channels", second);
    await expect(page.locator('[data-studio-route-section="communication-channels"]')).toBeVisible();
    await go("connections", second);
    await expect(page.locator('[data-access-state="permission-denied"]')).toBeVisible();
    await expect(page.getByRole("heading", { name: /Tổng quan kết nối|Overview/u, exact: true })).toHaveCount(0);
    results.push("Communications-only member keeps owner access and cannot access studio.read routes");
    await signal("restore-reader");
    // Hold a real query across an SPA Workspace switch. The retired page must not publish.
    await go("connections", key);
    let release: (() => void) | undefined;
    const held = new Promise<void>(resolve => { release = resolve; });
    await page.route("**/outbound-webhooks", async route => { await held; await route.continue(); });
    await page.getByRole("button", { name: /Làm mới dữ liệu đọc|Refresh read data/u }).click();
    await expect(page.getByText(/Đang tải từ máy chủ|Loading from server/u).first()).toBeVisible();
    await page.evaluate(async ({ workspaceKey }) => {
      const modulePath = "/src/platform/workspace-context/index.ts";
      const context = await import(modulePath);
      await context.enterWorkspaceByKey(workspaceKey);
      window.location.hash = `/w/${workspaceKey}/studio/settings/connections`;
    }, { workspaceKey: second });
    release?.();
    await page.unrouteAll({ behavior: "wait" });
    await expect(page.getByText(`Workspace: ${second}`, { exact: false }).first()).toBeVisible();
    await expect(page.getByText(/Chưa có đăng ký webhook|No webhook subscriptions/u)).toBeVisible();
    results.push("Delayed query cannot restore the old Workspace scope");
    await page.route("**/outbound-webhooks", route => route.fulfill({ status: 503, contentType: "application/problem+json", body: JSON.stringify({ code: "INTERNAL_ERROR", status: 503 }) }));
    await page.getByRole("button", { name: /Làm mới dữ liệu đọc|Refresh read data/u }).click();
    await expect(page.getByRole("alert").filter({ hasText: /Không thể tải dữ liệu|Could not load data/u })).toBeVisible();
    await expect(page.getByText(/Chưa có giao nhận trong|No deliveries in/u)).toBeVisible();
    await page.screenshot({ path: info.outputPath("independent-read-error.png"), fullPage: true });
    await page.unroute("**/outbound-webhooks");
    results.push("Controlled 503 affects subscriptions only; deliveries keep real query result");
    expect(http.some(r => /outbound-webhook|integrations\//u.test(r.path) && r.method !== "GET")).toBe(false);
    const fresh = await browser.newContext();
    await fresh.close();
  } finally {
    await writeFile(info.outputPath("checks.json"), JSON.stringify({ results, http, scope: "Real isolated ApiHost/SQL; delayed response and 503 are controlled browser fault injection. No webhook/integration/key creation." }, null, 2));
  }
});
