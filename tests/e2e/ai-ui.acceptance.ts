import { expect, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";

export async function runAiUiAcceptance(page: Page, directory: string, phase: string) {
  const checks: string[] = [];
  const calls: { path: string; method: string; workspace?: string; context?: unknown }[] = [];
  const outcomes: { entity: string; status: number; code?: string; provider?: string; evidence?: number }[] = [];
  const visual: { name: string; context: string; overflow: number }[] = [];
  page.on("request", request => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/ai/")) calls.push({ path: url.pathname, method: request.method(), workspace: request.headers()["x-workspace-id"], ...(url.pathname === "/ai/advisories" ? { context: request.postDataJSON()?.contextReferences } : {}) });
  });
  const viewports = [["desktop", 1440, 900], ["laptop", 1366, 768], ["compact", 1024, 768], ["tablet", 768, 1024], ["mobile", 390, 844], ["narrow", 320, 844]] as const;
  const ai = page.locator('[data-ai-workspace="v3"]');
  const open = async () => { await page.getByRole("button", { name: /Mở trợ lý AI|Open AI assistant/u }).click(); await expect(ai).toBeVisible(); };
  const close = async () => { await page.getByRole("button", { name: /Đóng Trợ lý AI|Close AI Assistant/u }).click(); await expect(ai).toHaveCount(0); };
  try {
  await expect(page.locator('[data-dashboard-metric="pipeline"][data-state="READY"]')).toBeVisible();
  await open();
  for (const [name, width, height] of viewports) {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    if (phase === "after") {
      await expect(ai).toHaveCSS("height", `${height}px`);
      await expect(ai.locator("textarea")).toBeDisabled();
      await expect(ai.getByText("Chọn một hồ sơ CRM để bắt đầu", { exact: true })).toBeVisible();
      const overflow = await ai.evaluate(element => element.scrollWidth - element.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      visual.push({ name, context: "none", overflow });
    }
    await page.screenshot({ path: path.join(directory, `ai-${phase}-no-context-${name}.png`), fullPage: phase === "before" });
  }
  await close();
  await page.setViewportSize({ width: 1366, height: 768 });
  const deal = page.locator('[data-dashboard-section="closing"] li a').first();
  const dealTitle = await deal.locator("p").first().innerText();
  await deal.click();
  await expect(page.getByText(dealTitle, { exact: true }).first()).toBeVisible();
  await open();
  for (const [name, width, height] of viewports) {
    await page.setViewportSize({ width, height });
    if (phase === "after") {
      await expect(ai).toHaveCSS("height", `${height}px`);
      await expect(ai.locator("textarea")).toBeEnabled();
      await expect(ai.locator("[data-ai-context]")).toContainText("Cơ hội");
      const overflow = await ai.evaluate(element => element.scrollWidth - element.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      const box = await ai.locator("textarea").boundingBox();
      expect(box && box.y + box.height).toBeLessThan(height);
      visual.push({ name, context: "deal", overflow });
      if (name === "desktop" || name === "mobile") {
        const scan = await new AxeBuilder({ page }).include('[data-ai-workspace="v3"]').withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
        expect(scan.violations).toEqual([]);
      }
    }
    await page.screenshot({ path: path.join(directory, `ai-${phase}-focused-${name}.png`), fullPage: phase === "before" });
  }
  if (phase === "after") {
    checks.push("Six real Connected viewports: focused/unfocused, no overflow, composer visible; desktop/mobile WCAG A/AA scans PASS");
    expect(calls).toEqual([]); // Opening the UI never tests or invokes the provider.
    await page.setViewportSize({ width: 390, height: 844 });
    await ai.getByRole("button", { name: "Mở lịch sử", exact: true }).click();
    const history = page.getByRole("dialog", { name: "Lịch sử trò chuyện", exact: true });
    await expect(history).toBeVisible();
    await history.getByRole("textbox", { name: "Tìm lịch sử", exact: true }).click();
    await expect(history.getByRole("textbox", { name: "Tìm lịch sử", exact: true })).toBeFocused();
    await page.screenshot({ path: path.join(directory, "ai-after-history-mobile.png") });
    await page.keyboard.press("Escape");
    await expect(history).toHaveCount(0);
    await expect(ai).toBeVisible();
    await expect(ai.getByRole("button", { name: "Mở lịch sử", exact: true })).toBeFocused();
    await page.setViewportSize({ width: 1366, height: 768 });
    await ai.getByRole("button", { name: "Đóng Trợ lý AI", exact: true }).focus();
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press("Tab");
      expect(await ai.evaluate(element => element.contains(document.activeElement))).toBe(true);
    }
    await page.setViewportSize({ width: 1600, height: 900 });
    await expect(ai.locator("aside[data-ai-context]")).toBeVisible();
    await page.screenshot({ path: path.join(directory, "ai-after-wide-context.png") });
    await page.setViewportSize({ width: 1366, height: 768 });
    await expect(ai.locator("aside[data-ai-context]")).toHaveCount(0);
    const composer = ai.locator("textarea");
    await composer.fill(Array.from({ length: 20 }, (_, index) => `Điểm cần làm rõ ${index + 1}`).join("\n"));
    await expect(composer).toHaveCSS("height", "140px");
    await composer.fill("");
    await expect(composer).toHaveCSS("height", "44px");
    await composer.fill("Tóm tắt hồ sơ đang chọn.");
    await composer.evaluate(element => element.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, isComposing: true })));
    expect(calls).toEqual([]);
    await composer.press("Shift+Enter");
    await expect(composer).toHaveValue(/\n/u);
    expect(calls).toEqual([]);
    checks.push("Nested history Escape restores focus; modal traps Tab; IME Enter and Shift+Enter send no request");

    // Transport is held then aborted, never replaced by a fabricated Connected response.
    let release: () => void = () => {};
    const held = new Promise<void>(resolve => { release = resolve; });
    let pending = 0;
    let done: () => void = () => {};
    const finished = new Promise<void>(resolve => { done = resolve; });
    await page.route("**/ai/advisories", async route => { pending++; await held; try { await route.abort("aborted"); } catch { /* Stop already cancelled the routed request. */ } finally { done(); } });
    await composer.fill("Kiểm tra dừng yêu cầu trên hồ sơ này.");
    await composer.press("Enter");
    await expect(ai.getByRole("button", { name: "Dừng", exact: true })).toBeVisible();
    await composer.fill("Kiểm tra dừng yêu cầu trên hồ sơ này.");
    await composer.press("Enter");
    await expect.poll(() => pending).toBe(1);
    await page.screenshot({ path: path.join(directory, "ai-after-loading.png") });
    await ai.getByRole("button", { name: "Dừng", exact: true }).click();
    release();
    await finished;
    await page.unroute("**/ai/advisories");
    await expect(ai.locator('[data-ai-message-role="assistant"]')).toHaveCount(0);
    checks.push("Loading, duplicate-send lock, Stop abort and absence of a late assistant response PASS (transport cancellation)");

    await ai.getByRole("button", { name: "Trò chuyện mới", exact: true }).click();
    await expect(ai.locator('[data-ai-empty="focused"]')).toBeVisible();
    await page.route("**/ai/advisories", route => route.abort("failed"));
    const question = "Tóm tắt cơ hội đang chọn và gợi ý bước chăm sóc tiếp theo.";
    await composer.fill(question);
    await composer.press("Enter");
    const retry = ai.getByRole("button", { name: "Thử lại", exact: true });
    await expect(retry).toBeVisible();
    await expect(ai.locator('[data-ai-message-role="user"]')).toHaveCount(1);
    await page.screenshot({ path: path.join(directory, "ai-after-transport-error.png") });
    await page.unroute("**/ai/advisories");
    const dealRoute = page.url().split("#")[1] ?? "";
    const dealId = dealRoute.split("/").at(-1);
    const realResponse = page.waitForResponse(response => new URL(response.url()).pathname === "/ai/advisories" && response.request().method() === "POST", { timeout: 135_000 });
    await retry.click();
    const response = await realResponse;
    const body = await response.json();
    expect(response.request().postDataJSON().contextReferences).toEqual([{ type: "deal", id: dealId }]);
    outcomes.push({ entity: "deal", status: response.status(), code: body.code, provider: body.provider?.name, evidence: body.evidence?.length });
    await expect(ai.getByRole("button", { name: "Dừng", exact: true })).toHaveCount(0, { timeout: 10_000 });
    await expect(ai.locator('[data-ai-message-role="user"]')).toHaveCount(1);
    if (response.ok()) {
      expect(body.evidence.length).toBeGreaterThan(0);
      await expect(ai.locator('[data-ai-status="success"]')).toBeVisible();
      await expect(ai.locator('[data-ai-action-intent="NAVIGATE"]').first()).toBeVisible();
      await ai.locator('[data-ai-action-intent="NAVIGATE"]').first().click();
      await expect(ai).toHaveCount(0);
      expect(page.url()).toContain("/w/unicore-demo-anh-duong/crm/");
      await open();
    } else {
      expect([403, 422, 429, 502, 503, 504]).toContain(response.status());
      await expect(ai.locator('[data-ai-message-role="assistant"]')).toHaveCount(0);
      await expect(ai.locator("[role=alert]")).toBeVisible();
    }
    await page.screenshot({ path: path.join(directory, "ai-after-real-deal-result.png") });
    checks.push("Retry adds no duplicate user message; real Backend Deal advisory outcome recorded without fallback");

    const search = ai.getByRole("textbox", { name: "Tìm lịch sử", exact: true });
    await search.fill("không có hội thoại phù hợp zzz");
    await expect(ai.getByText("Không tìm thấy cuộc trò chuyện.", { exact: true }).first()).toBeVisible();
    await search.fill("");
    await ai.getByRole("button", { name: "Xóa hội thoại", exact: true }).click();
    const confirmation = page.getByRole("dialog", { name: "Xóa cuộc trò chuyện?", exact: true });
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole("button", { name: "Hủy", exact: true }).click();
    await expect(ai.locator('[data-ai-message-role="user"]')).toHaveCount(1);
    await ai.getByRole("button", { name: "Xóa hội thoại", exact: true }).click();
    await confirmation.getByRole("button", { name: "Xóa", exact: true }).click();
    await expect(confirmation).toHaveCount(0);
    await expect(ai.getByText(question, { exact: true })).toHaveCount(0);
    checks.push("Search, deletion confirmation, cancel and confirmed removal affect session conversation only");
    await close();
    await page.goto("/#/w/unicore-demo-anh-duong/crm/contacts");
    const contact = page.locator("tbody tr").first().locator("span.cursor-pointer").first();
    await expect(contact).toBeVisible();
    await contact.click();
    await page.waitForURL(/\/crm\/contacts\/[^/?]+$/u);
    const contactRoute = page.url().split("#")[1] ?? "";
    await open();
    await expect(ai.locator("[data-ai-context]")).toContainText("Liên hệ");
    await ai.getByRole("button", { name: "Trò chuyện mới", exact: true }).click();
    const contactId = page.url().split("/").at(-1);
    const contactResponse = page.waitForResponse(result => new URL(result.url()).pathname === "/ai/advisories" && result.request().method() === "POST", { timeout: 135_000 });
    await ai.locator("textarea").fill("Tóm tắt liên hệ này và gợi ý nội dung trao đổi tiếp theo.");
    await ai.getByRole("button", { name: "Gửi", exact: true }).click();
    const contactResult = await contactResponse;
    const contactBody = await contactResult.json();
    expect(contactResult.request().postDataJSON().contextReferences).toEqual([{ type: "contact", id: contactId }]);
    outcomes.push({ entity: "contact", status: contactResult.status(), code: contactBody.code, provider: contactBody.provider?.name, evidence: contactBody.evidence?.length });
    await expect(ai.getByRole("button", { name: "Dừng", exact: true })).toHaveCount(0, { timeout: 10_000 });
    await page.screenshot({ path: path.join(directory, "ai-after-real-contact-result.png") });
    // Retire actual Backend responses across conversation, record and workspace changes.
    // The API response is forwarded unchanged; no synthetic advisory is ever supplied.
    const retireResponse = async (change: () => Promise<void>, label: string) => {
      let markHeld: () => void = () => {};
      let releaseHeld: () => void = () => {};
      let markDone: () => void = () => {};
      const held = new Promise<void>(resolve => { markHeld = resolve; });
      const release = new Promise<void>(resolve => { releaseHeld = resolve; });
      const finished = new Promise<void>(resolve => { markDone = resolve; });
      await page.route("**/ai/advisories", async route => {
        const genuine = await route.fetch();
        markHeld();
        await release;
        try { await route.fulfill({ response: genuine }); } catch { /* The retired context already aborted its consumer. */ } finally { markDone(); }
      });
      try {
        await ai.locator("textarea").fill(`Tóm tắt hồ sơ này trước khi ${label}.`);
        await ai.getByRole("button", { name: "Gửi", exact: true }).click();
        await held;
        await expect(ai.getByRole("button", { name: "Dừng", exact: true })).toBeVisible();
        await change();
        releaseHeld();
        await finished;
        await expect(ai.locator('[data-ai-message-role="assistant"]')).toHaveCount(0);
        await expect(ai.locator("[role=alert]")).toHaveCount(0);
      } finally { releaseHeld(); await page.unroute("**/ai/advisories"); }
    };
    await retireResponse(async () => {
      await ai.getByRole("button", { name: "Trò chuyện mới", exact: true }).click();
      await expect(ai.locator('[data-ai-empty="focused"]')).toBeVisible();
    }, "đổi cuộc trò chuyện");
    await retireResponse(async () => {
      await page.goto(`/#${dealRoute}`);
      await expect(ai.locator("[data-ai-context]")).toContainText("Cơ hội");
      await expect(ai.locator('[data-ai-status="idle"]')).toBeVisible();
    }, "đổi hồ sơ");
    await retireResponse(async () => {
      await page.goto("/#/w/unicore-demo-anh-duong-control/crm/dashboard");
      await expect(page.locator('[data-dashboard-metric="pipeline"][data-state="READY"]')).toHaveAttribute("data-count", "0");
      if (await ai.count() === 0) await open();
      await expect(ai.locator("textarea")).toBeDisabled();
    }, "đổi workspace");
    checks.push("Delayed genuine Backend responses are retired after new conversation, record change and workspace change");
    await close();
    await page.goto("/#/w/unicore-demo-anh-duong-control/crm/dashboard");
    await expect(page.locator('[data-dashboard-metric="pipeline"][data-state="READY"]')).toHaveAttribute("data-count", "0");
    await open();
    await expect(ai.getByText(question, { exact: true })).toHaveCount(0);
    await expect(ai.getByText("Tóm tắt liên hệ này và gợi ý nội dung trao đổi tiếp theo.", { exact: true })).toHaveCount(0);
    await expect(ai.locator("textarea")).toBeDisabled();
    await close();
    await page.goto(`/#${dealRoute}`);
    await open();
    await expect(ai.locator("[data-ai-context]")).toContainText("Cơ hội");
    // A real hash route change keeps the shell mounted and must replace focused context.
    await page.goto(`/#${contactRoute}`);
    await expect(ai.locator("[data-ai-context]")).toContainText("Liên hệ");
    await expect(ai.locator('[data-ai-status="idle"]')).toBeVisible();
    await page.goto(`/#${dealRoute}`);
    await expect(ai.locator("[data-ai-context]")).toContainText("Cơ hội");
    await close();
    await page.reload();
    await open();
    await expect(ai.locator('[data-ai-message-role="user"]')).toHaveCount(0);
    checks.push("Contact uses Contact reference; control Workspace has no demo conversation; return resolves Deal and refresh clears ephemeral history");
    await close();
    await page.locator("#user-profile-dropdown").click();
    await page.getByRole("menuitem", { name: "Đăng xuất", exact: true }).click();
    await page.waitForURL(/#\/login$/u);
    await expect(ai).toHaveCount(0);
    await page.getByLabel("Email", { exact: true }).fill(process.env.UNICORECRM_TEST_EMAIL ?? "");
    await page.getByLabel("Mật khẩu", { exact: true }).fill(process.env.UNICORECRM_TEST_PASSWORD ?? "");
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await page.waitForURL(/#\/(?:select-workspace|w\/)/u);
    await page.goto(`/#${dealRoute}`);
    await open();
    await expect(ai.locator('[data-ai-message-role="user"]')).toHaveCount(0);
    await expect(ai.locator("[data-ai-context]")).toContainText("Cơ hội");
    await page.keyboard.press("Escape");
    await expect(ai).toHaveCount(0);
    await expect(page.locator("#floating-ai-assistant-btn")).toBeFocused();
    checks.push("Record change while open replaces context and status; logout/relogin clears history; Escape restores launcher focus");
    expect(calls.filter(call => call.path.includes("/configuration"))).toEqual([]);
    expect(calls.every(call => call.path === "/ai/advisories")).toBe(true);
  } else checks.push("Real Connected Dashboard and Deal detail baseline captured; no provider test or CRM write");
  } finally {
  await writeFile(path.join(directory, `ai-${phase}-checks.json`), JSON.stringify({ checks, calls, outcomes, visual, focusedRoute: page.url().split("#")[1] }, null, 2));
  }
}
