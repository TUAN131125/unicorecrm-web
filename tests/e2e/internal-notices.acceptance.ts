import { expect, type Page, type Route } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import path from "node:path";

export async function runInternalNoticesAcceptance(page: Page, directory: string, phase: string) {
  const base = "/#/w/unicore-demo-anh-duong/crm";
  const checks: { area: string; status: string; detail: string }[] = [];
  const http: { path: string; method: string; status: number; workspace?: string }[] = [];
  const decisions: unknown[] = [];
  const pending: Promise<void>[] = [];
  let headers: Record<string, string> = {};
  let status = "FAIL";
  page.on("request", request => { if (request.headers().authorization && request.headers()["x-workspace-id"]) headers = request.headers(); });
  page.on("response", response => {
    if (!response.url().startsWith(process.env.UNICORECRM_TEST_API_BASE_URL ?? "invalid:")) return;
    const url = new URL(response.url());
    http.push({ path: url.pathname, method: response.request().method(), status: response.status(), workspace: response.request().headers()["x-workspace-id"] });
    if (url.pathname === "/access/records/evaluate" && response.status() === 200) pending.push(response.json().then(value => { decisions.push(value); }));
  });
  const banner = () => page.locator("[data-effective-access-notice]");
  const indicator = () => page.locator('[data-guidance-id="access.record.indicator"]');
  const read = async (endpoint: string) => {
    const id = crypto.randomUUID();
    const response = await page.request.get(`${process.env.UNICORECRM_TEST_API_BASE_URL}${endpoint}`, { headers: {
      Authorization: headers.authorization ?? "", "X-Workspace-Id": "ws_f2332a12d56a421d8a722bd2f65c5efb", "X-Request-Id": id, "X-Correlation-Id": id,
    } });
    expect(response.status()).toBe(200); return response.json();
  };
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${base}/customers`);
    await expect(page.locator("#customer-workspace")).toBeVisible({ timeout: 20_000 });
    const customers = (await read("/customers?limit=2")).items as { id: string }[];
    const dealId = "deal_5b123fb499dd49a395a88314faf34ca1";
    const pages = [
      { name: "customer", module: "customers", id: customers[0]?.id ?? "", header: "#customer-connected-record-header" },
      { name: "deal", module: "deals", id: dealId, header: "#deal-detail-header" },
    ];
    if (phase === "before") {
    for (const [viewport, width, height] of [["desktop", 1440, 900], ["laptop", 1366, 768], ["mobile", 390, 844]] as const) {
      await page.setViewportSize({ width, height });
      for (const record of pages) {
        await page.goto(`${base}/${record.module}/${record.id}`);
        await expect(page.locator(record.header)).toBeVisible({ timeout: 20_000 });
        await expect(banner()).toBeVisible();
        await expect(indicator()).toBeVisible();
        const initialTop = (await page.locator(record.header).boundingBox())?.y ?? 0;
        await page.screenshot({ path: path.join(directory, `internal-notices-${phase}-${record.name}-${viewport}-initial.png`) });
        await page.waitForTimeout(4_500);
        await expect(banner()).toHaveCount(0);
        if (phase === "before") await expect(indicator()).toHaveCount(0);
        else {
          await expect(indicator()).toHaveCount(0);
          await expect(page.locator("[data-transient-info-notice]")).toHaveCount(0);
          expect((await page.locator(record.header).boundingBox())?.y).toBeLessThan(initialTop - 20);
          const frame = page.locator(`[data-resource-key="${record.module}"][data-record-id="${record.id}"]`);
          const frameTop = (await frame.boundingBox())?.y ?? 0;
          const headerTop = (await page.locator(record.header).boundingBox())?.y ?? 0;
          expect(headerTop - frameTop).toBeLessThan(24);
        }
        await page.screenshot({ path: path.join(directory, `internal-notices-${phase}-${record.name}-${viewport}-elapsed.png`) });
        checks.push({ area: `${record.name}/${viewport}`, status: "PASS", detail: phase === "before" ? "Legacy informational UI appears initially, then both banner and indicator expire" : "Banner and indicator removed; no lifetime wrapper or reserved header gap" });
      }
    }
      status = "PASS"; return;
    }
    const installObserver = () => {
      const state = window as Window & { __noticeFlashes?: number };
      state.__noticeFlashes = 0;
      const selector = '[data-effective-access-notice], [data-guidance-id="access.record.indicator"], [data-guidance-id="access.read-only.notice"], [data-transient-info-notice]';
      new MutationObserver(records => { for (const record of records) for (const node of record.addedNodes) {
        if (node instanceof Element && (node.matches(selector) || node.querySelector(selector))) state.__noticeFlashes = (state.__noticeFlashes ?? 0) + 1;
      } }).observe(document, { childList: true, subtree: true });
    };
    await page.addInitScript(installObserver);
    await page.evaluate(installObserver);
    const noNotices = async () => {
      await expect(banner()).toHaveCount(0); await expect(indicator()).toHaveCount(0);
      await expect(page.locator('[data-guidance-id="access.read-only.notice"], [data-transient-info-notice]')).toHaveCount(0);
      expect(await page.evaluate(() => (window as Window & { __noticeFlashes?: number }).__noticeFlashes ?? 0)).toBe(0);
    };
    for (const [viewport, width, height] of [["desktop", 1440, 900], ["laptop", 1366, 768], ["mobile", 390, 844]] as const) {
      await page.setViewportSize({ width, height });
      for (const record of pages) {
        await page.goto(`${base}/${record.module}/${record.id}`);
        await expect(page.locator(record.header)).toBeVisible({ timeout: 20_000 });
        await noNotices();
        const frame = page.locator(`[data-resource-key="${record.module}"][data-record-id="${record.id}"]`);
        expect(((await page.locator(record.header).boundingBox())?.y ?? 0) - ((await frame.boundingBox())?.y ?? 0)).toBeLessThan(24);
        await page.screenshot({ path: path.join(directory, `internal-notices-after-${record.name}-${viewport}.png`) });
        await page.reload();
        await expect(page.locator(record.header)).toBeVisible({ timeout: 20_000 }); await noNotices();
        checks.push({ area: `${record.name}/${viewport}`, status: "PASS", detail: "No notice/counter/wrapper from first render or refresh; MutationObserver detects zero flashes; no reserved header gap" });
      }
    }
    await page.goto(`${base}/customers/${customers[1]?.id}`);
    await expect(page.locator("#customer-connected-record-header")).toBeVisible(); await noNotices();
    await page.waitForTimeout(4_500); await noNotices();
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const [module, endpoint, route, ready] of [
      ["leads", "/leads", "leads", '[data-resource-key="leads"]'],
      ["contacts", "/contacts", "contacts", '[data-resource-key="contacts"]'],
      ["organizations", "/organizations", "organizations", '[data-resource-key="organizations"]'],
      ["tasks", "/tasks", "tasks", '[data-resource-key="tasks"]'],
      ["support", "/support/cases", "support/cases", '[data-resource-key="support"]'],
    ]) {
      const records = (await read(`${endpoint}?limit=1`)).items as { id: string }[];
      if (!records[0]) { checks.push({ area: module ?? "", status: "NOT_RUN", detail: "No existing record" }); continue; }
      await page.goto(`${base}/${route}`);
      await expect(page.locator(`[data-module-key="${module}"]`).first()).toBeVisible({ timeout: 20_000 }); await noNotices();
      await page.goto(`${base}/${route}/${records[0].id}`);
      await expect(page.locator(ready ?? "").first()).toBeVisible({ timeout: 20_000 }); await noNotices();
      checks.push({ area: module ?? "", status: "PASS", detail: "List/detail routes and actual scoped API read; zero internal access DOM/flashes" });
    }
    for (const route of ["dashboard", "customers", "deals", "products"]) {
      await page.goto(`${base}/${route}`);
      await expect(page.locator('main').first()).toBeVisible(); await noNotices();
    }
    const product = (await read("/products/selection?limit=1")).items[0];
    if (product) {
      await page.goto(`${base}/products/${product.id}`);
      const failure = page.getByRole("heading", { name: "Màn hình gặp lỗi khi hiển thị.", exact: true });
      await expect(page.locator("#product-detail-header").or(failure)).toBeVisible({ timeout: 20_000 }); await noNotices();
      checks.push({ area: "products", status: await failure.count() ? "FAIL" : "PASS", detail: await failure.count() ? "Existing detail rendering failure; only loading copy changed in this task" : "Detail loaded without internal access notices" });
    }
    const abort = async (route: Route) => { await route.abort("failed"); };
    await page.route("**/access/records/evaluate", abort);
    await page.goto(`${base}/deals/${dealId}`);
    await expect(page.locator('[data-access-verification-state="error"]')).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(4_500);
    await expect(page.getByRole("button", { name: "Thử lại", exact: true })).toBeVisible();
    await expect(page.locator("#deal-detail-header")).toHaveCount(0);
    await noNotices();
    await page.screenshot({ path: path.join(directory, "internal-notices-after-error.png") });
    await page.unroute("**/access/records/evaluate", abort);
    await page.getByRole("button", { name: "Thử lại", exact: true }).click(); await expect(page.locator("#deal-detail-header")).toBeVisible();
    checks.push({ area: "Verification failure", status: "PASS", detail: "Persistent error/Retry after 4.5s, record withheld; real retry recovers without fake success" });
    await page.goto(`/#/w/unicore-demo-anh-duong-control/crm/deals/${dealId}`);
    await expect(page.getByText(/Không thể xác minh quyền truy cập|Bạn không có quyền xem bản ghi này|Không thể tải cơ hội/u).first()).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(4_500); await expect(page.locator("#deal-detail-header")).toHaveCount(0); await noNotices();
    checks.push({ area: "Workspace isolation", status: "PASS", detail: "Foreign record remains denied; no stale notice or record values" });
    expect(http.filter(item => item.method !== "GET" && !["/access/records/evaluate", "/auth/session/refresh"].includes(item.path))).toEqual([]);
    status = "PASS";
  } finally {
    await Promise.all(pending);
    await writeFile(path.join(directory, `internal-notices-${phase}.json`), JSON.stringify({ status, checks, decisions, http }, null, 2));
  }
}
