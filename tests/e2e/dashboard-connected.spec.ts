import { expect, test } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { createHash } from "node:crypto";
import { runAiUiAcceptance } from "./ai-ui.acceptance";
import { runUiCleanupAcceptance } from "./ui-cleanup.acceptance";
import { runAccessNoticesAcceptance } from "./access-notices.acceptance";
import { runCustomerUiAcceptance } from "./customer-ui.acceptance";
import { runInternalNoticesAcceptance } from "./internal-notices.acceptance";
import { runRemainingAccessAcceptance } from "./remaining-access.acceptance";
import { runDealWorkspaceAcceptance } from "./deal-workspace.acceptance";

test("Dashboard uses bounded authoritative reads on fresh login and workspace transitions", async ({ page }, info) => {
  test.setTimeout(process.env.UNICORECRM_AI_UI_PHASE || process.env.UNICORECRM_CUSTOMER_UI_PHASE || process.env.UNICORECRM_REMAINING_ACCESS_PHASE || process.env.UNICORECRM_INTERNAL_NOTICES_PHASE ? 420_000 : 180_000);
  const directory = process.env.UNICORECRM_DASHBOARD_EVIDENCE;
  if (!directory) throw new Error("Use the read-only verify-connected-dashboard.ps1 harness");
  const phase = process.env.UNICORECRM_DASHBOARD_PHASE;
  const expected = JSON.parse(await readFile(path.join(directory, "expected.json"), "utf8")) as { openDeals: number; pipeline: string; overdueTasks: number; openSupport: number; dueToday: number; urgentSupport: number };
  const http: { path: string; query: string; status: number; workspace: string | undefined; method: string }[] = [];
  const checks: string[] = [];
  const navigationPhase = process.env.UNICORECRM_DASHBOARD_NAV_PHASE;
  const authorization: { workspaceId: string; dashboardCapability: boolean; crmAccess: boolean; roleTemplateIds: string[]; roleCapabilityHash: string }[] = [];
  const authorizationReads: Promise<void>[] = [];
  const dashboard = "/#/w/unicore-demo-anh-duong/crm/dashboard";
  page.on("response", response => {
    if (!response.url().startsWith(process.env.UNICORECRM_TEST_API_BASE_URL ?? "invalid:")) return;
    const url = new URL(response.url());
    http.push({ path: url.pathname, query: url.search, status: response.status(), workspace: response.request().headers()["x-workspace-id"], method: response.request().method() });
    if (url.pathname === "/access/context" && response.status() === 200) authorizationReads.push(response.json().then(value => {
      authorization.push({ workspaceId: value.workspaceId, dashboardCapability: value.capabilities.includes("dashboard.read"), crmAccess: value.productSpaces.includes("crm"), roleTemplateIds: value.roleTemplateIds,
        roleCapabilityHash: createHash("sha256").update(JSON.stringify({ roles: [...value.roleIds].sort(), capabilities: [...value.capabilities].sort(), productSpaces: [...value.productSpaces].sort() })).digest("hex") });
    }));
  });
  async function login() {
    await page.goto("/#/login");
    await page.getByLabel("Email", { exact: true }).fill(process.env.UNICORECRM_TEST_EMAIL ?? "");
    await page.getByLabel(/Mật khẩu|Password/u, { exact: true }).fill(process.env.UNICORECRM_TEST_PASSWORD ?? "");
    await page.getByRole("button", { name: /^(Đăng nhập|Sign in)$/u }).click();
    await page.waitForURL(/#\/(?:select-workspace|w\/[^/]+\/crm\/)/u);
    await page.goto(dashboard);
    // Hash navigation can finish before the lazy route has compiled/mounted in Vite.
    if (phase !== "before") await expect(page.locator("#connected-dashboard")).toBeVisible({ timeout: 15_000 });
  }
  async function assertMetrics() {
    await expect(page.locator('[data-dashboard-metric="pipeline"][data-state="READY"]')).toHaveAttribute("data-count", String(expected.openDeals));
    await expect(page.locator('[data-dashboard-metric="pipeline"] [data-dashboard-money-full]')).toHaveAttribute("title", new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 4 }).format(Number(expected.pipeline)));
    await expect(page.locator('[data-dashboard-metric="overdue"]')).toHaveAttribute("data-value", String(expected.overdueTasks));
    await expect(page.locator('[data-dashboard-metric="support"]')).toHaveAttribute("data-value", String(expected.openSupport));
    await expect(page.locator('[data-dashboard-metric="due-today"]')).toHaveAttribute("data-value", String(expected.dueToday));
    await expect(page.locator('[data-dashboard-metric="support"]')).toContainText(`${expected.urgentSupport} phiếu ưu tiên cao`);
    await expect(page.locator('[data-dashboard-metric="leads"]')).toHaveAttribute("data-state", "BLOCKED_CONTRACT");
    await expect(page.locator('[data-dashboard-metric="revenue"]')).toHaveAttribute("data-state", "BLOCKED_CONTRACT");
  }
  try {
    await login();
    if (process.env.UNICORECRM_DEAL_WORKSPACE_PHASE) {
      await runDealWorkspaceAcceptance(page, directory, process.env.UNICORECRM_DEAL_WORKSPACE_PHASE);
      return;
    }
    if (process.env.UNICORECRM_INTERNAL_NOTICES_PHASE) {
      await runInternalNoticesAcceptance(page, directory, process.env.UNICORECRM_INTERNAL_NOTICES_PHASE);
      return;
    }
    if (process.env.UNICORECRM_REMAINING_ACCESS_PHASE) {
      await runRemainingAccessAcceptance(page, directory, process.env.UNICORECRM_REMAINING_ACCESS_PHASE);
      return;
    }
    if (process.env.UNICORECRM_CUSTOMER_UI_PHASE) {
      await runCustomerUiAcceptance(page, directory, process.env.UNICORECRM_CUSTOMER_UI_PHASE);
      return;
    }
    if (process.env.UNICORECRM_ACCESS_NOTICE_PHASE) {
      await runAccessNoticesAcceptance(page, directory, process.env.UNICORECRM_ACCESS_NOTICE_PHASE);
      return;
    }
    if (process.env.UNICORECRM_UI_CLEANUP_PHASE) {
      await runUiCleanupAcceptance(page, directory, process.env.UNICORECRM_UI_CLEANUP_PHASE);
      return;
    }
    if (process.env.UNICORECRM_AI_UI_PHASE) {
      await runAiUiAcceptance(page, directory, process.env.UNICORECRM_AI_UI_PHASE);
      checks.push("AI UI acceptance completed using existing demo workspace");
      return;
    }
    if (navigationPhase === "before") {
      await assertMetrics();
      const sidebar = page.locator("#unicore-sidebar");
      await expect(sidebar).toHaveAttribute("data-product-space", "crm");
      await expect(sidebar.getByRole("link", { name: "Dashboard", exact: true })).toHaveCount(0);
      for (const [name, width, height] of [["desktop", 1440, 900], ["laptop", 1366, 768], ["mobile", 390, 844]] as const) {
        await page.setViewportSize({ width, height });
        await page.emulateMedia({ reducedMotion: "reduce" });
        if (name === "mobile") await page.getByRole("button", { name: /Mở điều hướng|Open navigation/u }).click();
        await page.screenshot({ path: path.join(directory, `sidebar-before-${name}.png`), fullPage: true });
      }
      await Promise.all(authorizationReads);
      await writeFile(path.join(directory, "sidebar-before-authority.json"), JSON.stringify({ authorization, profile: await sidebar.locator("[data-navigation-profile]").getAttribute("data-navigation-profile"), dashboardItems: 0 }, null, 2));
      checks.push("CRM route and Backend metrics accessible, but Dashboard absent from sidebar; real authorization captured");
      return;
    }
    if (navigationPhase === "after") {
      await assertMetrics();
      const sidebar = page.locator("#unicore-sidebar");
      const dashboardItem = () => sidebar.getByRole("link", { name: "Dashboard", exact: true });
      const assertNavigation = async (key = "unicore-demo-anh-duong") => {
        await expect(sidebar).toHaveAttribute("data-product-space", "crm");
        await expect(dashboardItem()).toHaveCount(1);
        await expect(dashboardItem()).toHaveAttribute("href", `#/w/${key}/crm/dashboard`);
        await expect(dashboardItem()).toHaveAttribute("aria-current", "page");
        await expect(sidebar.locator("[data-sidebar-group]").first()).toHaveAttribute("data-sidebar-group", "crm-overview");
      };
      await assertNavigation();
      for (const [name, width, height] of [["desktop", 1440, 900], ["laptop", 1366, 768]] as const) {
        await page.setViewportSize({ width, height });
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.mouse.move(0, 0);
        await assertNavigation();
        await page.screenshot({ path: path.join(directory, `sidebar-after-${name}.png`), fullPage: true });
      }
      await sidebar.getByRole("link", { name: "Cơ hội", exact: true }).click();
      await page.waitForURL(/\/crm\/deals$/u);
      await expect(dashboardItem()).not.toHaveAttribute("aria-current", "page");
      await dashboardItem().click();
      await assertMetrics();
      await assertNavigation();
      await page.goBack();
      await page.waitForURL(/\/crm\/deals$/u);
      await page.goForward();
      await assertMetrics();
      await assertNavigation();
      await page.reload();
      await assertMetrics();
      await assertNavigation();
      checks.push("One Dashboard first in Overview; Deals round-trip, browser history, refresh and active state PASS");
      await page.getByRole("button", { name: "Thu gọn thanh điều hướng", exact: true }).click();
      await expect(dashboardItem()).toBeInViewport();
      await expect(dashboardItem().locator("svg")).toBeVisible();
      await page.screenshot({ path: path.join(directory, "sidebar-after-collapsed.png"), fullPage: true });
      await dashboardItem().click();
      await assertNavigation();
      await page.getByRole("button", { name: "Mở rộng thanh điều hướng", exact: true }).click();
      checks.push("Collapsed icon/link and expanded navigation PASS");
      await sidebar.getByRole("button", { name: "UniCoreCRM Demo - Công ty Ánh Dương", exact: true }).click();
      await sidebar.getByRole("button", { name: "UniCoreCRM Demo - Kiểm tra cô lập", exact: true }).click();
      await page.waitForURL(/unicore-demo-anh-duong-control\/crm\/dashboard$/u);
      await assertNavigation("unicore-demo-anh-duong-control");
      await expect(page.locator('[data-dashboard-metric="pipeline"]')).toHaveAttribute("data-count", "0");
      await sidebar.getByRole("button", { name: "UniCoreCRM Demo - Kiểm tra cô lập", exact: true }).click();
      await sidebar.getByRole("button", { name: "UniCoreCRM Demo - Công ty Ánh Dương", exact: true }).click();
      await assertMetrics();
      await assertNavigation();
      checks.push("Real workspace selector updates Dashboard route and isolates control/demo data");
      for (const destination of ["studio", "people/members"]) {
        await page.goto(`/#/w/unicore-demo-anh-duong/${destination}`);
        await expect(sidebar).toHaveAttribute("data-product-space", destination.split("/")[0] ?? "");
        await expect(dashboardItem()).toHaveCount(0);
      }
      await page.goto(dashboard);
      await assertMetrics();
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole("button", { name: "Mở điều hướng", exact: true }).click();
      await expect(dashboardItem()).toBeInViewport();
      await assertNavigation();
      await page.screenshot({ path: path.join(directory, "sidebar-after-mobile.png"), fullPage: true });
      await sidebar.getByRole("link", { name: "Cơ hội", exact: true }).click();
      await page.waitForURL(/\/crm\/deals$/u);
      await expect(dashboardItem()).not.toBeInViewport();
      await page.getByRole("button", { name: "Mở điều hướng", exact: true }).click();
      await dashboardItem().click();
      await assertMetrics();
      await expect(dashboardItem()).not.toBeInViewport();
      checks.push("Studio/People unchanged; mobile Dashboard navigation closes drawer and preserves metrics");
      await Promise.all(authorizationReads);
      expect(authorization.every(context => !context.dashboardCapability)).toBe(true);
      const workspaceIds = new Set(authorization.map(context => context.workspaceId));
      expect(workspaceIds.size).toBe(2);
      for (const workspaceId of workspaceIds) expect(new Set(authorization.filter(context => context.workspaceId === workspaceId).map(context => context.roleCapabilityHash)).size).toBe(1);
      const permissionWrites = http.filter(call => /^\/(access|workspaces)(\/|$)/u.test(call.path) && call.method !== "GET");
      expect(permissionWrites).toEqual([]);
      await writeFile(path.join(directory, "sidebar-after-authority.json"), JSON.stringify({ authorization, dashboardItems: 1, permissionWrites }, null, 2));
      return;
    }
    if (process.env.UNICORECRM_DASHBOARD_DESIGN_PHASE === "before") {
      await expect(page.locator('[data-dashboard-metric="pipeline"][data-state="READY"]')).toHaveAttribute("data-count", String(expected.openDeals));
      for (const [name, width, height] of [["desktop", 1440, 900], ["laptop", 1366, 768], ["tablet", 768, 1024], ["mobile", 390, 844], ["compact", 1024, 768], ["narrow", 320, 844]] as const) {
        await page.setViewportSize({ width, height });
        await page.screenshot({ path: path.join(directory, `design-before-${name}.png`), fullPage: true });
      }
      checks.push("Captured current hydrated UI baseline at six viewport sizes using real demo data");
      return;
    }
    if (phase === "before") {
      await expect(page.getByText("Pipeline đang mở", { exact: true })).toBeVisible();
      expect(http.some(item => item.path === "/deals/forecast-summary")).toBe(false);
      await expect(page.getByText("0 cơ hội đang hoạt động", { exact: true })).toBeVisible();
      await page.screenshot({ path: info.outputPath("dashboard-before.png"), fullPage: true });
      checks.push("Reproduced: fresh Dashboard shows zero and requests no forecast despite nonzero SQL/API");
      return;
    }
    await assertMetrics();
    const initialReads = [...http];
    checks.push("Fresh login: metrics match SQL/API without visiting module lists");
    const work = page.locator('[data-dashboard-section="work"]');
    const closing = page.locator('[data-dashboard-section="closing"]');
    const activities = page.locator('[data-dashboard-section="activities"]');
    const support = page.locator('[data-dashboard-section="support"]');
    await expect(work.locator("li a")).toHaveCount(5);
    await expect(closing.locator("li a")).toHaveCount(5);
    await expect(activities.locator("li")).toHaveCount(6);
    expect(await support.locator("li a").count()).toBeGreaterThan(0);
    expect(await support.locator("li a").count()).toBeLessThanOrEqual(6);
    checks.push("My work, closing Deals, recent Activity and representative Support queue render bounded Backend records");
    await page.screenshot({ path: info.outputPath("dashboard-after.png"), fullPage: true });
    const visual: { name: string; width: number; height: number; overflow: number }[] = [];
    const beforeResize = http.filter(item => item.path === "/deals/forecast-summary").length;
    for (const [name, width, height] of [["desktop", 1440, 900], ["laptop", 1366, 768], ["tablet", 768, 1024], ["mobile", 390, 844], ["compact", 1024, 768], ["narrow", 320, 844]] as const) {
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.mouse.move(0, 0);
      await assertMetrics();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${name} has no horizontal overflow`).toBeLessThanOrEqual(1);
      await page.screenshot({ path: path.join(directory, `design-after-${name}.png`), fullPage: true });
      if (name === "mobile" || name === "narrow") {
        await work.scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(directory, `design-after-${name}-work.png`), fullPage: true });
        await support.scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(directory, `design-after-${name}-support.png`), fullPage: true });
        await page.locator('[data-guidance-id="dashboard.overview.screen"]').scrollIntoViewIfNeeded();
      }
      if (name === "laptop" || name === "desktop") {
        const top = await work.boundingBox();
        expect(top?.y).toBeLessThan(height - 150);
        const kpis = page.locator('[data-dashboard-metric="pipeline"], [data-dashboard-metric="overdue"], [data-dashboard-metric="due-today"], [data-dashboard-metric="support"]');
        const boxes = await kpis.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().top));
        expect(new Set(boxes).size).toBe(1);
      }
      visual.push({ name, width, height, overflow });
      if (name === "desktop" || name === "mobile") {
        const accessibility = await new AxeBuilder({ page }).include("#connected-dashboard").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
        expect(accessibility.violations, `${name} Dashboard WCAG scan`).toEqual([]);
      }
    }
    expect(http.filter(item => item.path === "/deals/forecast-summary").length).toBe(beforeResize);
    await writeFile(path.join(directory, "design-viewports.json"), JSON.stringify(visual, null, 2));
    checks.push("Six responsive viewports: no overflow, four desktop KPIs aligned, work above fold, no resize fetch");
    await page.setViewportSize({ width: 1366, height: 768 });
    checks.push("Desktop/mobile scoped WCAG A/AA scans pass with reduced motion");
    const taskRow = work.locator("li a").first();
    const taskTitle = await taskRow.locator("p").first().innerText();
    await taskRow.focus();
    await expect(taskRow).toBeFocused();
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/crm\/tasks\/[^/?]+$/u);
    await expect(page.getByText(taskTitle, { exact: true }).first()).toBeVisible();
    await page.goto(dashboard);
    await assertMetrics();
    const dealRow = closing.locator("li a").first();
    const dealTitle = await dealRow.locator("p").first().innerText();
    await dealRow.click();
    await page.waitForURL(/\/crm\/deals\/[^/?]+$/u);
    await expect(page.getByText(dealTitle, { exact: true }).first()).toBeVisible();
    await page.goto(dashboard);
    await assertMetrics();
    for (const [id, route] of [["pipeline", "/deals"], ["overdue", "/tasks?view=mine"], ["due-today", "/tasks?view=mine"], ["support", "/support/cases"]]) {
      await page.locator(`[data-dashboard-metric="${id}"] a`).click();
      await expect(page).toHaveURL(new RegExp(`/crm${route?.replace("?", "\\?")}$`, "u"));
      await page.goto(dashboard);
      await assertMetrics();
    }
    checks.push("Task keyboard navigation, Deal detail and all four KPI destinations work");
    await page.reload();
    await assertMetrics();
    checks.push("Refresh: authoritative metrics persist");
    await page.goto("/#/w/unicore-demo-anh-duong-control/crm/dashboard");
    await expect(page.locator('[data-dashboard-metric="pipeline"][data-state="READY"]')).toHaveAttribute("data-count", "0");
    await expect(page.locator('[data-dashboard-metric="support"]')).toHaveAttribute("data-value", "0");
    await expect(work.locator("[data-dashboard-empty]")).toBeVisible();
    await expect(activities.locator("[data-dashboard-empty]")).toBeVisible();
    await page.goto(dashboard);
    await assertMetrics();
    checks.push("Workspace switch: control empty; demo values reload on return");
    await page.goto("/#/w/unicore-demo-anh-duong/crm/contacts");
    await expect(page.getByText("Nguyễn", { exact: false }).filter({ visible: true }).first()).toBeVisible();
    const previousForecasts = http.filter(item => item.path === "/deals/forecast-summary").length;
    await page.goto(dashboard);
    await assertMetrics();
    expect(http.filter(item => item.path === "/deals/forecast-summary").length).toBeGreaterThan(previousForecasts);
    checks.push("Dashboard remount re-reads Backend instead of depending on module cache");
    // Hold a genuine Backend response across a scope change; no response data is invented.
    let holdNext = true;
    let markHeld: () => void = () => {};
    let releaseHeld: () => void = () => {};
    let markReleased: () => void = () => {};
    const held = new Promise<void>(resolve => { markHeld = resolve; });
    const release = new Promise<void>(resolve => { releaseHeld = resolve; });
    const released = new Promise<void>(resolve => { markReleased = resolve; });
    await page.route("**/deals/forecast-summary", async route => {
      if (!holdNext) { await route.continue(); return; }
      holdNext = false;
      const response = await route.fetch();
      markHeld();
      await release;
      try { await route.fulfill({ response }); }
      catch { /* The old scope may already have cancelled this request. */ }
      finally { markReleased(); }
    });
    try {
      await page.reload();
      await held;
      await expect(page.locator('[data-dashboard-metric="pipeline"]')).toHaveAttribute("data-state", "LOADING");
      await expect(page.locator("[data-dashboard-skeleton]").first()).toBeVisible();
      await expect(page.locator('[data-dashboard-metric="pipeline"]')).not.toHaveAttribute("data-count");
      await page.screenshot({ path: path.join(directory, "design-loading.png"), fullPage: true });
      await page.goto("/#/w/unicore-demo-anh-duong-control/crm/dashboard");
      await expect(page.locator('[data-dashboard-metric="pipeline"][data-state="READY"]')).toHaveAttribute("data-count", "0");
      releaseHeld();
      await released;
      await expect(page.locator('[data-dashboard-metric="pipeline"]')).toHaveAttribute("data-count", "0");
    } finally {
      releaseHeld();
      await page.unroute("**/deals/forecast-summary");
    }
    await page.goto(dashboard);
    await assertMetrics();
    checks.push("Delayed real response from retired workspace cannot replace active control metrics");
    // Fault injection aborts transport; it never fabricates a response or metric.
    await page.route("**/deals/forecast-summary", route => route.abort("failed"));
    await page.reload();
    await expect(page.locator('[data-dashboard-metric="pipeline"]')).toHaveAttribute("data-state", "ERROR");
    await expect(page.locator('[data-dashboard-metric="pipeline"]')).not.toHaveAttribute("data-count", "0");
    await expect(page.locator('[data-dashboard-metric="support"]')).toHaveAttribute("data-value", String(expected.openSupport));
    await page.screenshot({ path: path.join(directory, "design-network-error.png"), fullPage: true });
    await page.unroute("**/deals/forecast-summary");
    await page.locator('[data-dashboard-metric="pipeline"]').getByRole("button", { name: "Thử lại", exact: true }).click();
    await assertMetrics();
    checks.push("Transport failure is unavailable, never zero; other sections survive and refresh recovers");
    const dashboardCalls = initialReads.filter(item => ["/tasks", "/support/cases", "/deals", "/activities"].includes(item.path));
    for (const call of dashboardCalls) {
      const query = new URLSearchParams(call.query);
      expect(Number(query.get("limit"))).toBeLessThanOrEqual(6);
      expect(query.has("cursor")).toBe(false);
    }
    expect(initialReads.some(item => item.path === "/orders" || item.path === "/quotes" || item.path === "/customers")).toBe(false);
    expect(dashboardCalls.length).toBe(21);
    checks.push("Bounded reads: no pagination sweep or unneeded commercial/customer hydration");
  } finally {
    await writeFile(path.join(directory, `${phase}-browser.json`), JSON.stringify({ checks, http }, null, 2));
  }
});
