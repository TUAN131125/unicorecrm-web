import { expect, test } from "@playwright/test";

const apiBaseUrl = process.env.UNICORECRM_TEST_API_BASE_URL?.trim() || "http://127.0.0.1:4010";
const accessToken = process.env.UNICORECRM_TEST_ACCESS_TOKEN?.trim() || "connected-fixture-token-alpha";
const workspaceId = process.env.UNICORECRM_TEST_WORKSPACE_ID?.trim() || "workspace-alpha";
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
  await page.getByLabel("Email").fill("sales.manager@unicorecrm.local");
  await page.getByLabel("Mật khẩu").fill("welcome123");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL(/#\/w\/[^/]+\/crm\//u);
}

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
