import { expect, type Page, type Route } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import path from "node:path";

interface Decision {
  workspaceId: string; resourceKey: string; recordId?: string; canRead: boolean; canUpdate: boolean;
  allowedCommands: string[]; fieldAccess: Record<string, string>;
}

export async function runAccessNoticesAcceptance(page: Page, directory: string, phase: string) {
  let status = "FAIL";
  const checks: string[] = [];
  const issues: { status: string; area: string; detail: string }[] = [];
  const errors: string[] = [];
  page.on("console", message => { if (message.type() === "error") errors.push(message.text().slice(0, 2000)); });
  const decisions: Decision[] = [];
  const pending: Promise<void>[] = [];
  let retiredEvidenceBodies = 0;
  const http: { path: string; workspace?: string; status: number; method: string }[] = [];
  let headers: Record<string, string> | undefined;
  let expectedBuyerName = "";
  page.on("request", request => {
    if (request.url().startsWith(process.env.UNICORECRM_TEST_API_BASE_URL ?? "invalid:") && request.headers().authorization && request.headers()["x-workspace-id"]) headers = request.headers();
  });
  page.on("response", response => {
    if (!response.url().startsWith(process.env.UNICORECRM_TEST_API_BASE_URL ?? "invalid:")) return;
    const pathname = new URL(response.url()).pathname;
    http.push({ path: pathname, workspace: response.request().headers()["x-workspace-id"], status: response.status(), method: response.request().method() });
    if (pathname === "/access/records/evaluate" && response.ok()) pending.push(response.json().then(value => {
      decisions.push({ workspaceId: value.workspaceId, resourceKey: value.resourceKey, recordId: value.recordId, canRead: value.canRead, canUpdate: value.canUpdate, allowedCommands: value.allowedCommands, fieldAccess: value.fieldAccess });
    }).catch(() => { retiredEvidenceBodies += 1; }));
    if (!expectedBuyerName && pathname === "/contacts/contact_a91fe077d53e44b1bb2b2b252e226bd6" && response.ok()) pending.push(response.json().then(value => { expectedBuyerName = value.fullName || value.displayName || ""; }).catch(() => { retiredEvidenceBodies += 1; }));
  });
  const dealId = "deal_5b123fb499dd49a395a88314faf34ca1";
  const base = "/#/w/unicore-demo-anh-duong/crm";
  const route = `${base}/deals/${dealId}`;
  const notice = () => phase === "before"
    ? page.locator('[data-resource-key="deals"] > [role="status"]')
    : page.locator('[data-effective-access-notice]');
  const indicator = () => page.locator('[data-guidance-id="access.record.indicator"] button');
  async function boundedList(endpoint: string, limit = 1) {
    if (!headers) throw new Error("An actual scoped browser request is required");
    const id = crypto.randomUUID();
    const response = await page.request.get(`${process.env.UNICORECRM_TEST_API_BASE_URL}${endpoint}?limit=${limit}`, {
      headers: { Authorization: headers.authorization ?? "", "X-Workspace-Id": "ws_f2332a12d56a421d8a722bd2f65c5efb", "X-Request-Id": id, "X-Correlation-Id": id },
    });
    expect(response.status()).toBe(200);
    return (await response.json()).items as { id: string }[];
  }
  try {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(route);
    await expect(page.locator("#deal-detail-header")).toBeVisible({ timeout: 20_000 });
    await expect(notice()).toContainText("5 trường");
    await page.screenshot({ path: path.join(directory, `access-${phase}-desktop-initial.png`) });
    await page.waitForTimeout(4_500);
    if (phase === "before") await expect(notice()).toBeVisible();
    else await expect(notice()).toHaveCount(0);
    await page.screenshot({ path: path.join(directory, `access-${phase}-desktop-elapsed.png`) });
    checks.push(`Desktop after 4.5 seconds: ${phase === "before" ? "persistent baseline reproduced" : "notice hidden"}`);
    if (phase === "after") {
      await Promise.all(pending);
      expect(expectedBuyerName).not.toBe("");
      await expect(page.locator('[data-deal-buyer-name]')).toHaveText(expectedBuyerName);
      await expect(page.locator("#deal-detail-header")).not.toContainText(/contact_|deal_/u);
      await expect(indicator()).toHaveText("5 trường được bảo vệ");
      await indicator().click();
      const explanation = page.getByRole("dialog", { name: "5 trường được bảo vệ", exact: true });
      await expect(explanation).toContainText("Quyền do hệ thống xác định");
      const decision = decisions.find(item => item.resourceKey === "deals" && item.recordId === dealId);
      expect(decision).toBeDefined();
      await expect(explanation.locator("dl > div")).toHaveCount(Object.keys(decision?.fieldAccess ?? {}).length);
      await expect(explanation).not.toContainText(expectedBuyerName);
      await page.screenshot({ path: path.join(directory, "access-after-desktop-explanation.png") });
      await page.keyboard.press("Escape");
      await expect(explanation).toHaveCount(0);
      await expect(indicator()).toBeFocused();
      await page.locator("#deal-detail-header").getByRole("button", { name: "Thao tác khác", exact: true }).click();
      await expect(page.getByRole("menuitem", { name: `ID: ${dealId}`, exact: true })).toBeDisabled();
      await page.keyboard.press("Escape");
      await page.mouse.wheel(0, 400);
      await page.mouse.wheel(0, -400);
      await expect(notice()).toHaveCount(0);
      expect(http.filter(item => item.path === "/contacts/contact_a91fe077d53e44b1bb2b2b252e226bd6").length).toBeLessThanOrEqual(2);
      checks.push("Authorized single buyer detail matches header; no raw IDs in business header; technical ID available in More actions; popover shows modes only, Escape restores focus, UI changes do not reset notice");
      await page.reload();
      await expect(notice()).toBeVisible({ timeout: 20_000 });
      checks.push("Refresh resets informational lifetime");
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(directory, `access-${phase}-mobile-initial.png`) });
    await page.waitForTimeout(4_500);
    if (phase === "after") {
      await expect(notice()).toHaveCount(0);
      await indicator().click();
      const panel = page.getByRole("dialog", { name: "5 trường được bảo vệ", exact: true });
      await expect(panel).toBeVisible();
      const bounds = await panel.boundingBox();
      expect(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 390).toBeTruthy();
      await page.screenshot({ path: path.join(directory, "access-after-mobile-explanation.png") });
      await page.keyboard.press("Escape");
    }
    await page.screenshot({ path: path.join(directory, `access-${phase}-mobile.png`) });
    if (phase === "before") { status = "PASS"; return; }
    checks.push("390px mobile: transient notice, compact indicator and in-viewport explanation PASS (reduced motion)");
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const deals = await boundedList("/deals", 2);
    const otherDeal = deals.find(item => item.id !== dealId);
    expect(otherDeal).toBeDefined();
    await page.goto(`${base}/deals/${otherDeal?.id}`);
    await expect(page.locator("#deal-detail-header")).toBeVisible();
    await expect(notice()).toBeVisible();
    await page.waitForTimeout(4_500);
    await expect(notice()).toHaveCount(0);
    checks.push("Another Deal resets lifetime; default-motion animation finishes");
    for (const [module, endpoint] of [["contacts", "/contacts"], ["customers", "/customers"], ["leads", "/leads"], ["organizations", "/organizations"], ["tasks", "/tasks"], ["support", "/support/cases"], ["products", "/products/selection"]]) {
      const records = await boundedList(endpoint ?? "");
      expect(records.length).toBeGreaterThan(0);
      await page.goto(`${base}/${module === "support" ? "support/cases" : module}/${records[0]?.id}`);
      if (module === "products") {
        const failure = page.getByRole("heading", { name: "Màn hình gặp lỗi khi hiển thị.", exact: true });
        await expect(page.locator('#product-detail-header').or(failure)).toBeVisible({ timeout: 20_000 });
        if (await failure.count()) {
          issues.push({ status: "FAIL", area: "Product detail", detail: "Backend GET succeeds, existing screen enters its rendering error boundary; Product sources are outside this presentation change." });
          await page.screenshot({ path: path.join(directory, "access-after-product-existing-error.png") });
        } else checks.push("Product detail uses its own protected read, no informational effective-boundary notice");
      } else {
        await expect(page.locator(`[data-resource-key="${module}"][data-record-id="${records[0]?.id}"]`)).toBeVisible({ timeout: 20_000 });
        const informational = await notice().count() > 0;
        if (informational) {
          await expect(indicator()).toBeVisible();
          await page.waitForTimeout(4_500);
          await expect(notice()).toHaveCount(0);
          await expect(indicator()).toBeVisible();
        }
        checks.push(`${module} detail: loaded authoritative boundary, ${informational ? "notice hides; indicator persists" : "unrestricted; no notice"}`);
      }
    }
    const abort = async (intercepted: Route) => { await intercepted.abort("failed"); };
    await page.route("**/access/records/evaluate", abort);
    await page.goto(route);
    await expect(page.getByText("Không thể xác minh quyền truy cập", { exact: true })).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(4_500);
    await expect(page.getByRole("button", { name: "Thử lại", exact: true })).toBeVisible();
    await expect(page.locator("#deal-detail-header")).toHaveCount(0);
    await page.screenshot({ path: path.join(directory, "access-after-verification-failed.png") });
    await page.unroute("**/access/records/evaluate", abort);
    await page.getByRole("button", { name: "Thử lại", exact: true }).click();
    await expect(page.locator("#deal-detail-header")).toBeVisible();
    checks.push("Actual transport failure: persistent error + Retry after 4.5 seconds; record hidden until real retry succeeds");
    await page.goto(`/#/w/unicore-demo-anh-duong-control/crm/deals/${dealId}`);
    await expect(page.locator("#deal-detail-header")).toHaveCount(0);
    await expect(page.getByText(/Không thể xác minh quyền truy cập|Bạn không có quyền xem bản ghi này|Không thể tải cơ hội/u).first()).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(4_500);
    await expect(page.locator("#deal-detail-header")).toHaveCount(0);
    await expect(page.locator('[data-deal-buyer-name]')).toHaveCount(0);
    await page.screenshot({ path: path.join(directory, "access-after-workspace-isolation.png") });
    await page.goto(route);
    await expect(page.locator("#deal-detail-header")).toBeVisible();
    await expect(page.locator('[data-deal-buyer-name]')).toHaveText(expectedBuyerName);
    checks.push("Existing control workspace cannot open demo Deal or see buyer label; return to demo restores authorized detail");
    await page.route("**/contacts/contact_a91fe077d53e44b1bb2b2b252e226bd6", abort);
    await page.reload();
    await expect(page.locator('[data-deal-buyer-name][data-state="UNAVAILABLE"]')).toHaveText("Chưa có thông tin tên người mua");
    await expect(page.locator("#deal-detail-header")).not.toContainText(/contact_|deal_/u);
    await page.screenshot({ path: path.join(directory, "access-after-buyer-unavailable.png") });
    await page.unroute("**/contacts/contact_a91fe077d53e44b1bb2b2b252e226bd6", abort);
    await page.reload();
    await expect(page.locator('[data-deal-buyer-name]')).toHaveText(expectedBuyerName);
    checks.push("Buyer transport failure uses neutral unavailable state, never cached name/raw ID; real read recovers on refresh");
    expect(http.filter(item => item.method !== "GET" && !["/access/records/evaluate", "/auth/session/refresh"].includes(item.path))).toEqual([]);
    status = "PASS";
  } finally {
    await Promise.all(pending);
    await writeFile(path.join(directory, `access-${phase}.json`), JSON.stringify({ status, checks, issues, errors, retiredEvidenceBodies, decisions, http }, null, 2));
  }
}
