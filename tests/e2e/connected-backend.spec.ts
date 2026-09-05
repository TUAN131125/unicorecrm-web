import { expect, test } from "@playwright/test";

const apiBaseUrl = process.env.UNICORECRM_TEST_API_BASE_URL?.trim() || "http://127.0.0.1:4010";
const accessToken = process.env.UNICORECRM_TEST_ACCESS_TOKEN?.trim() || "connected-fixture-token-alpha";
const workspaceId = process.env.UNICORECRM_TEST_WORKSPACE_ID?.trim() || "workspace-alpha";
const workspaceKey = process.env.UNICORECRM_TEST_WORKSPACE_KEY?.trim() || "workspace-alpha";
const testEmail = process.env.UNICORECRM_TEST_EMAIL?.trim() || "sales.manager@unicorecrm.local";
const testPassword = process.env.UNICORECRM_TEST_PASSWORD?.trim() || "welcome123";
const productId = process.env.UNICORECRM_TEST_PRODUCT_ID?.trim();
const productName = process.env.UNICORECRM_TEST_PRODUCT_NAME?.trim() || "Core Product Replaced";
const usesLocalFixture = !process.env.UNICORECRM_TEST_API_BASE_URL?.trim();

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ token, workspace }) => {
    const runtime = { token };
    (window as typeof window & {
      __UNICORECRM_CONNECTED_RUNTIME__?: unknown;
      __UNICORECRM_CONNECTED_E2E_RUNTIME__?: { setAccessToken(value: string): void };
    }).__UNICORECRM_CONNECTED_RUNTIME__ = {
      getAccessToken: () => runtime.token,
      getWorkspaceId: () => workspace,
      refreshSession: () => false,
      onUnauthorized: () => undefined,
      logout: () => undefined,
      telemetry: () => undefined,
    };
    (window as typeof window & {
      __UNICORECRM_CONNECTED_E2E_RUNTIME__?: { setAccessToken(value: string): void };
    }).__UNICORECRM_CONNECTED_E2E_RUNTIME__ = {
      setAccessToken(value: string) { runtime.token = value; },
    };
  }, { token: accessToken, workspace: workspaceId });
});

async function signIn(page: import("@playwright/test").Page) {
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

test("connected Product UI preserves version-bound projections across mutation", async ({ page }) => {
  test.setTimeout(60_000);
  test.skip(usesLocalFixture || !productId, "A real Products backend fixture and Product ID are required.");
  if (!productId) throw new Error("UNICORECRM_TEST_PRODUCT_ID is required.");
  await signIn(page);
  const workspaceMatch = page.url().match(/#\/w\/([^/]+)/u);
  expect(workspaceMatch?.[1]).toBeTruthy();

  await page.goto(`/#/w/${workspaceMatch?.[1]}/crm/products`);
  await expect(page.locator("#product-list-page")).toBeVisible();
  await expect(page.locator("tr").filter({ hasText: productName })).toBeVisible();

  const detailResponse = page.waitForResponse((response) =>
    response.request().method() === "GET"
      && new URL(response.url()).pathname === `/products/${productId}`,
  );
  const availabilityResponse = page.waitForResponse((response) =>
    response.request().method() === "GET"
      && new URL(response.url()).pathname === `/products/${productId}/availability`,
  );
  const priceResponse = page.waitForResponse((response) =>
    response.request().method() === "GET"
      && new URL(response.url()).pathname === `/products/${productId}/price-projection`,
  );
  await page.goto(`/#/w/${workspaceMatch?.[1]}/crm/products/${productId}`);
  const [detail, availability, price] = await Promise.all([detailResponse, availabilityResponse, priceResponse]);
  expect(detail.status()).toBe(200);
  expect(availability.status()).toBe(200);
  expect(price.status()).toBe(200);
  const initialProduct = await detail.json() as { version: number };
  expect(initialProduct.version).toBeGreaterThanOrEqual(1);
  expect(availability.request().headers()["if-match"]).toBe(`"${initialProduct.version}"`);
  expect(price.request().headers()["if-match"]).toBe(`"${initialProduct.version}"`);
  await expect(page.locator("#product-detail-page")).toBeVisible();
  await expect(page.locator("#product-detail-header")).toContainText(productName);

  const archiveResponse = page.waitForResponse((response) =>
    response.request().method() === "POST"
      && new URL(response.url()).pathname === `/products/${productId}/archive`,
  );
  await page.getByRole("button", { name: /^(?:Archive|Lưu trữ)$/u }).first().click();
  const archived = archiveResponse.then((response) => response.json() as Promise<{ version: number }>);
  const archivedBody = await archived;
  expect(archivedBody.version).toBe(initialProduct.version + 1);

  const stale = await page.evaluate(async ({ baseUrl, token, workspace, targetProductId, version }) => {
    const response = await fetch(`${baseUrl}/products/${targetProductId}/price-projection?quantity=1`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Workspace-Id": workspace,
        "X-Request-Id": `browser-${crypto.randomUUID()}`,
        "X-Correlation-Id": `browser-${crypto.randomUUID()}`,
        "If-Match": `"${version}"`,
      },
    });
    return { status: response.status, body: await response.json() };
  }, {
    baseUrl: apiBaseUrl,
    token: accessToken,
    workspace: workspaceId,
    targetProductId: productId,
    version: initialProduct.version,
  });
  expect(stale.status).toBe(412);
  expect(stale.body.code).toBe("VERSION_CONFLICT");

  const refreshedDetailResponse = page.waitForResponse((response) =>
    response.request().method() === "GET"
      && new URL(response.url()).pathname === `/products/${productId}`,
  );
  const refreshedPriceResponse = page.waitForResponse((response) =>
    response.request().method() === "GET"
      && new URL(response.url()).pathname === `/products/${productId}/price-projection`,
  );
  await page.reload();
  const [refreshedDetail, refreshedPrice] = await Promise.all([refreshedDetailResponse, refreshedPriceResponse]);
  expect(refreshedDetail.status()).toBe(200);
  expect(refreshedPrice.status()).toBe(200);
  expect(refreshedPrice.request().headers()["if-match"]).toBe(`"${archivedBody.version}"`);
});

test("connected browser sends bearer/workspace context and enforces workspace isolation", async ({ page }) => {
  await signIn(page);
  const results = await page.evaluate(async ({ baseUrl, token, workspace }) => {
    const request = (targetWorkspace: string) => fetch(`${baseUrl}/leads`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Workspace-Id": targetWorkspace,
        "X-Request-Id": `browser-${crypto.randomUUID()}`,
        "X-Correlation-Id": `browser-${crypto.randomUUID()}`,
      },
    });
    const accepted = await request(workspace);
    const denied = await request(workspace === "workspace-alpha" ? "workspace-beta" : "workspace-alpha");
    return {
      acceptedStatus: accepted.status,
      acceptedBody: await accepted.json(),
      deniedStatus: denied.status,
      deniedBody: await denied.json(),
    };
  }, { baseUrl: apiBaseUrl, token: accessToken, workspace: workspaceId });

  expect(results.acceptedStatus).toBe(200);
  expect(results.deniedStatus).toBe(403);
  expect(results.deniedBody.error.code).toBe("WORKSPACE_ACCESS_DENIED");
});

test("connected Lead workspace renders authoritative fixture data and refreshes after browser mutation", async ({ page }) => {
  test.skip(!usesLocalFixture, "The external backend browser run validates transport/auth; UI DTO acceptance requires the reviewed backend test seed contract.");
  await signIn(page);
  const workspaceMatch = page.url().match(/#\/w\/([^/]+)/u);
  expect(workspaceMatch?.[1]).toBeTruthy();
  await page.goto(`/#/w/${workspaceMatch?.[1]}/crm/leads`);
  await expect(page.locator("#lead-list-page")).toBeVisible();
  await expect(page.getByText("Connected Alpha Lead", { exact: true })).toBeVisible();
  await expect(page.getByText("Connected Beta Lead", { exact: true })).toHaveCount(0);

  const createdName = `Browser Connected Lead ${Date.now()}`;
  const mutation = await page.evaluate(async ({ baseUrl, token, workspace, name }) => {
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
      body: JSON.stringify({ name, email: "browser.connected@example.test", phone: "0000000002" }),
    });
    return { status: response.status, body: await response.json() };
  }, { baseUrl: apiBaseUrl, token: accessToken, workspace: workspaceId, name: createdName });
  expect(mutation.status).toBe(201);

  await page.reload();
  await expect(page.locator("#lead-list-page")).toBeVisible();
  await expect(page.getByText(createdName, { exact: true })).toBeVisible();
});
