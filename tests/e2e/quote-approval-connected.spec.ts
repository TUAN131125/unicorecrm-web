import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateOpenApiResponse } from "../../src/platform/api/contracts/openApiRuntimeValidation";

const api = process.env.UNICORECRM_TEST_API_BASE_URL || "";
const workspace = process.env.UNICORECRM_TEST_WORKSPACE_KEY || "";
const low = process.env.UNICORECRM_TEST_LOW_QUOTE_ID || "";
const high = process.env.UNICORECRM_TEST_HIGH_QUOTE_ID || "";
const directory = process.env.UNICORECRM_TEST_EVIDENCE_DIR || "";
const synthetic = process.env.UNICORECRM_TEST_SYNTHETIC === "1";
async function login(page: Page, approver = false) {
  await page.goto("/#/login");
  await page.getByLabel("Email", { exact: true }).fill((approver ? process.env.UNICORECRM_TEST_APPROVER_EMAIL : process.env.UNICORECRM_TEST_EMAIL) || "");
  await page.getByLabel(/^(Mật khẩu|Password)$/u).fill((approver ? process.env.UNICORECRM_TEST_APPROVER_PASSWORD : process.env.UNICORECRM_TEST_PASSWORD) || "");
  await page.getByRole("button", { name: /^(Đăng nhập|Sign in)$/u }).click();
  await page.waitForURL(/#\/(?:select-workspace|w\/)/u);
}
async function logout(page: Page) {
  await page.locator("#user-profile-dropdown").click();
  await page.getByRole("menuitem", { name: /^(Đăng xuất|Sign out)$/u }).click();
  await expect(page).toHaveURL(/#\/login/u);
}
test("B1 connected authoritative approval survives refresh, login and commercial change", async ({ page }) => {
  await mkdir(directory, { recursive: true });
  const responses: unknown[] = [];
  const pending: Promise<void>[] = [];
  const errors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (message.type() !== "error") return;
    let text = message.text();
    for (const secret of [process.env.UNICORECRM_TEST_PASSWORD, process.env.UNICORECRM_TEST_APPROVER_PASSWORD, process.env.UNICORECRM_TEST_APPROVER2_PASSWORD]) if (secret) text = text.replaceAll(secret, "[redacted]");
    consoleErrors.push(text);
  });
  page.on("response", response => {
    if (!response.url().startsWith(`${api}/quotes`)) return;
    pending.push((async () => { responses.push({ method: response.request().method(), path: new URL(response.url()).pathname,
      correlationId: response.request().headers()["x-correlation-id"], status: response.status(), body: await response.json() }); })());
  });
  let status = "FAIL";
  try {
    await login(page);
    await page.goto(`/#/w/${workspace}/crm/quotes/${low}`);
    await expect(page.locator("#quote-detail-header")).toBeVisible();
    await expect(page.getByText("Chưa đánh giá duyệt", { exact: true }).first()).toBeVisible();
    const assessed = page.waitForResponse(response => response.url() === `${api}/quotes/${low}/request-approval` && response.request().method() === "POST");
    await page.getByRole("button", { name: /^(Gửi duyệt|Request approval)$/u }).first().click();
    const response = await assessed;
    expect(response.status()).toBe(200);
    expect(validateOpenApiResponse("requestQuoteApprovalCommand", await response.json(), 200)).toEqual({ valid: true, issues: [] });
    await expect(page.getByText("Không cần duyệt", { exact: true }).first()).toBeVisible();
    await page.reload();
    await expect(page.getByText("Không cần duyệt", { exact: true }).first()).toBeVisible();
    await logout(page);
    await login(page);
    await page.goto(`/#/w/${workspace}/crm/quotes/${low}`);
    await expect(page.getByText("Không cần duyệt", { exact: true }).first()).toBeVisible();
    await page.screenshot({ path: path.join(directory, "assessed-after-login.png"), fullPage: true });
    await page.goto(`/#/w/${workspace}/crm/quotes/${high}`);
    await expect(page.locator("#quote-detail-header")).toBeVisible();
    const blocked = page.waitForResponse(result => result.url() === `${api}/quotes/${high}/request-approval` && result.request().method() === "POST");
    await page.getByRole("button", { name: /^(Gửi duyệt|Request approval)$/u }).first().click();
    const requested = await blocked;
    if (synthetic) {
      expect(requested.status()).toBe(200);
      expect(validateOpenApiResponse("requestQuoteApprovalCommand", await requested.json(), 200)).toEqual({ valid: true, issues: [] });
      await expect(page.getByText("Chờ duyệt", { exact: true }).first()).toBeVisible();
      const selfDenied = page.waitForResponse(result => result.url() === `${api}/quotes/${high}/approve` && result.request().method() === "POST");
      await page.getByRole("button", { name: /^(Phê duyệt|Approve)$/u }).first().click();
      expect((await selfDenied).status()).toBe(403);
      await expect(page.getByText(/Người tạo và người gửi yêu cầu không được tự phê duyệt|creator and requester cannot/u)).toBeVisible();
      await logout(page);
      await login(page, true);
      await page.goto(`/#/w/${workspace}/crm/quotes/${high}`);
      await expect(page.getByText("Chờ duyệt", { exact: true }).first()).toBeVisible();
      const approved = page.waitForResponse(result => result.url() === `${api}/quotes/${high}/approve` && result.request().method() === "POST");
      await page.getByRole("button", { name: /^(Phê duyệt|Approve)$/u }).first().click();
      const decision = await approved;
      expect(decision.status()).toBe(200);
      expect(validateOpenApiResponse("approveQuoteCommand", await decision.json(), 200)).toEqual({ valid: true, issues: [] });
      await expect(page.getByText("Đã duyệt", { exact: true }).first()).toBeVisible();
      await page.reload();
      await expect(page.getByText("Đã duyệt", { exact: true }).first()).toBeVisible();
      await page.screenshot({ path: path.join(directory, "approved-after-refresh.png"), fullPage: true });
      await logout(page);
      await login(page);
      await page.goto(`/#/w/${workspace}/crm/quotes/${high}`);
      await expect(page.getByText("Đã duyệt", { exact: true }).first()).toBeVisible();
      await page.goto(`/#/w/${workspace}/crm/quotes/${high}/edit`);
      await expect(page.locator("#quote-builder-page")).toBeVisible();
      await page.getByLabel(/Tên báo giá|Tiêu đề báo giá|Quote title|Quotation title/u).first().fill(`B1 commercial edit ${Date.now()}`);
      const replaced = page.waitForResponse(result => result.url() === `${api}/quotes/${high}/update-draft` && result.request().method() === "POST");
      await page.getByRole("button", { name: /^(Lưu nháp|Lưu bản nháp|Save draft)$/iu }).click();
      expect((await replaced).status()).toBe(200);
      await expect(page.getByText("Chưa đánh giá duyệt", { exact: true }).first()).toBeVisible();
      await page.reload();
      await expect(page.getByText("Chưa đánh giá duyệt", { exact: true }).first()).toBeVisible();
      await page.screenshot({ path: path.join(directory, "approval-invalidated.png"), fullPage: true });
    } else {
      expect(requested.status()).toBe(409);
      // Runtime response indexes cover application/json successes only; assert the exact
      // declared ProblemDetails shape here and validate all evidence against OpenAPI offline.
      expect(await requested.json()).toEqual({ type: "urn:unicore:error:quote_approval_required", title: expect.any(String),
        status: 409, code: "QUOTE_APPROVAL_REQUIRED", retryable: false, correlationId: expect.any(String), detail: "NO_ELIGIBLE_APPROVER" });
      await expect(page.getByText(/Workspace chưa có người phê duyệt độc lập đủ quyền|no eligible independent approver/u)).toBeVisible();
      await page.screenshot({ path: path.join(directory, "no-eligible-approver.png"), fullPage: true });
    }
    expect(errors).toEqual([]);
    status = "PASS_MEASURED_CASES";
  } finally {
    await Promise.all(pending);
    await writeFile(path.join(directory, "result.json"), JSON.stringify({ status, low, high, errors, consoleErrors,
      positiveIndependentApproval: synthetic && status === "PASS_MEASURED_CASES" ? "PASS" : "BLOCKED_ENVIRONMENT_NO_SECOND_APPROVER", responses }, null, 2));
  }
});
