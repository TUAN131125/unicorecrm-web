import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateOpenApiResponse } from "../../src/platform/api/contracts/openApiRuntimeValidation";

const api = process.env.UNICORECRM_TEST_API_BASE_URL || "";
const workspace = process.env.UNICORECRM_TEST_WORKSPACE_KEY || "";
const quote = process.env.UNICORECRM_TEST_LOW_QUOTE_ID || "";
const directory = process.env.UNICORECRM_TEST_EVIDENCE_DIR || "";
async function login(page: Page, restricted = false) {
  await page.goto("/#/login");
  await page.getByLabel("Email", { exact: true }).fill(process.env[restricted ? "UNICORECRM_TEST_APPROVER_EMAIL" : "UNICORECRM_TEST_EMAIL"] || "");
  await page.getByLabel(/^(Mật khẩu|Password)$/u).fill(process.env[restricted ? "UNICORECRM_TEST_APPROVER_PASSWORD" : "UNICORECRM_TEST_PASSWORD"] || "");
  await page.getByRole("button", { name: /^(Đăng nhập|Sign in)$/u }).click();
  await page.waitForURL(/#\/(?:select-workspace|w\/)/u);
}
test("B3 unverified report and rejection persist across refresh and login", async ({ page }) => {
  await mkdir(directory, { recursive: true });
  const errors: string[] = [], responses: unknown[] = [], pending: Promise<void>[] = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("response", r => {
    if (!r.url().startsWith(`${api}/quotes`)) return;
    pending.push((async () => { responses.push({ path: new URL(r.url()).pathname, status: r.status(), method: r.request().method(), correlationId: r.request().headers()["x-correlation-id"], body: await r.json().catch(() => ({ bodyUnavailableAfterNavigation: true })) }); })());
  });
  try {
    await login(page);
    await page.goto(`/#/w/${workspace}/crm/quotes/${quote}`);
    const panel = page.locator('[data-quote-customer-response="panel"]');
    await expect(panel).toBeVisible();
    await panel.getByRole("button", { name: "Ghi nhận khách hàng thông báo đồng ý", exact: true }).click();
    await panel.getByLabel("Nội dung nhân viên ghi nhận").fill("Browser synthetic: employee reports customer agreement");
    const sent = page.waitForResponse(r => r.url() === `${api}/quotes/${quote}/customer-decisions` && r.request().method() === "POST");
    await panel.getByRole("button", { name: "Lưu ghi nhận", exact: true }).click();
    const response = await sent;
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(validateOpenApiResponse("recordQuoteCustomerDecisionCommand", body, 200)).toEqual({ valid: true, issues: [] });
    expect(body.result.quote.status).toBe("SENT");
    expect(body.result.quote.customerDecisionHistory[0].verificationStatus).toBe("UNVERIFIED");
    await expect(panel.getByText("Chưa xác minh", { exact: true })).toHaveCount(1);
    await expect(page.locator("#quote-detail-header")).toContainText("Đã gửi");
    await Promise.allSettled(pending);
    await page.reload();
    await expect(panel.getByText("Chưa xác minh", { exact: true })).toHaveCount(1);
    await page.locator("#user-profile-dropdown").click();
    await page.getByRole("menuitem", { name: /^(Đăng xuất|Sign out)$/u }).click();
    await expect(page).toHaveURL(/#\/login/u);
    await login(page);
    await page.goto(`/#/w/${workspace}/crm/quotes/${quote}`);
    await expect(panel.getByText("Chưa xác minh", { exact: true })).toHaveCount(1);
    await panel.getByRole("button", { name: "Ghi nhận từ chối Báo giá", exact: true }).click();
    await expect(panel.getByRole("button", { name: "Lưu ghi nhận", exact: true })).toBeDisabled();
    await panel.getByLabel("Lý do từ chối (bắt buộc)").fill("Browser synthetic: employee reports customer rejection");
    const rejected = page.waitForResponse(r => r.url() === `${api}/quotes/${quote}/reject` && r.request().method() === "POST");
    await panel.getByRole("button", { name: "Lưu ghi nhận", exact: true }).click();
    const result = await rejected; expect(result.status()).toBe(200);
    const rejection = await result.json();
    expect(validateOpenApiResponse("rejectQuoteCommand", rejection, 200)).toEqual({ valid: true, issues: [] });
    expect(rejection.result.quote.status).toBe("REJECTED");
    expect(rejection.result.quote.customerDecisionHistory).toHaveLength(2);
    expect(rejection.result.quote.deliveryHistory).toHaveLength(1);
    await expect(panel.getByText("Chưa xác minh", { exact: true })).toHaveCount(2);
    await expect(panel.getByRole("button", { name: "Ghi nhận khách hàng thông báo đồng ý", exact: true })).toBeDisabled();
    await Promise.allSettled(pending);
    await page.reload(); await expect(panel.getByText("Chưa xác minh", { exact: true })).toHaveCount(2);
    await page.screenshot({ path: path.join(directory, "customer-response-history.png"), fullPage: true, animations: "disabled" });
    expect(errors).toEqual([]);
  } finally {
    await Promise.allSettled(pending);
    await writeFile(path.join(directory, "browser-evidence.json"), JSON.stringify({ errors, responses }, null, 2));
  }
});
test("B3 restricted actor cannot record customer response", async ({ page }) => {
  await login(page, true);
  await page.goto(`/#/w/${workspace}/crm/quotes/${process.env.UNICORECRM_TEST_RESTRICTED_QUOTE_ID}`);
  const panel = page.locator('[data-quote-customer-response="panel"]');
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("button", { name: "Ghi nhận khách hàng thông báo đồng ý", exact: true })).toBeDisabled();
  await expect(panel.getByRole("button", { name: "Ghi nhận từ chối Báo giá", exact: true })).toBeDisabled();
});

test("B3 dirty response cancellation requires explicit discard", async ({ page }) => {
  await login(page);
  await page.goto(`/#/w/${workspace}/crm/quotes/${process.env.UNICORECRM_TEST_RESTRICTED_QUOTE_ID}`);
  const panel = page.locator('[data-quote-customer-response="panel"]');
  await panel.getByRole("button", { name: "Ghi nhận khách hàng thông báo đồng ý", exact: true }).click();
  await panel.getByLabel("Nội dung nhân viên ghi nhận").fill("Unsaved synthetic report");
  await expect(panel.getByRole("button", { name: "Ghi nhận từ chối Báo giá", exact: true })).toBeDisabled();
  await panel.getByRole("button", { name: "Hủy", exact: true }).click();
  await expect(page.getByText("Bỏ thay đổi chưa lưu?", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Tiếp tục chỉnh sửa", exact: true }).click();
  await expect(panel.getByLabel("Nội dung nhân viên ghi nhận")).toHaveValue("Unsaved synthetic report");
  await panel.getByRole("button", { name: "Hủy", exact: true }).click();
  await page.getByRole("button", { name: "Bỏ thay đổi", exact: true }).click();
  await expect(panel.getByLabel("Nội dung nhân viên ghi nhận")).toHaveCount(0);
  await page.goto("/#/w/unicore-quote-approval-isolation/crm/quotes");
  await expect(page.getByRole("heading", { name: /Không thể mở không gian làm việc|Unable to open/u })).toBeVisible();
  await page.goto(`/#/w/${workspace}/crm/quotes/${process.env.UNICORECRM_TEST_RESTRICTED_QUOTE_ID}`);
  await expect(page.locator('[data-quote-customer-response="panel"]').getByLabel("Nội dung nhân viên ghi nhận")).toHaveCount(0);
});
