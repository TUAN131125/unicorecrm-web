import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateOpenApiResponse } from "../../src/platform/api/contracts/openApiRuntimeValidation";

const api = process.env.UNICORECRM_TEST_API_BASE_URL || "";
const workspace = process.env.UNICORECRM_TEST_WORKSPACE_KEY || "";
const directory = process.env.UNICORECRM_TEST_EVIDENCE_DIR || "";
async function login(page: Page, restricted = false) {
  await page.goto("/#/login");
  await page.getByLabel("Email", { exact: true }).fill(process.env[restricted ? "UNICORECRM_TEST_APPROVER_EMAIL" : "UNICORECRM_TEST_EMAIL"] || "");
  await page.getByLabel(/^(Mật khẩu|Password)$/u).fill(process.env[restricted ? "UNICORECRM_TEST_APPROVER_PASSWORD" : "UNICORECRM_TEST_PASSWORD"] || "");
  await page.getByRole("button", { name: /^(Đăng nhập|Sign in)$/u }).click();
  await page.waitForURL(/#\/(?:select-workspace|w\/)/u);
}
async function logout(page: Page) {
  await page.locator("#user-profile-dropdown").click();
  await page.getByRole("menuitem", { name: /^(Đăng xuất|Sign out)$/u }).click();
  await expect(page).toHaveURL(/#\/login/u);
}
function evidence(page: Page) {
  const responses: unknown[] = [], pending: Promise<void>[] = [], errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("response", response => {
    if (!response.url().startsWith(`${api}/quotes`)) return;
    pending.push((async () => { responses.push({ method: response.request().method(), path: new URL(response.url()).pathname,
      status: response.status(), correlationId: response.request().headers()["x-correlation-id"], body: await response.json().catch(() => ({ bodyUnavailableAfterNavigation: true })) }); })());
  });
  return { errors, async save(name: string) { await Promise.allSettled(pending); await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, name + ".json"), JSON.stringify({ errors, responses }, null, 2)); } };
}
async function openQuote(page: Page, id: string) {
  await page.goto(`/#/w/${workspace}/crm/quotes/${id}`);
  await expect(page.locator("#quote-detail-header")).toBeVisible();
  await expect(page.locator('[data-quote-lifecycle="panel"]')).toBeVisible();
}

test("@normal B4 revision opens a new Draft and preserves the source history", async ({ page }) => {
  const proof = evidence(page);
  const id = process.env.UNICORECRM_TEST_LOW_QUOTE_ID || "";
  try {
    await login(page); await openQuote(page, id);
    const panel = page.locator('[data-quote-lifecycle="panel"]');
    await panel.getByRole("button", { name: "Tạo phiên bản mới", exact: true }).click();
    const committed = page.waitForResponse(r => r.url() === `${api}/quotes/${id}/revise` && r.request().method() === "POST");
    await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
    const response = await committed; expect(response.status()).toBe(201);
    const body = await response.json();
    expect(validateOpenApiResponse("reviseQuoteCommand", body, 201)).toEqual({ valid: true, issues: [] });
    const next = body.result.quote;
    expect(next.id).not.toBe(id); expect(next.quoteRevision).toBe(2); expect(next.status).toBe("DRAFT");
    expect(next.resourceVersion).toBe(1); expect(next.revisionOfQuoteId).toBe(id);
    expect(next.deliveryHistory).toBeUndefined(); expect(next.customerDecisionHistory).toBeUndefined();
    expect(next.approvalContentFingerprint).toBeUndefined();
    await expect(page).toHaveURL(new RegExp(`/quotes/${next.id}/edit`, "u"));
    await expect(page.locator("#quote-builder-page")).toBeVisible();
    await page.getByLabel(/Tên báo giá|Tiêu đề báo giá|Quote title|Quotation title/u).first().fill("B4 browser edited revision");
    const saved = page.waitForResponse(r => r.url() === `${api}/quotes/${next.id}/update-draft` && r.request().method() === "POST");
    await page.getByRole("button", { name: /^(Lưu nháp|Lưu bản nháp|Save draft)$/iu }).click();
    const update = await saved; expect(update.status()).toBe(200);
    expect((await update.json()).result.quote.quoteRevision).toBe(2);
    await openQuote(page, id);
    await expect(page.locator("#quote-detail-header")).toContainText("Đã gửi");
    await expect(page.locator('[data-quote-customer-response="panel"]').getByText("Chưa xác minh", { exact: true })).toHaveCount(1);
    await expect(page.locator('[data-quote-revision-chain="true"] li')).toHaveCount(2);
    await expect(panel.getByRole("button", { name: "Tạo phiên bản mới", exact: true })).toBeDisabled();
    await page.reload(); await expect(page.locator('[data-quote-revision-chain="true"] li')).toHaveCount(2);
    await logout(page); await login(page); await openQuote(page, next.id);
    await expect(page.locator("#quote-detail-header")).toContainText("B4 browser edited revision");
    await expect(page.locator('[data-quote-revision-chain="true"] li')).toHaveCount(2);
    await page.screenshot({ path: path.join(directory, "revision-chain.png"), fullPage: true, animations: "disabled" });
    expect(proof.errors).toEqual([]);
  } finally { await proof.save("revision-evidence"); }
});

test("@normal B4 archive retains rejected evidence and appears in archived search", async ({ page }) => {
  const proof = evidence(page); const id = process.env.UNICORECRM_TEST_ARCHIVE_QUOTE_ID || "";
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page); await openQuote(page, id);
    const panel = page.locator('[data-quote-lifecycle="panel"]');
    await panel.getByRole("button", { name: "Lưu trữ Báo giá", exact: true }).click();
    await expect(page.getByRole("button", { name: "Xác nhận", exact: true })).toBeDisabled();
    await page.locator("#quote-lifecycle-reason").fill("Browser B4 archive reason");
    const committed = page.waitForResponse(r => r.url() === `${api}/quotes/${id}/archive` && r.request().method() === "POST");
    await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
    const response = await committed; expect(response.status()).toBe(200);
    const body = await response.json();
    expect(validateOpenApiResponse("archiveQuoteCommand", body, 200)).toEqual({ valid: true, issues: [] });
    expect(body.result.quote.status).toBe("REJECTED");
    expect(body.result.quote.customerDecisionHistory).toHaveLength(2);
    expect(body.result.quote.deliveryHistory).toHaveLength(1);
    await expect(panel.locator('[data-quote-archived="true"]')).toBeVisible();
    await page.screenshot({ path: path.join(directory, "archived-mobile.png"), fullPage: true, animations: "disabled" });
    await expect(panel.getByRole("button", { name: "Tạo phiên bản mới", exact: true })).toBeDisabled();
    await page.reload(); await expect(panel.locator('[data-quote-archived="true"]')).toBeVisible();
    await logout(page); await login(page); await openQuote(page, id);
    await expect(page.locator('[data-quote-customer-response="panel"]').getByText("Chưa xác minh", { exact: true })).toHaveCount(2);
    await page.goto(`/#/w/${workspace}/crm/quotes`);
    await page.getByRole("combobox", { name: "Phạm vi lưu trữ", exact: true }).selectOption("ARCHIVED");
    await page.getByPlaceholder("Tìm mã hoặc tên báo giá").fill(body.result.quote.quoteNumber);
    await expect(page.getByRole("article").filter({ hasText: body.result.quote.quoteNumber })).toBeVisible();
    await page.screenshot({ path: path.join(directory, "archived-search.png"), fullPage: true, animations: "disabled" });
    await page.goto(`/#/w/${workspace}/crm/quotes/${id}/edit`);
    await expect(page.locator("#quote-builder-not-draft-blocked")).toBeVisible();
    await expect(page.getByRole("button", { name: /^(Lưu nháp|Lưu bản nháp|Save draft)$/iu })).toHaveCount(0);
    expect(proof.errors).toEqual([]);
  } finally { await proof.save("archive-evidence"); }
});

test("@normal B4 restricted actor and foreign Workspace have no lifecycle authority", async ({ page }) => {
  await login(page, true); await openQuote(page, process.env.UNICORECRM_TEST_RESTRICTED_QUOTE_ID || "");
  const panel = page.locator('[data-quote-lifecycle="panel"]');
  for (const name of ["Tạo phiên bản mới", "Lưu trạng thái hết hạn", "Lưu trữ Báo giá"]) await expect(panel.getByRole("button", { name, exact: true })).toBeDisabled();
  await page.goto("/#/w/unicore-quote-approval-isolation/crm/quotes");
  await expect(page.getByRole("heading", { name: /Không thể mở không gian làm việc|Unable to open/u })).toBeVisible();
});

test("@expiry B4 overdue status remains SENT until explicit expiration, then can archive", async ({ page }) => {
  const proof = evidence(page); const id = process.env.UNICORECRM_TEST_EXPIRY_QUOTE_ID || "";
  try {
    await login(page); await openQuote(page, id);
    const panel = page.locator('[data-quote-lifecycle="panel"]');
    await expect(panel.locator('[data-quote-validity="OVERDUE"]')).toBeVisible();
    await expect(panel).toContainText("Trạng thái đã lưu: SENT");
    await panel.getByRole("button", { name: "Lưu trạng thái hết hạn", exact: true }).click();
    const committed = page.waitForResponse(r => r.url() === `${api}/quotes/${id}/expire` && r.request().method() === "POST");
    await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
    const response = await committed; expect(response.status()).toBe(200);
    const body = await response.json(); expect(body.result.quote.status).toBe("EXPIRED");
    expect(validateOpenApiResponse("expireQuoteCommand", body, 200)).toEqual({ valid: true, issues: [] });
    await expect(panel).toContainText("Trạng thái đã lưu: EXPIRED");
    await page.reload(); await expect(panel).toContainText("Trạng thái đã lưu: EXPIRED");
    await logout(page); await login(page); await openQuote(page, id);
    await expect(panel).toContainText("Trạng thái đã lưu: EXPIRED");
    await panel.getByRole("button", { name: "Lưu trữ Báo giá", exact: true }).click();
    await page.locator("#quote-lifecycle-reason").fill("Browser B4 expired retention");
    const archived = page.waitForResponse(r => r.url() === `${api}/quotes/${id}/archive` && r.request().method() === "POST");
    await page.getByRole("button", { name: "Xác nhận", exact: true }).click(); expect((await archived).status()).toBe(200);
    await expect(panel.locator('[data-quote-archived="true"]')).toBeVisible();
    await page.screenshot({ path: path.join(directory, "expired-archived.png"), fullPage: true, animations: "disabled" });
    expect(proof.errors).toEqual([]);
  } finally { await proof.save("expiration-evidence"); }
});
