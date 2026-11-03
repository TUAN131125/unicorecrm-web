import { expect, type Page, type Route } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import path from "node:path";

export async function runRemainingAccessAcceptance(page: Page, directory: string, phase: string) {
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
    for (const [viewport, width, height] of [["desktop", 1440, 900], ["laptop", 1366, 768], ["mobile", 390, 844]] as const) {
      await page.setViewportSize({ width, height });
      for (const record of pages) {
        await page.goto(`${base}/${record.module}/${record.id}`);
        await expect(page.locator(record.header)).toBeVisible({ timeout: 20_000 });
        await expect(banner()).toBeVisible();
        await expect(indicator()).toBeVisible();
        const initialTop = (await page.locator(record.header).boundingBox())?.y ?? 0;
        await page.screenshot({ path: path.join(directory, `remaining-access-${phase}-${record.name}-${viewport}-initial.png`) });
        await page.waitForTimeout(4_500);
        await expect(banner()).toHaveCount(0);
        if (phase === "before") await expect(indicator()).toBeVisible();
        else {
          await expect(indicator()).toHaveCount(0);
          await expect(page.locator("[data-transient-info-notice]")).toHaveCount(0);
          expect((await page.locator(record.header).boundingBox())?.y).toBeLessThan(initialTop - 20);
          const frame = page.locator(`[data-resource-key="${record.module}"][data-record-id="${record.id}"]`);
          const frameTop = (await frame.boundingBox())?.y ?? 0;
          const headerTop = (await page.locator(record.header).boundingBox())?.y ?? 0;
          expect(headerTop - frameTop).toBeLessThan(24);
        }
        await page.screenshot({ path: path.join(directory, `remaining-access-${phase}-${record.name}-${viewport}-elapsed.png`) });
        checks.push({ area: `${record.name}/${viewport}`, status: "PASS", detail: phase === "before" ? "Existing banner expires but protected-field indicator persists" : "Banner and indicator removed; no lifetime wrapper or reserved header gap" });
      }
    }
    if (phase === "before") { status = "PASS"; return; }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${base}/customers/${customers[0]?.id}`);
    await expect(banner()).toBeVisible();
    await page.waitForTimeout(2_500);
    await page.locator("[data-customer-connected-workspace] main").getByRole("button", { name: "Quan hệ", exact: true }).click();
    await page.mouse.wheel(0, 300); await page.mouse.wheel(0, -300);
    await page.waitForTimeout(2_000);
    await expect(banner()).toHaveCount(0); await expect(indicator()).toHaveCount(0);
    await page.reload(); await expect(banner()).toBeVisible();
    await page.waitForTimeout(4_500); await expect(indicator()).toHaveCount(0);
    await page.goto(`${base}/customers/${customers[1]?.id}`); await expect(banner()).toBeVisible();
    checks.push({ area: "Customer lifecycle", status: "PASS", detail: "Tab/scroll does not restart timer; refresh and another record restart lifetime" });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(`${base}/deals/${dealId}`); await expect(banner()).toBeVisible();
    await page.waitForTimeout(4_500); await expect(indicator()).toHaveCount(0);
    checks.push({ area: "Motion", status: "PASS", detail: "Default and reduced motion both complete removal" });
    for (const [module, endpoint, route, ready] of [
      ["leads", "/leads", "leads", '[data-resource-key="leads"]'],
      ["contacts", "/contacts", "contacts", '[data-resource-key="contacts"]'],
      ["organizations", "/organizations", "organizations", '[data-resource-key="organizations"]'],
      ["tasks", "/tasks", "tasks", '[data-resource-key="tasks"]'],
      ["support", "/support/cases", "support/cases", '[data-resource-key="support"]'],
    ]) {
      const records = (await read(`${endpoint}?limit=1`)).items as { id: string }[];
      if (!records[0]) { checks.push({ area: module ?? "", status: "NOT_RUN", detail: "No existing record" }); continue; }
      await page.goto(`${base}/${route}/${records[0].id}`);
      await expect(page.locator(ready ?? "").first()).toBeVisible({ timeout: 20_000 });
      const count = await banner().count();
      await page.waitForTimeout(4_500);
      await expect(banner()).toHaveCount(0); await expect(indicator()).toHaveCount(0);
      checks.push({ area: module ?? "", status: count ? "PASS" : "NOT_RUN", detail: count ? "Real notice expired, access boundary remains" : "Real detail loaded; current access does not trigger informational notice" });
    }
    const product = (await read("/products/selection?limit=1")).items[0];
    if (product) {
      await page.goto(`${base}/products/${product.id}`);
      const failure = page.getByRole("heading", { name: "Màn hình gặp lỗi khi hiển thị.", exact: true });
      await expect(page.locator("#product-detail-header").or(failure)).toBeVisible({ timeout: 20_000 });
      checks.push({ area: "products", status: await failure.count() ? "FAIL" : "NOT_RUN", detail: await failure.count() ? "Existing Product detail rendering failure; no source change in this task" : "Protected Product read uses its own authority; no shared informational notice to exercise" });
    }
    const abort = async (route: Route) => { await route.abort("failed"); };
    await page.route("**/access/records/evaluate", abort);
    await page.goto(`${base}/deals/${dealId}`);
    await expect(page.locator('[data-access-verification-state="error"]')).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(4_500);
    await expect(page.getByRole("button", { name: "Thử lại", exact: true })).toBeVisible();
    await expect(page.locator("#deal-detail-header")).toHaveCount(0);
    await page.screenshot({ path: path.join(directory, "remaining-access-after-critical-error.png") });
    await page.unroute("**/access/records/evaluate", abort);
    await page.getByRole("button", { name: "Thử lại", exact: true }).click();
    await expect(page.locator("#deal-detail-header")).toBeVisible();
    checks.push({ area: "Verification failure", status: "PASS", detail: "Real transport abort leaves persistent blocking error/Retry; record withheld; real retry recovers" });
    await page.goto(`/#/w/unicore-demo-anh-duong-control/crm/deals/${dealId}`);
    await expect(page.getByText(/Không thể xác minh quyền truy cập|Bạn không có quyền xem bản ghi này|Không thể tải cơ hội/u).first()).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(4_500);
    await expect(page.locator("#deal-detail-header")).toHaveCount(0);
    await expect(indicator()).toHaveCount(0);
    checks.push({ area: "Workspace isolation", status: "PASS", detail: "Foreign record remains blocked after timer; no stale informational notice" });
    expect(http.filter(item => item.method !== "GET" && !["/access/records/evaluate", "/auth/session/refresh"].includes(item.path))).toEqual([]);
    status = "PASS";
  } finally {
    await Promise.all(pending);
    await writeFile(path.join(directory, `remaining-access-${phase}.json`), JSON.stringify({ status, checks, decisions, http }, null, 2));
  }
}
