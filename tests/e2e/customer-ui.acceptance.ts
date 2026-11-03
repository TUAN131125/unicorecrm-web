import { expect, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import path from "node:path";

export async function runCustomerUiAcceptance(page: Page, directory: string, phase: string) {
  const base = "/#/w/unicore-demo-anh-duong/crm";
  const http: { path: string; query: string; status: number; workspace?: string }[] = [];
  let headers: Record<string, string> = {};
  page.on("request", request => { if (request.headers().authorization && request.headers()["x-workspace-id"]) headers = request.headers(); });
  page.on("response", response => { if (response.url().startsWith(process.env.UNICORECRM_TEST_API_BASE_URL ?? "invalid:")) {
    const url = new URL(response.url()); http.push({ path: url.pathname, query: url.search, status: response.status(), workspace: response.request().headers()["x-workspace-id"] });
  } });
  const checks: string[] = [];
  const api = async (endpoint: string) => {
    const id = crypto.randomUUID();
    const response = await page.request.get(`${process.env.UNICORECRM_TEST_API_BASE_URL}${endpoint}`, { headers: {
      Authorization: headers.authorization ?? "", "X-Workspace-Id": "ws_f2332a12d56a421d8a722bd2f65c5efb", "X-Request-Id": id, "X-Correlation-Id": id,
    } });
    expect(response.status()).toBe(200); return response.json();
  };
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${base}/customers`);
  await expect(page.locator("#customer-workspace tbody tr").first()).toBeVisible({ timeout: 20_000 });
  const customers = await api("/customers?limit=2");
  const contacts = await api("/contacts?limit=1");
  const customer = customers.items[0];
  const contact = contacts.items[0];
  if (phase === "after") {
    const identity = customers.identities[customer.id];
    expect(identity.displayName).not.toBe(customer.customerCode);
    const list = page.locator("#customer-workspace");
    const row = () => list.locator("tbody tr").first();
    await expect(row().locator("[data-customer-name]")).toHaveText(identity.displayName);
    expect(http.filter(read => /^\/customers\/[^/]+\/360$/.test(read.path))).toHaveLength(0);
    expect(http.filter(read => /^\/(contacts|organizations)\/[^/]+$/.test(read.path))).toHaveLength(0);
    await expect(list.locator("[data-customer-visible-count]")).toHaveText("25 đang hiển thị");
    await expect(list.locator("[data-list-pagination]")).not.toContainText(/trên 25|Trang 1\//);
    expect((await row().boundingBox())!.height).toBeLessThan(85);
    expect((await row().locator("[data-customer-code]").boundingBox())!.height).toBeLessThan(30);
    await expect(list).not.toContainText("SYNTHETIC_DEMO");
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await row().locator("[data-customer-code] button").click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(customer.customerCode);
    checks.push("PASS fresh Customer list uses API-projected natural identity before visiting Contacts; no per-row 360/subject reads; compact code copy; page-scoped count");

    for (const expectedPage of [2, 3]) {
      const next = page.waitForResponse(r => new URL(r.url()).pathname === "/customers" && new URL(r.url()).searchParams.has("cursor") && r.status() === 200);
      await list.getByRole("button", { name: "Trang sau", exact: true }).click();
      const payload = await (await next).json();
      await expect(list.locator("[data-list-pagination]")).toContainText(`Trang ${expectedPage}`);
      await expect(row().locator("[data-customer-name]")).toHaveText(payload.identities[payload.items[0].id].displayName);
      await expect(list.locator("tbody tr")).toHaveCount(expectedPage === 2 ? 25 : 20);
    }
    await expect(list.getByRole("button", { name: "Trang sau", exact: true })).toBeDisabled();
    await page.reload();
    await expect(row().locator("[data-customer-name]")).toHaveText(identity.displayName, { timeout: 15_000 });
    checks.push("PASS cursor pagination 25/25/20, last-page bound, refresh rehydrates authoritative first page without invented total");

    const query = list.getByPlaceholder(/mã.*phân khúc|code.*segment/i);
    await query.fill(customer.customerCode);
    await expect(list.locator("tbody tr")).toHaveCount(1);
    await expect(row().locator("[data-customer-name]")).toHaveText(identity.displayName);
    await query.fill("");
    await expect(list.locator("tbody tr")).toHaveCount(25);
    await list.getByRole("button", { name: "Bộ lọc", exact: true }).click();
    const type = page.getByLabel("Loại khách hàng", { exact: true });
    for (const kind of ["B2B", "B2C"]) {
      const response = page.waitForResponse(r => new URL(r.url()).pathname === "/customers" && new URL(r.url()).searchParams.get("type") === kind && r.status() === 200);
      await type.selectOption(kind);
      const payload = await (await response).json();
      expect(payload.items.length).toBeGreaterThan(0);
      expect(payload.items.every((item: { type: string }) => item.type === kind)).toBe(true);
      await expect(row().locator("[data-customer-name]")).toHaveText(payload.identities[payload.items[0].id].displayName);
    }
    await page.getByRole("button", { name: "Đặt lại", exact: true }).click();
    await page.getByRole("button", { name: "Hoàn tất", exact: true }).click();
    await expect(row().locator("[data-customer-name]")).toHaveText(identity.displayName);
    await expect(list.getByLabel("Sắp xếp khách hàng")).toBeDisabled();
    await list.locator("#customer-view-dropdown-trigger").click();
    const saved = page.waitForResponse(r => new URL(r.url()).pathname === "/customers" && new URL(r.url()).searchParams.get("type") === "B2B" && r.status() === 200);
    await list.getByRole("button", { name: "Khách hàng B2B", exact: true }).click();
    const savedPayload = await (await saved).json();
    await expect(row().locator("[data-customer-name]")).toHaveText(savedPayload.identities[savedPayload.items[0].id].displayName);
    await list.locator("#customer-view-dropdown-trigger").click();
    await list.getByRole("button", { name: "Tất cả khách hàng", exact: true }).last().click();
    await expect(row().locator("[data-customer-name]")).toHaveText(identity.displayName);
    checks.push("PASS code search and server B2B/B2C filters resolve both Organization and Contact subject names; BLOCKED_CONTRACT source-name search and alternative sorting (truthful UI)");

    await row().getByRole("checkbox").check();
    await expect(list.getByRole("button", { name: "Mở hồ sơ khách hàng", exact: true })).toBeVisible();
    await row().getByRole("checkbox").uncheck();
    const handle = list.locator("thead .cursor-col-resize").first();
    const box = (await handle.boundingBox())!;
    const initialWidth = (await handle.locator("..").boundingBox())!.width;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down(); await page.mouse.move(box.x + 35, box.y + box.height / 2); await page.mouse.up();
    expect((await handle.locator("..").boundingBox())!.width).toBeGreaterThan(initialWidth);
    await handle.dblclick();
    await list.getByRole("button", { name: "Cột", exact: true }).click();
    await expect(page.getByText("Tùy chỉnh cột", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await list.getByRole("button", { name: "Thống kê", exact: true }).click();
    await expect(page.getByText("Số liệu chỉ mô tả trang đang hiển thị, không phải tổng khách hàng của Workspace.", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    const refreshed = page.waitForResponse(r => new URL(r.url()).pathname === "/customers" && r.status() === 200);
    await list.getByTitle("Làm mới", { exact: true }).click(); await refreshed;
    await row().getByRole("button", { name: `Thao tác ${identity.displayName}`, exact: true }).click();
    await page.getByRole("menuitem", { name: "Xem Customer 360", exact: true }).click();
    await expect(page.locator("[data-customer-detail-name]")).toHaveText(identity.displayName);
    checks.push("PASS selection/bulk action entry, column resizing/reset/settings, page-only statistics, real refresh, row menu navigation");

    const detail = page.locator("[data-customer-connected-workspace]");
    await expect(detail.locator("#customer-connected-record-header")).not.toContainText("INACTIVE");
    await expect(detail).not.toContainText("SYNTHETIC_DEMO");
    const panel = page.locator("#customer-right-work-panel");
    await expect(panel).toBeVisible();
    await panel.getByRole("tab", { name: "Lịch sử", exact: true }).click();
    await panel.getByRole("tab", { name: "Công việc", exact: true }).click();
    await detail.getByRole("button", { name: "Ẩn bảng quan hệ", exact: true }).click();
    await expect(panel).not.toBeVisible();
    await detail.getByRole("button", { name: "Hiện bảng quan hệ", exact: true }).click();
    await expect(panel).toBeVisible();
    await page.goto(`${base}/customers/${customer.id}?tab=relationship`);
    await expect(detail).toContainText("Quan hệ");
    await page.reload();
    await expect(page.locator("[data-customer-detail-name]")).toHaveText(identity.displayName, { timeout: 15_000 });
    await expect(page).toHaveURL(/tab=relationship/);
    await expect(detail.getByRole("heading", { name: "Định danh và liên kết", exact: true })).toBeVisible();
    await detail.getByRole("button", { name: "Hồ sơ nguồn", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/(contacts|organizations)/${identity.contactId ?? identity.organizationId}$`));
    await expect(page.locator(identity.contactId ? "#contact-detail-page-workspace" : "#organization-detail-workspace")).toBeVisible();
    checks.push("PASS detail identity matches list; localized status, panel tabs/collapse, relationship deep-link/refresh and authorized source navigation");

    const id = crypto.randomUUID();
    const denied = await page.request.get(`${process.env.UNICORECRM_TEST_API_BASE_URL}/customers/${customer.id}/360`, { headers: {
      Authorization: headers.authorization ?? "", "X-Workspace-Id": "ws_811689cfc4b446eab4f29dc109e2abf2", "X-Request-Id": id, "X-Correlation-Id": id,
    } });
    expect([403, 404]).toContain(denied.status());
    const sidebar = page.locator("#unicore-sidebar");
    await sidebar.getByRole("button", { name: "UniCoreCRM Demo - Công ty Ánh Dương", exact: true }).click();
    await sidebar.getByRole("button", { name: "UniCoreCRM Demo - Kiểm tra cô lập", exact: true }).click();
    await page.waitForURL(/unicore-demo-anh-duong-control\/crm\//);
    await expect(sidebar.getByRole("button", { name: "UniCoreCRM Demo - Kiểm tra cô lập", exact: true })).toBeVisible();
    await page.goto("/#/w/unicore-demo-anh-duong-control/crm/customers");
    await expect(page.getByText("Không có khách hàng phù hợp", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("#customer-workspace")).not.toContainText(identity.displayName);
    await sidebar.getByRole("button", { name: "UniCoreCRM Demo - Kiểm tra cô lập", exact: true }).click();
    await sidebar.getByRole("button", { name: "UniCoreCRM Demo - Công ty Ánh Dương", exact: true }).click();
    await page.waitForURL(/unicore-demo-anh-duong\/crm\//);
    await page.goto(`${base}/customers`);
    await expect(row().locator("[data-customer-name]")).toHaveText(identity.displayName, { timeout: 15_000 });
    checks.push(`PASS workspace switch has no name leakage; foreign Customer360 returns ${denied.status()}; returning to demo rehydrates names`);
  }
  for (const [size, width, height] of [["desktop", 1440, 900], ["laptop", 1366, 768], ["tablet", 768, 1024], ["mobile", 390, 844]] as const) {
    await page.setViewportSize({ width, height });
    for (const [screen, route, ready] of [
      ["customer-list", `${base}/customers`, "#customer-workspace"],
      ["contact-list", `${base}/contacts`, "[data-module-key=contacts]"],
      ["customer-detail", `${base}/customers/${customer.id}`, "[data-customer-connected-workspace]"],
      ["contact-detail", `${base}/contacts/${contact.id}`, "#contact-detail-page-workspace"],
    ]) {
      await page.goto(route ?? "");
      await expect(page.locator(ready ?? "").first()).toBeVisible({ timeout: 20_000 });
      await page.waitForTimeout(4_300);
      await page.screenshot({ path: path.join(directory, `customer-ui-${phase}-${screen}-${size}.png`) });
    }
  }
  checks.push("Four real Connected screens captured at desktop/laptop/tablet/mobile with elapsed informational notices");
  await writeFile(path.join(directory, `customer-ui-${phase}.json`), JSON.stringify({ checks, customerId: customer.id, contactId: contact.id, customerListFields: Object.keys(customer), http }, null, 2));
}
