import { expect, test } from "@playwright/test";

const workspaceKey = process.env.UNICORECRM_TEST_WORKSPACE_KEY ?? "customer-health-browser";
const ownerEmail = process.env.UNICORECRM_TEST_EMAIL ?? "customer.health.browser.owner@example.test";
const ownerPassword = process.env.UNICORECRM_TEST_PASSWORD ?? "Customer-Health-Browser!234";
const deniedEmail = process.env.UNICORECRM_TEST_DENIED_EMAIL ?? "customer.health.browser.denied@example.test";
const deniedPassword = process.env.UNICORECRM_TEST_DENIED_PASSWORD ?? "Customer-Health-Denied!234";
const unknownCustomerId = process.env.UNICORECRM_TEST_UNKNOWN_CUSTOMER_ID ?? "";
const unknownCustomerCode = process.env.UNICORECRM_TEST_UNKNOWN_CUSTOMER_CODE ?? "";
const recentCustomerId = process.env.UNICORECRM_TEST_RECENT_CUSTOMER_ID ?? "";
const recentCustomerCode = process.env.UNICORECRM_TEST_RECENT_CUSTOMER_CODE ?? "";
const overdueCustomerCode = process.env.UNICORECRM_TEST_OVERDUE_CUSTOMER_CODE ?? "";
const archivedCustomerId = process.env.UNICORECRM_TEST_ARCHIVED_CUSTOMER_ID ?? "";
const archivedCustomerCode = process.env.UNICORECRM_TEST_ARCHIVED_CUSTOMER_CODE ?? "";

async function signIn(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/#/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL(/#\/(?:select-workspace|w\/[^/]+\/crm\/)/u);
  if (page.url().includes("#/select-workspace")) {
    const workspaceOption = page.getByRole("button", { name: /Customer Health Browser/u });
    await Promise.race([
      page.waitForURL(/#\/w\/[^/]+\/crm\//u),
      workspaceOption.waitFor({ state: "visible" }).then(() => workspaceOption.click()),
    ]);
  }
  await expect(page).toHaveURL(/#\/w\/[^/]+\/crm\//u);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await page.waitForLoadState("networkidle");
}

test("connected Customer Health renders authoritative unknown, recent and overdue assessments", async ({ page }) => {
  test.setTimeout(90_000);
  await signIn(page, ownerEmail, ownerPassword);
  const workspace = page.url().match(/#\/w\/([^/]+)/u)?.[1];
  expect(workspace).toBeTruthy();

  const listResponse = page.waitForResponse((response) =>
    response.request().method() === "GET" && new URL(response.url()).pathname === "/customers",
  );
  await page.evaluate((hash) => { window.location.hash = hash; }, `#/w/${workspace}/crm/customers/health`);
  expect((await listResponse).status()).toBe(200);
  const unknownRow = page.getByRole("button").filter({ hasText: unknownCustomerCode });
  await expect(unknownRow).toContainText(/Unknown|Chưa đủ dữ liệu/u);
  await expect(unknownRow).not.toContainText("%");
  await expect(page.getByRole("button").filter({ hasText: recentCustomerCode })).toContainText(/Healthy|Khỏe mạnh/u);
  await expect(page.getByRole("button").filter({ hasText: overdueCustomerCode })).toContainText(/Critical|Nghiêm trọng/u);

  const detailResponse = page.waitForResponse((response) =>
    response.request().method() === "GET" && new URL(response.url()).pathname === `/customers/${recentCustomerId}/360`,
  );
  await page.evaluate((hash) => { window.location.hash = hash; }, `#/w/${workspace}/crm/customers/${recentCustomerId}`);
  expect((await detailResponse).status()).toBe(200);
  const card = page.locator('[data-customer-health-authority="backend"]');
  await expect(card).toBeVisible();
  await expect(card).toContainText("100/100");
  await expect(card).toContainText("HIGH");
  await expect(card).toContainText(/classification, not probability|Phân loại, không phải xác suất/ui);
});

test("connected permission denial comes from backend without local Health fallback", async ({ page }) => {
  test.setTimeout(90_000);
  await signIn(page, deniedEmail, deniedPassword);
  const workspace = page.url().match(/#\/w\/([^/]+)/u)?.[1];
  expect(workspace).toBeTruthy();
  const deniedResponse = page.waitForResponse((response) =>
    response.request().method() === "GET" && new URL(response.url()).pathname === "/customers",
  );
  await page.evaluate((hash) => { window.location.hash = hash; }, `#/w/${workspace}/crm/customers/health`);
  const response = await deniedResponse;
  expect(response.status()).toBe(200);
  expect((await response.json()).items).toEqual([]);
  await expect(page.getByText(recentCustomerCode, { exact: true })).toHaveCount(0);
  await expect(page.getByText(overdueCustomerCode, { exact: true })).toHaveCount(0);
  await expect(page.getByText(unknownCustomerCode, { exact: true })).toHaveCount(0);
});

test("connected detail for no-purchase Customer remains UNKNOWN", async ({ page }) => {
  await signIn(page, ownerEmail, ownerPassword);
  const workspace = page.url().match(/#\/w\/([^/]+)/u)?.[1];
  const detailResponse = page.waitForResponse((response) =>
    response.request().method() === "GET" && new URL(response.url()).pathname === `/customers/${unknownCustomerId}/360`,
  );
  await page.evaluate((hash) => { window.location.hash = hash; }, `#/w/${workspace}/crm/customers/${unknownCustomerId}`);
  expect((await detailResponse).status()).toBe(200);
  const card = page.locator('[data-customer-health-authority="backend"]');
  await expect(card).toContainText(/Unknown|Chưa đủ dữ liệu/u);
  await expect(card).toContainText(/NONE|Không có/u);
  await expect(card).not.toContainText("%");
});

test("connected archived Customer shows no active assessment and never falls back locally", async ({ page }) => {
  test.setTimeout(90_000);
  await signIn(page, ownerEmail, ownerPassword);
  const workspace = page.url().match(/#\/w\/([^/]+)/u)?.[1];
  expect(workspace).toBeTruthy();
  expect(archivedCustomerId).not.toBe("");
  expect(archivedCustomerCode).not.toBe("");

  const detailResponse = page.waitForResponse((response) =>
    response.request().method() === "GET" && new URL(response.url()).pathname === `/customers/${archivedCustomerId}/360`,
  );
  await page.evaluate((hash) => { window.location.hash = hash; }, `#/w/${workspace}/crm/customers/${archivedCustomerId}`);
  const response = await detailResponse;
  expect(response.status()).toBe(200);
  expect((await response.json()).healthAssessment ?? null).toBeNull();

  const absentCard = page.locator('[data-customer-health-authority="backend-absent"]');
  await expect(absentCard).toBeVisible();
  await expect(absentCard).toContainText(/Not assessed|Không được đánh giá/u);
  await expect(absentCard).not.toContainText(/\/100/u);
  await expect(page.locator('[data-customer-ai-brief="canonical"]')).toHaveCount(0);
  await expect(page.locator('[data-customer-health-authority="backend"]')).toHaveCount(0);
});
