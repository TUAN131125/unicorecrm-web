import { expect, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import path from "node:path";

export async function runDealWorkspaceAcceptance(page: Page, directory: string, phase: string) {
  const root = "/#/w/unicore-demo-anh-duong/crm";
  const dealId = "deal_5b123fb499dd49a395a88314faf34ca1";
  const http: { path: string; query: string; status: number; method: string; workspace?: string }[] = [];
  const checks: string[] = [];
  let status = "FAIL";
  page.on("response", response => {
    if (!response.url().startsWith(process.env.UNICORECRM_TEST_API_BASE_URL ?? "invalid:")) return;
    const url = new URL(response.url());
    http.push({ path: url.pathname, query: url.search, status: response.status(), method: response.request().method(), workspace: response.request().headers()["x-workspace-id"] });
  });
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const [name, width, height] of [["desktop", 1440, 900], ["laptop", 1366, 768], ["small-desktop", 1024, 768], ["tablet", 768, 1024], ["mobile", 390, 844]] as const) {
      await page.setViewportSize({ width, height });
      await page.goto(`${root}/deals/${dealId}`);
      await expect(page.locator("#deal-detail-header")).toBeVisible({ timeout: 25_000 });
      await expect(page.locator("[data-deal-buyer-name]")).toHaveAttribute("data-state", "READY");
      if (phase === "after") {
        await expect(page.getByRole("tab")).toHaveCount(5);
        await expect(page.locator('[data-deal-workspace="studio-pipeline"]')).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        await expect(page.locator("[data-effective-access-notice], [data-transient-info-notice]")).toHaveCount(0);
      }
      await page.screenshot({ path: path.join(directory, `deal-workspace-${phase}-${name}.png`), fullPage: true });
      checks.push(`${name}: detail loaded, screenshot captured${phase === "after" ? ", five tabs and no page overflow" : ""}`);
    }
    if (phase === "after") {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.getByRole("button", { name: /Về danh sách cơ hội|Back to Deals/u }).click();
      await expect(page).toHaveURL(/\/crm\/deals$/u);
      checks.push("Deep link Back uses the active workspace Deal list fallback");
      await page.goto(`${root}/deals/${dealId}`);
      await expect(page.locator("#deal-detail-header")).toBeVisible();
      for (const name of ["Báo giá", "Công việc", "Hoạt động", "Dự báo", "Tổng quan"]) {
        await page.getByRole("tab", { name, exact: true }).click();
        await expect(page.getByRole("tab", { name, exact: true })).toHaveAttribute("aria-selected", "true");
        await page.screenshot({ path: path.join(directory, `deal-workspace-tab-${name}.png`), fullPage: true });
      }
      await page.reload();
      await expect(page.locator("#deal-detail-header")).toBeVisible();
      await page.getByRole("button", { name: /Đánh dấu thắng/u, exact: true }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.getByRole("button", { name: /Xác nhận thắng/u })).toBeDisabled();
      await page.getByRole("button", { name: "Hủy", exact: true }).click();
      await page.getByRole("button", { name: /Đánh dấu thua/u, exact: true }).click();
      await expect(page.locator("#deal-lost-reason")).toBeVisible();
      await page.getByRole("button", { name: "Hủy", exact: true }).click();
      checks.push("Fresh detail/refresh, all tabs, Won guard without mutation and Lost dialog preserved");
      const stage = page.locator("#deal-stage-select");
      await expect(stage).toBeVisible();
      const targets = await stage.locator("option").evaluateAll(options => options.map(option => (option as HTMLOptionElement).value).filter(Boolean));
      expect(targets.length).toBeGreaterThan(0);
      expect(targets).not.toContain("WON"); expect(targets).not.toContain("LOST");
      await stage.selectOption(targets[0] ?? "");
      await expect(page.getByRole("button", { name: "Cập nhật giai đoạn", exact: true })).toBeEnabled();
      checks.push("Allowed canonical stage choices enabled; Won/Lost excluded. Shared demo Deal is not mutated");
      for (const view of ["kanban", "table"]) {
        await page.goto(`${root}/deals?view=${view}`);
        const open = view === "kanban" ? page.locator('[data-deal-kanban-card="balanced"]').first() : page.locator("tbody tr td span.cursor-pointer").first();
        await expect(open).toBeVisible({ timeout: 25_000 });
        await open.click();
        await expect(page.locator("#deal-detail-header")).toBeVisible({ timeout: 25_000 });
        await page.reload();
        await expect(page.locator("#deal-detail-header")).toBeVisible();
        await page.getByRole("button", { name: /Về danh sách cơ hội|Back to Deals/u }).click();
        await expect(page).toHaveURL(new RegExp(`crm/deals\\?view=${view}$`, "u"));
        checks.push(`Back preserves ${view} across detail refresh`);
      }
      await page.goto(`${root}/deals/${dealId}`);
      await expect(page.locator("#deal-detail-header")).toBeVisible();
      await page.getByRole("tab", { name: "Công việc", exact: true }).click();
      await expect(page.locator("[data-related-task-id]").first()).toBeVisible();
      await page.locator("[data-related-task-id] button").first().click();
      await expect(page).toHaveURL(/\/crm\/tasks\//u);
      checks.push("Authoritative related Task opens its detail");
      await page.goto(`${root}/deals/${dealId}`);
      await expect(page.locator("#deal-detail-header")).toBeVisible();
      const activityRead = page.waitForResponse(response => new URL(response.url()).pathname === "/activities" && new URL(response.url()).searchParams.get("recordId") === dealId);
      await page.getByRole("tab", { name: "Hoạt động", exact: true }).click();
      const activityResponse = await activityRead;
      expect(activityResponse.status()).toBe(200);
      const activityPage = await activityResponse.json() as { items: { id: string }[] };
      await expect(page.getByRole("tab", { name: "Hoạt động", exact: true })).toHaveAttribute("aria-selected", "true");
      await expect(page.locator("[data-deal-activity-id]")).toHaveCount(activityPage.items.length);
      if (activityPage.items.length === 0) await expect(page.getByText("Chưa có hoạt động nào.", { exact: true })).toBeVisible();
      await expect(page.getByRole("tabpanel").getByRole("button", { name: "Ghi chú", exact: true })).toHaveCount(1); // existing Note filter only; no unsupported write CTA
      checks.push(`Activity tab matches authoritative scoped API (${activityPage.items.length} records). Non-empty Connected state is NOT_RUN when no linked data exists`);
      await page.goto(`/#/w/unicore-demo-anh-duong-control/crm/deals/${dealId}`);
      await expect(page.getByText(/Không thể xác minh quyền truy cập|Bạn không có quyền xem bản ghi này|Không thể tải cơ hội/u).first()).toBeVisible({ timeout: 25_000 });
      await expect(page.locator("#deal-detail-header")).toHaveCount(0);
      checks.push("Control workspace cannot read demo Deal; no stale header");
      expect(http.filter(item => item.method !== "GET" && !["/access/records/evaluate", "/auth/session/refresh"].includes(item.path))).toEqual([]);
    }
    status = "PASS";
  } finally {
    await writeFile(path.join(directory, `deal-workspace-${phase}.json`), JSON.stringify({ status, checks, http }, null, 2));
  }
}
