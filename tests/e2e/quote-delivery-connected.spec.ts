import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateOpenApiResponse } from "../../src/platform/api/contracts/openApiRuntimeValidation";

const api = process.env.UNICORECRM_TEST_API_BASE_URL || "";
const workspace = process.env.UNICORECRM_TEST_WORKSPACE_KEY || "";
const quote = process.env.UNICORECRM_TEST_LOW_QUOTE_ID || "";
const directory = process.env.UNICORECRM_TEST_EVIDENCE_DIR || "";
let linkedResponses: unknown[] = [];
const linkedPending: Promise<void>[] = [];
test.afterEach(async ({}, info) => {
  if (!info.title.includes("linked Deal")) return;
  await Promise.allSettled(linkedPending);
  await writeFile(path.join(directory, "linked-result.json"), JSON.stringify({ status: info.status, responses: linkedResponses }, null, 2));
});
async function login(page: Page) {
  await page.goto("/#/login");
  await page.getByLabel("Email", { exact: true }).fill(process.env.UNICORECRM_TEST_EMAIL || "");
  await page.getByLabel(/^(Mật khẩu|Password)$/u).fill(process.env.UNICORECRM_TEST_PASSWORD || "");
  await page.getByRole("button", { name: /^(Đăng nhập|Sign in)$/u }).click();
  await page.waitForURL(/#\/(?:select-workspace|w\/)/u);
}
async function openConfirmation(page: Page) {
  await page.getByRole("button", { name: /Thao tác|Actions|More|thêm/u }).first().click();
  await page.getByRole("menuitem", { name: /Xác nhận đã gửi|Confirm sent/u }).click();
  await expect(page.locator("#quote-delivery-channel")).toBeVisible();
}
test("B2 manual confirmation commits only after explicit consent and survives login", async ({ page }) => {
  await mkdir(directory, { recursive: true });
  const responses: unknown[] = [], pending: Promise<void>[] = [], errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("response", response => {
    if (!response.url().startsWith(`${api}/quotes`)) return;
    pending.push((async () => { responses.push({ method: response.request().method(), path: new URL(response.url()).pathname,
      correlationId: response.request().headers()["x-correlation-id"], status: response.status(), body: await response.json() }); })());
  });
  let status = "FAIL";
  try {
    await login(page);
    await page.goto(`/#/w/${workspace}/crm/quotes/${quote}`);
    await expect(page.locator("#quote-detail-header")).toBeVisible();
    const assessed = page.waitForResponse(r => r.url() === `${api}/quotes/${quote}/request-approval` && r.request().method() === "POST");
    await page.getByRole("button", { name: /^(Gửi duyệt|Request approval)$/u }).first().click();
    expect((await assessed).status()).toBe(200);
    await expect(page.getByText("Không cần duyệt", { exact: true }).first()).toBeVisible();
    await openConfirmation(page);
    await page.locator("#quote-delivery-channel").click();
    await page.getByRole("option", { name: /^(Email khác|Other email)$/u }).click();
    await page.locator("#quote-delivery-email").fill("wrong@example.test");
    const invalid = page.waitForResponse(r => r.url() === `${api}/quotes/${quote}/send` && r.request().method() === "POST");
    await page.getByRole("button", { name: /^(Xác nhận đã gửi|Confirm sent)$/u }).last().click();
    expect((await invalid).status()).toBe(422);
    await expect(page.getByRole("alert").filter({ hasText: /Thông tin gửi không hợp lệ|Invalid delivery details/u })).toBeVisible();
    await page.locator("#quote-delivery-email").fill("buyer@example.test");
    const committed = page.waitForResponse(r => r.url() === `${api}/quotes/${quote}/send` && r.request().method() === "POST");
    await page.getByRole("button", { name: /^(Xác nhận đã gửi|Confirm sent)$/u }).last().click();
    const response = await committed;
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(validateOpenApiResponse("recordQuoteSendEvidenceCommand", body, 200)).toEqual({ valid: true, issues: [] });
    expect(body.result.quote.status).toBe("SENT");
    expect(body.result.quote.deliveryHistory).toHaveLength(1);
    expect(body.result.quote.deliveryHistory[0].resourceVersion).toBe(body.version - 1);
    await expect(page.getByText(/Người dùng xác nhận đã gửi · email khác/u).first()).toBeVisible();
    await page.reload();
    await expect(page.getByText(/Người dùng xác nhận đã gửi · email khác/u).first()).toBeVisible();
    await page.locator("#user-profile-dropdown").click();
    await page.getByRole("menuitem", { name: /^(Đăng xuất|Sign out)$/u }).click();
    await expect(page).toHaveURL(/#\/login/u);
    await login(page);
    await page.goto(`/#/w/${workspace}/crm/quotes/${quote}`);
    await expect(page.getByText(/Người dùng xác nhận đã gửi · email khác/u).first()).toBeVisible();
    await openConfirmation(page);
    await page.locator("#quote-delivery-channel").click();
    await page.getByRole("option", { name: /^(Email khác|Other email)$/u }).click();
    await page.locator("#quote-delivery-email").fill("buyer@example.test");
    const resend = page.waitForResponse(r => r.url() === `${api}/quotes/${quote}/send` && r.request().method() === "POST");
    await page.getByRole("button", { name: /^(Xác nhận đã gửi|Confirm sent)$/u }).last().click();
    expect((await resend).status()).toBe(200);
    await expect(page.getByText(/Người dùng xác nhận đã gửi · email khác/u)).toHaveCount(2);
    await expect(page.locator("#quote-delivery-channel")).toBeHidden();
    await page.screenshot({ path: path.join(directory, "manual-delivery-history.png"), fullPage: true, animations: "disabled" });
    expect(errors).toEqual([]);
    status = "PASS";
  } finally {
    await Promise.allSettled(pending);
    await writeFile(path.join(directory, "result.json"), JSON.stringify({ status, errors, responses }, null, 2));
  }
});

test("B2 linked Deal reads authoritative SENT without changing its stage", async ({ page }) => {
  linkedResponses = [];
  page.on("response", response => {
    if (!response.url().startsWith(api) || !/^\/(workspaces|access|deals|quotes)(?:\/|$)/u.test(new URL(response.url()).pathname)) return;
    linkedPending.push((async () => { linkedResponses.push({ method: response.request().method(), path: new URL(response.url()).pathname, status: response.status(), body: await response.json() }); })());
  });
  await page.goto("/#/login");
  await page.getByLabel("Email", { exact: true }).fill(process.env.UNICORECRM_TEST_CONTROL_EMAIL || "");
  await page.getByLabel(/^(Mật khẩu|Password)$/u).fill(process.env.UNICORECRM_TEST_CONTROL_PASSWORD || "");
  await page.getByRole("button", { name: /^(Đăng nhập|Sign in)$/u }).click();
  await page.waitForURL(/#\/(?:select-workspace|w\/)/u);
  await page.goto(`/#/w/${process.env.UNICORECRM_TEST_CONTROL_WORKSPACE_KEY}/crm/deals/${process.env.UNICORECRM_TEST_DEAL_ID}`);
  await expect(page.locator("#deal-detail-header")).toBeVisible();
  const tab = page.getByRole("tab", { name: /Báo giá|Quotes/u });
  if (await tab.count()) await tab.click();
  const linked = page.locator(`[data-related-quote="${process.env.UNICORECRM_TEST_LINKED_QUOTE_ID}"]`);
  await expect(linked).toBeVisible();
  await expect(linked).toContainText(/Đã gửi|Sent/u);
  await page.reload();
  const refreshed = page.getByRole("tab", { name: /Báo giá|Quotes/u });
  if (await refreshed.count()) await refreshed.click();
  await expect(linked).toContainText(/Đã gửi|Sent/u);
  await page.screenshot({ path: path.join(directory, "linked-deal-sent.png"), fullPage: true, animations: "disabled" });
});

test("B2 unassessed and restricted users have no delivery action", async ({ page }) => {
  await login(page);
  await page.goto(`/#/w/${workspace}/crm/quotes/${process.env.UNICORECRM_TEST_UNASSESSED_QUOTE_ID}`);
  await expect(page.locator("#quote-detail-header")).toBeVisible();
  await page.getByRole("button", { name: /Thao tác|Actions|More|thêm/u }).first().click();
  await expect(page.getByRole("menuitem", { name: /Xác nhận đã gửi|Confirm sent/u })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.locator("#user-profile-dropdown").click();
  await page.getByRole("menuitem", { name: /^(Đăng xuất|Sign out)$/u }).click();
  await page.getByLabel("Email", { exact: true }).fill(process.env.UNICORECRM_TEST_APPROVER_EMAIL || "");
  await page.getByLabel(/^(Mật khẩu|Password)$/u).fill(process.env.UNICORECRM_TEST_APPROVER_PASSWORD || "");
  await page.getByRole("button", { name: /^(Đăng nhập|Sign in)$/u }).click();
  await page.waitForURL(/#\/(?:select-workspace|w\/)/u);
  await page.goto(`/#/w/${workspace}/crm/quotes/${process.env.UNICORECRM_TEST_DOCUMENT_QUOTE_ID}`);
  await expect(page.locator("#quote-detail-header")).toBeVisible();
  await page.getByRole("button", { name: /Thao tác|Actions|More|thêm/u }).first().click();
  await expect(page.getByRole("menuitem", { name: /Xác nhận đã gửi|Confirm sent/u })).toHaveCount(0);
});

test("B2 unavailable document and Gmail launch never mutate Quote", async ({ page }) => {
  await login(page);
  const id = process.env.UNICORECRM_TEST_DOCUMENT_QUOTE_ID;
  const writes: string[] = [];
  page.on("request", request => { if (request.method() === "POST" && request.url().startsWith(`${api}/quotes`)) writes.push(new URL(request.url()).pathname); });
  await page.goto(`/#/w/${workspace}/crm/quotes/${id}/edit?action=pdf`);
  await expect(page.locator("#quote-builder-page")).toBeVisible();
  await expect(page.locator('[data-quote-document-unavailable="true"]').first()).toBeVisible();
  await page.goto(`/#/w/${workspace}/crm/quotes/${id}/edit?action=gmail`);
  await expect(page.locator("#quote-builder-page")).toBeVisible();
  await expect(page.locator('[data-quote-document-unavailable="true"]').first()).toBeVisible();
  await page.goto("/#/w/unicore-quote-approval-isolation/crm/quotes");
  await expect(page.getByRole("heading", { name: /Không thể mở không gian làm việc|Unable to open/u })).toBeVisible();
  await page.goto(`/#/w/${workspace}/crm/quotes/${id}`);
  await expect(page.locator("#quote-detail-header")).toBeVisible();
  expect(writes).toEqual([]);
  await page.screenshot({ path: path.join(directory, "document-boundary-blocked.png"), fullPage: true, animations: "disabled" });
});

test("B2 opening version stays stale when another command commits", async ({ page, request }) => {
  await login(page);
  const id = process.env.UNICORECRM_TEST_DOCUMENT_QUOTE_ID;
  await page.goto(`/#/w/${workspace}/crm/quotes/${id}`);
  await expect(page.locator("#quote-detail-header")).toBeVisible();
  await openConfirmation(page);
  await page.locator("#quote-delivery-recipient").fill("Synthetic recipient");
  // Separate real API actor session advances only this fresh B2 fixture, never browser storage.
  const authenticated = await request.post(`${api}/auth/sessions`, { data: { email: process.env.UNICORECRM_TEST_EMAIL, password: process.env.UNICORECRM_TEST_PASSWORD }, headers: { "X-Request-Id": `b2-browser-auth-${Date.now()}`, "Idempotency-Key": `b2-browser-auth-${Date.now()}` } });
  expect(authenticated.status()).toBe(200);
  const token = (await authenticated.json()).accessToken;
  const headers = { Authorization: `Bearer ${token}`, "X-Workspace-Id": "ws_096302f33ec94b3fb6ab9a41422d5531", "X-Request-Id": `b2-browser-version-${Date.now()}`, "X-Correlation-Id": `b2-browser-version-${Date.now()}` };
  const current = await request.get(`${api}/quotes/${id}`, { headers });
  expect(current.status()).toBe(200);
  const version = (await current.json()).resourceVersion;
  const advanced = await request.post(`${api}/quotes/${id}/request-approval`, { headers: { ...headers, "If-Match": `"${version}"`, "Idempotency-Key": `b2-browser-advance-${Date.now()}` }, data: {} });
  expect(advanced.status()).toBe(200);
  const stale = page.waitForResponse(r => r.url() === `${api}/quotes/${id}/send` && r.request().method() === "POST");
  await page.getByRole("button", { name: /^(Xác nhận đã gửi|Confirm sent)$/u }).last().click();
  expect((await stale).status()).toBe(412);
  await expect(page.locator("#quote-delivery-channel")).toBeVisible();
  const retained = await request.get(`${api}/quotes/${id}`, { headers });
  const body = await retained.json();
  expect(body.status).toBe("DRAFT");
  expect(body.deliveryHistory ?? []).toHaveLength(0);
});


