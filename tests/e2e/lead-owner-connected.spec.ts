import { expect, test, type Page } from "@playwright/test";

const apiBaseUrl = process.env.UNICORECRM_TEST_API_BASE_URL?.trim() || "http://127.0.0.1:4010";
const accessToken = process.env.UNICORECRM_TEST_ACCESS_TOKEN?.trim() || "connected-fixture-token-alpha";
const workspaceId = process.env.UNICORECRM_TEST_WORKSPACE_ID?.trim() || "workspace-alpha";
const workspaceKey = process.env.UNICORECRM_TEST_WORKSPACE_KEY?.trim() || "workspace-alpha";
const testEmail = process.env.UNICORECRM_TEST_EMAIL?.trim() || "sales.manager@unicorecrm.local";
const testPassword = process.env.UNICORECRM_TEST_PASSWORD?.trim() || "welcome123";
const usesLocalFixture = !process.env.UNICORECRM_TEST_API_BASE_URL?.trim();

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ token, workspace }) => {
    window.localStorage.setItem("unicorecrm.locale", "vi-VN");
    window.localStorage.setItem("unicorecrm.accessToken", token);
    window.localStorage.setItem("unicorecrm.workspaceId", workspace);
  }, { token: accessToken, workspace: workspaceId });
});

async function signIn(page: Page) {
  await page.goto("/#/login");
  await page.getByLabel("Email").fill(testEmail);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(testPassword);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL(/#\/(?:select-workspace|w\/[^/]+\/crm\/)/u);
  if (page.url().includes("#/select-workspace")) {
    await page.getByRole("button").filter({ hasText: workspaceKey }).click();
  }
  await expect(page).toHaveURL(/#\/w\/[^/]+\/crm\//u);
}

test("connected Lead create resolves the authenticated Workspace member", async ({ page }) => {
  test.setTimeout(60_000);
  test.skip(usesLocalFixture, "A real backend is required for authoritative membership validation.");
  await signIn(page);
  const workspaceRouteKey = page.url().match(/#\/w\/([^/]+)/u)?.[1];
  expect(workspaceRouteKey).toBeTruthy();
  await page.goto(`/#/w/${workspaceRouteKey}/crm/leads`);
  await expect(page.locator("#lead-list-page")).toBeVisible();

  await page.getByRole("button", { name: /Thêm Tiềm năng|Thêm Lead|Add Lead/iu }).first().click();
  const dialog = page.getByRole("dialog", { name: /Thêm Tiềm năng mới|Thêm Lead mới|Add new Lead/iu });
  await expect(dialog).toBeVisible();
  const owner = dialog.locator("#lead-owner");
  await expect(owner).toBeDisabled();
  await expect(owner.locator("xpath=following-sibling::input[@required]")).not.toHaveValue("");

  const timestamp = Date.now();
  const createdName = `Connected owner Lead ${timestamp}`;
  await dialog.locator("#lead-name").fill(createdName);
  await dialog.locator("#lead-email").fill(`connected.owner.${timestamp}@example.test`);
  await dialog.locator("#lead-phone").fill("0900000123");
  const source = dialog.locator("#lead-source");
  // The fresh isolated Workspace has no configured source directory. Supply the admitted WEB value
  // in the browser fixture so this regression stays scoped to owner resolution (F-E2E-01).
  await source.evaluate((element) => element.append(new Option("Web", "WEB")));
  await source.selectOption("WEB");

  const createResponse = page.waitForResponse((response) =>
    response.request().method() === "POST" && new URL(response.url()).pathname === "/leads",
  );
  await dialog.locator('button[type="submit"]').click();
  expect((await createResponse).status()).toBe(201);
  await expect(dialog).toBeHidden();

  await page.getByTitle(/Kanban/iu).click();
  await expect(page.getByText(createdName, { exact: true })).toBeVisible();
});

test("connected browser cannot assign a fabricated Workspace member", async ({ page }) => {
  test.setTimeout(60_000);
  test.skip(usesLocalFixture, "A real backend is required for authoritative owner rejection.");
  await signIn(page);
  const rejectedName = `Rejected fabricated owner ${Date.now()}`;
  const rejected = await page.evaluate(async ({ baseUrl, token, workspace, displayName }) => {
    const response = await fetch(`${baseUrl}/leads`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Workspace-Id": workspace,
        "X-Request-Id": `browser-${crypto.randomUUID()}`,
        "X-Correlation-Id": `browser-${crypto.randomUUID()}`,
        "Idempotency-Key": `browser-create-${crypto.randomUUID()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        displayName,
        email: `rejected.owner.${Date.now()}@example.test`,
        phone: "0900000456",
        source: "WEB",
        ownerId: "member_not_authorized_e2e",
        estimatedValue: { amount: "0", currency: "USD" },
      }),
    });
    return { status: response.status, body: await response.json() };
  }, { baseUrl: apiBaseUrl, token: accessToken, workspace: workspaceId, displayName: rejectedName });
  expect(rejected.status).toBe(422);
  expect(rejected.body.code).toBe("VALIDATION_FAILED");

  const leads = await page.evaluate(async ({ baseUrl, token, workspace }) => {
    const response = await fetch(`${baseUrl}/leads`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Workspace-Id": workspace,
        "X-Request-Id": `browser-${crypto.randomUUID()}`,
        "X-Correlation-Id": `browser-${crypto.randomUUID()}`,
      },
    });
    return response.json();
  }, { baseUrl: apiBaseUrl, token: accessToken, workspace: workspaceId });
  expect(JSON.stringify(leads)).not.toContain(rejectedName);
});
