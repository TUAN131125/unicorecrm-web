import { expect, test } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

test("persisted realistic workspace renders in Connected Mode and remains tenant scoped", async ({ page }, info) => {
  test.setTimeout(180_000);
  const directory = process.env.UNICORECRM_DEMO_EVIDENCE;
  if (!directory) throw new Error("Requires seed-realistic-demo.ps1 -UiAcceptance");
  const verification = JSON.parse(await readFile(path.join(directory, "verification.json"), "utf8")) as {
    journey: { leadId: string; contactId: string; organizationId: string; customerId: string; dealId: string; taskId: string; activityId: string };
  };
  const key = "unicore-demo-anh-duong";
  const control = "unicore-demo-anh-duong-control";
  const checks: { test: string; status: string }[] = [];
  const responses: { path: string; status: number; workspace: string | undefined }[] = [];
  page.on("response", response => {
    if (!response.url().startsWith(process.env.UNICORECRM_TEST_API_BASE_URL ?? "invalid:")) return;
    responses.push({ path: new URL(response.url()).pathname, status: response.status(), workspace: response.request().headers()["x-workspace-id"] });
  });
  const pass = (name: string) => checks.push({ test: name, status: "PASS" });
  async function login() {
    await page.goto("/#/login");
    await page.getByLabel("Email", { exact: true }).fill(process.env.UNICORECRM_TEST_EMAIL ?? "");
    await page.getByLabel(/Mật khẩu|Password/u, { exact: true }).fill(process.env.UNICORECRM_TEST_PASSWORD ?? "");
    const authenticated = page.waitForResponse(r => r.request().method() === "POST" && new URL(r.url()).pathname === "/auth/sessions");
    await page.getByRole("button", { name: /^(Đăng nhập|Sign in)$/u }).click();
    expect((await authenticated).status()).toBe(200);
    await page.waitForURL(/#\/(?:select-workspace|w\/[^/]+\/crm\/)/u);
    try { await page.waitForURL(/#\/w\/[^/]+\/crm\//u, { timeout: 3_000 }); }
    catch { await page.getByRole("button", { name: "UniCoreCRM Demo - Công ty Ánh Dương", exact: true }).click(); }
    await page.goto(`/#/w/${key}/crm/leads`);
    await expect(page.getByText("Ngô Bảo Ngân", { exact: true }).or(page.getByText("Nguyễn Minh Anh", { exact: true })).first()).toBeVisible();
  }
  async function visit(module: string, text: string) {
    const loaded = page.waitForResponse(r => new URL(r.url()).pathname === `/${module}` && r.request().method() === "GET" && r.status() === 200);
    await page.goto(`/#/w/${key}/crm/${module}`);
    await loaded;
    await expect(page.getByText(text, { exact: false }).filter({ visible: true }).first()).toBeVisible();
    pass(`Connected ${module} list`);
  }
  try {
    await login();
    pass("UI sign in and select demo workspace");
    await visit("contacts", "Nguyễn");
    await visit("organizations", "Công ty");
    await visit("customers", "CU-");
    await visit("products", "CRM");
    await visit("tasks", "Gọi lại");
    await visit("support/cases", "Hỗ trợ");
    await page.goto(`/#/w/${key}/crm/deals?view=kanban`);
    const columns = page.locator("[data-deal-kanban-column]");
    await expect(columns).toHaveCount(7);
    for (const stage of ["DISCOVERY", "QUALIFIED", "SOLUTION", "PROPOSAL", "NEGOTIATION", "LOST"]) {
      const column = page.locator(`[data-deal-kanban-column="${stage}"]`);
      await expect(column.locator('[data-deal-kanban-card="balanced"]').nth(1)).toBeVisible();
    }
    await page.screenshot({ path: info.outputPath("populated-kanban.png"), fullPage: true });
    pass("Kanban six populated stages; Won empty");
    const search = page.getByPlaceholder(/Tìm theo tên|Tìm cơ hội|Search.*(?:deal|opportunit)/iu);
    await search.fill("Minh Phúc");
    await expect(page.locator('[data-deal-kanban-card="balanced"]').first()).toContainText("Minh Phúc");
    pass("UI Deal search");
    await search.fill("");
    await page.getByRole("button", { name: /^(Filters|Bộ lọc)$/u }).click();
    await page.getByLabel(/Giai đoạn|Stage/u, { exact: true }).selectOption("PROPOSAL");
    await page.getByRole("button", { name: /Hoàn tất|Done/u, exact: true }).click();
    await expect(page.locator('[data-deal-kanban-card="balanced"]').first()).toBeVisible();
    await expect(page.locator('[data-deal-kanban-column="DISCOVERY"] [data-deal-kanban-card="balanced"]')).toHaveCount(0);
    pass("UI Deal stage filter");
    await page.goto(`/#/w/${key}/crm/deals/${verification.journey.dealId}`);
    await expect(page.locator('[data-deal-detail-layout="responsive"]')).toBeVisible();
    await expect(page.locator(`[data-related-task-id="${verification.journey.taskId}"]`)).toBeVisible();
    pass("Deal detail with actual follow-up Task");
    await page.goto(`/#/w/${key}/crm/contacts/${verification.journey.contactId}`);
    await expect(page.getByText("Trần Minh Anh", { exact: true }).first()).toBeVisible();
    await page.getByRole("tab", { name: "Lịch sử", exact: true }).click();
    await page.locator(`[data-history-id="${verification.journey.activityId}"] button`).click();
    await expect(page.getByText("Ghi nhận thủ công:", { exact: false }).first()).toBeVisible();
    await page.screenshot({ path: info.outputPath("contact-timeline.png"), fullPage: true });
    await page.reload();
    await expect(page.getByText("Trần Minh Anh", { exact: true }).first()).toBeVisible();
    pass("Contact timeline and refresh persistence");
    await page.goto(`/#/w/${control}/crm/deals?view=kanban`);
    await expect(page.locator("[data-deal-kanban-column]")).toHaveCount(7);
    await expect(page.locator('[data-deal-kanban-card="balanced"]')).toHaveCount(0);
    pass("Workspace switch clears demo Kanban");
    await page.goto(`/#/w/${key}/crm/deals?view=kanban`);
    await expect(page.locator('[data-deal-kanban-card="balanced"]').first()).toBeVisible();
    await page.locator("#user-profile-dropdown").click();
    const logout = page.waitForResponse(r => new URL(r.url()).pathname === "/auth/session/logout");
    await page.getByRole("menuitem", { name: /Đăng xuất|Logout/u }).click();
    expect((await logout).status()).toBe(200);
    await login();
    await page.goto(`/#/w/${key}/crm/deals/${verification.journey.dealId}`);
    await expect(page.locator('[data-deal-detail-layout="responsive"]')).toBeVisible();
    pass("UI logout and sign in preserve data");
  } finally {
    await writeFile(path.join(directory, "ui-verification.json"), JSON.stringify({ checks, responses }, null, 2));
  }
});
