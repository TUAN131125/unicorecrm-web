import { execFileSync } from "node:child_process";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const apiBaseUrl = required("UNICORECRM_TEST_API_BASE_URL");
const email = required("UNICORECRM_TEST_EMAIL");
const password = required("UNICORECRM_TEST_PASSWORD");
const workspaceA = required("UNICORECRM_TEST_WORKSPACE_ID");
const workspaceAKey = required("UNICORECRM_TEST_WORKSPACE_KEY");
const workspaceBKey = required("UNICORECRM_TEST_WORKSPACE_B_KEY");
const database = required("UNICORECRM_TEST_DATABASE");
const sqlServer = process.env.UNICORECRM_TEST_SQL_SERVER?.trim() || "(localdb)\\MSSQLLocalDB";

test("real connected Contact advisory is grounded, read-only, denied by owner capability, and cleared on Workspace switch", async ({ page, request }) => {
  test.setTimeout(180_000);
  const token = await apiSignIn(request);
  const create = await request.post(`${apiBaseUrl}/contacts`, {
    headers: apiHeaders(token, workspaceA, `contact-create-${Date.now()}`, true),
    data: { fullName: "CRM AI Browser Contact", workEmail: "crm.ai.browser@example.test", jobTitle: "Decision maker" },
  });
  expect(create.status()).toBe(201);
  const contactId = (await create.json() as { aggregateId: string }).aggregateId;
  const beforeVersion = sqlScalar(`SELECT Version FROM contacts.Contacts WHERE WorkspaceId='${workspaceA}' AND ContactId='${contactId}';`);

  await browserSignIn(page);
  await enterWorkspace(page, workspaceAKey);

  const catalogResponse = page.waitForResponse((response) => response.request().method() === "GET" && new URL(response.url()).pathname === "/ai/configuration/catalog");
  await page.goto(`/#/w/${workspaceAKey}/studio/settings/ai`);
  const catalogResult = await catalogResponse;
  expect(catalogResult.status()).toBe(200);
  const catalog = await catalogResult.json() as { providers: Array<{ id: string; displayName: string }> };
  await expect(page.getByRole("heading", { name: /AI Assistant|Trợ lý AI/u })).toBeVisible();
  const primaryProvider = page.getByLabel(/Provider|Nhà cung cấp/u).first();
  await expect(primaryProvider.locator("option")).toHaveCount(catalog.providers.length);
  expect(await primaryProvider.locator("option").evaluateAll((options) => options.map((option) => ({ value: (option as HTMLOptionElement).value, label: option.textContent }))))
    .toEqual(catalog.providers.map((provider) => ({ value: provider.id, label: provider.displayName })));
  await expect(page.getByText(/Allow retry and cross-provider failover|Cho phép thử lại/u)).toBeVisible();
  const credentialSource = page.getByLabel(/Credential source|Nguồn thông tin xác thực/u).first();
  await credentialSource.selectOption("WORKSPACE");
  const draftResponse = page.waitForResponse((response) => response.request().method() === "PUT" && new URL(response.url()).pathname === "/ai/configuration");
  await page.getByRole("button", { name: /Save draft|Lưu bản nháp/u }).click();
  expect((await draftResponse).status()).toBe(200);
  const browserSecret = "browser-provider-secret-never-echo";
  await page.getByLabel("API key").first().fill(browserSecret);
  const credentialResponse = page.waitForResponse((response) => response.request().method() === "PUT" && new URL(response.url()).pathname === "/ai/configuration/credential");
  await page.getByRole("button", { name: /Set key|Đặt khóa/u }).first().click();
  const credentialResult = await credentialResponse;
  expect(credentialResult.status()).toBe(200);
  expect(await credentialResult.text()).not.toContain(browserSecret);
  await expect(page.getByLabel("API key").first()).toHaveValue("");
  const testResponse = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/ai/configuration/test");
  await page.getByRole("button", { name: /^(?:Test|Kiểm tra)$/u }).click();
  expect((await testResponse).status()).toBe(200);
  const activateResponse = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/ai/configuration/activate");
  await page.getByRole("button", { name: /Activate|Kích hoạt/u }).click();
  expect((await activateResponse).status()).toBe(200);
  await expect(page.getByText(/AI configuration activated|Đã kích hoạt cấu hình AI/u)).toBeVisible();

  await page.goto(`/#/w/${workspaceAKey}/crm/contacts/${contactId}`);
  await expect(page.getByText("CRM AI Browser Contact", { exact: true }).first()).toBeVisible();
  await page.locator("#floating-ai-assistant-btn").click();

  const advisoryResponse = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/ai/advisories");
  await page.getByPlaceholder(/Message Unicore AI|Nhắn cho Unicore AI/u).fill("Summarize this Contact and suggest the next follow-up.");
  await page.getByRole("button", { name: /^(?:Send|Gửi)$/u }).click();
  const response = await advisoryResponse;
  expect(response.status()).toBe(200);
  const requestBody = response.request().postDataJSON() as { contextReferences: Array<{ type: string; id: string }> };
  expect(requestBody.contextReferences).toEqual([{ type: "contact", id: contactId }]);
  const responseBody = await response.json() as { provider: { name: string }; evidence: Array<{ entityType: string; entityId: string; displayLabel?: string }> };
  expect(responseBody.provider.name).toBe("GEMINI");
  expect(responseBody.evidence).toEqual(expect.arrayContaining([expect.objectContaining({ entityType: "contact", entityId: contactId })]));
  await expect(page.getByText(/Read-only advisory|Tư vấn chỉ đọc/u).last()).toBeVisible();
  const evidenceAction = page.locator(`[data-ai-action-intent="NAVIGATE"]`).filter({ hasText: responseBody.evidence[0]?.displayLabel ?? contactId });
  await expect(evidenceAction).toBeVisible();
  await evidenceAction.click();
  await expect(page).toHaveURL(new RegExp(`/contacts/${contactId}$`, "u"));
  expect(sqlScalar(`SELECT Version FROM contacts.Contacts WHERE WorkspaceId='${workspaceA}' AND ContactId='${contactId}';`)).toBe(beforeVersion);

  const openAiBeforeDisabledFailure = Number(sqlScalar(`SELECT COUNT(*) FROM platform_ai.AiProviderAttempts WHERE WorkspaceId='${workspaceA}' AND Provider='OPENAI';`));
  const disabledFallbackResponse = page.waitForResponse((item) => item.request().method() === "POST" && new URL(item.url()).pathname === "/ai/advisories");
  await page.getByPlaceholder(/Message Unicore AI|Nhắn cho Unicore AI/u).fill("DETERMINISTIC_GEMINI_TRANSIENT_FAILURE prove fallback is disabled.");
  await page.getByRole("button", { name: /^(?:Send|Gửi)$/u }).click();
  expect((await disabledFallbackResponse).status()).toBe(503);
  await expect(page.locator('[data-ai-interaction-state="provider_unavailable"]')).toBeVisible();
  expect(Number(sqlScalar(`SELECT COUNT(*) FROM platform_ai.AiProviderAttempts WHERE WorkspaceId='${workspaceA}' AND Provider='OPENAI';`))).toBe(openAiBeforeDisabledFailure);
  await expect(page.getByText(/simulated output is not substituted/iu)).toHaveCount(0);
  await page.getByRole("button", { name: /Close AI Assistant|Đóng Trợ lý AI/u }).click();

  await page.goto(`/#/w/${workspaceAKey}/studio/settings/ai`);
  await page.getByLabel(/Enable cross-provider failover|Bật failover/u).check();
  const fallbackSource = page.getByLabel(/Credential source|Nguồn thông tin xác thực/u).last();
  await fallbackSource.selectOption("WORKSPACE");
  const fallbackDraftResponse = page.waitForResponse((item) => item.request().method() === "PUT" && new URL(item.url()).pathname === "/ai/configuration");
  await page.getByRole("button", { name: /Save draft|Lưu bản nháp/u }).click();
  expect((await fallbackDraftResponse).status()).toBe(200);
  await expect(page.locator('[data-ai-active-configuration="true"]')).toContainText("GEMINI");
  await expect(page.locator('[data-ai-pending-configuration="true"]')).toBeVisible();
  await expect(page.getByRole("button", { name: /Disable|Tắt/u })).toBeEnabled();
  const fallbackSecret = "browser-fallback-secret-never-echo";
  await page.getByLabel("API key").last().fill(fallbackSecret);
  const fallbackCredentialResponse = page.waitForResponse((item) => item.request().method() === "PUT" && new URL(item.url()).pathname === "/ai/configuration/credential");
  await page.getByRole("button", { name: /Set key|Đặt khóa/u }).last().click();
  const fallbackCredentialResult = await fallbackCredentialResponse;
  expect(fallbackCredentialResult.status()).toBe(200);
  expect(await fallbackCredentialResult.text()).not.toContain(fallbackSecret);
  const fallbackTestResponse = page.waitForResponse((item) => item.request().method() === "POST" && new URL(item.url()).pathname === "/ai/configuration/test");
  await page.getByRole("button", { name: /^(?:Test|Kiểm tra)$/u }).click();
  expect((await fallbackTestResponse).status()).toBe(200);
  const fallbackActivateResponse = page.waitForResponse((item) => item.request().method() === "POST" && new URL(item.url()).pathname === "/ai/configuration/activate");
  await page.getByRole("button", { name: /Activate|Kích hoạt/u }).click();
  expect((await fallbackActivateResponse).status()).toBe(200);

  await page.goto(`/#/w/${workspaceAKey}/crm/contacts/${contactId}`);
  await page.locator("#floating-ai-assistant-btn").click();
  const failoverResponse = page.waitForResponse((item) => item.request().method() === "POST" && new URL(item.url()).pathname === "/ai/advisories");
  await page.getByPlaceholder(/Message Unicore AI|Nhắn cho Unicore AI/u).fill("DETERMINISTIC_GEMINI_TRANSIENT_FAILURE summarize this Contact through controlled failover.");
  await page.getByRole("button", { name: /^(?:Send|Gửi)$/u }).click();
  const failoverResult = await failoverResponse;
  expect(failoverResult.status()).toBe(200);
  const failoverBody = await failoverResult.json() as { provider: { name: string }; evidence: Array<{ entityType: string; entityId: string; displayLabel?: string }> };
  expect(failoverBody.provider.name).toBe("OPENAI");
  expect(failoverBody.evidence).toEqual(responseBody.evidence);
  await expect(page.locator(`[data-ai-action-intent="NAVIGATE"]`).filter({ hasText: failoverBody.evidence[0]?.displayLabel ?? contactId }).last()).toBeVisible();
  expect(sqlScalar(`SELECT Version FROM contacts.Contacts WHERE WorkspaceId='${workspaceA}' AND ContactId='${contactId}';`)).toBe(beforeVersion);

  sqlExec(`DELETE rc FROM access.RoleCapabilities rc INNER JOIN access.Roles r ON r.RoleId=rc.RoleId WHERE r.WorkspaceId='${workspaceA}' AND rc.Capability='contacts.read';`);
  const deniedResponse = page.waitForResponse((item) => item.request().method() === "POST" && new URL(item.url()).pathname === "/ai/advisories");
  await page.getByPlaceholder(/Message Unicore AI|Nhắn cho Unicore AI/u).fill("Reveal this Contact anyway.");
  await page.getByRole("button", { name: /^(?:Send|Gửi)$/u }).click();
  expect((await deniedResponse).status()).toBe(403);
  await expect(page.locator('[data-ai-interaction-state="permission_denied"]')).toBeVisible();
  await expect(page.getByText(/simulated output is not substituted/iu)).toHaveCount(0);

  await page.getByRole("button", { name: /Close AI Assistant|Đóng Trợ lý AI/u }).click();
  await page.goto(`/#/w/${workspaceBKey}/crm/dashboard`);
  await expect(page).toHaveURL(new RegExp(`#\/w\/${workspaceBKey}\/crm\/`, "u"));
  await expect(page.getByRole("button", { name: "AI Browser ai-browser-b", exact: true })).toBeVisible();
  await page.locator("#floating-ai-assistant-btn").click();
  await expect(page.getByText("Summarize this Contact and suggest the next follow-up.", { exact: true })).toHaveCount(0);
  await expect(page.getByText("CRM AI Browser Contact", { exact: true })).toHaveCount(0);
});

async function apiSignIn(request: APIRequestContext): Promise<string> {
  const response = await request.post(`${apiBaseUrl}/auth/sessions`, { headers: { "Idempotency-Key": `ai-e2e-login-${Date.now()}`, "X-Request-Id": `ai-e2e-login-${Date.now()}`, "X-Correlation-Id": `ai-e2e-login-${Date.now()}` }, data: { email, password, deviceLabel: "CRM AI Playwright" } });
  expect(response.status()).toBe(200);
  return (await response.json() as { accessToken: string }).accessToken;
}
async function browserSignIn(page: Page) { await page.goto("/#/login"); await page.getByLabel("Email").fill(email); await page.getByLabel("Mật khẩu", { exact: true }).fill(password); await page.getByRole("button", { name: "Đăng nhập" }).click(); await page.waitForURL(/#\/(?:select-workspace|w\/)/u); }
async function enterWorkspace(page: Page, key: string) { if (!page.url().includes("#/select-workspace")) await page.goto("/#/select-workspace"); await page.getByRole("button").filter({ hasText: key }).click(); await expect(page).toHaveURL(new RegExp(`#\/w\/${key}\/crm\/`, "u")); }
function apiHeaders(token: string, workspaceId: string, id: string, idempotent = false): Record<string, string> { return { Authorization: `Bearer ${token}`, "X-Workspace-Id": workspaceId, "X-Request-Id": id, "X-Correlation-Id": id, ...(idempotent ? { "Idempotency-Key": id } : {}) }; }
function sqlScalar(query: string): string { return execFileSync("sqlcmd", ["-S", sqlServer, "-d", database, "-h", "-1", "-W", "-Q", `SET NOCOUNT ON; ${query}`], { encoding: "utf8" }).trim(); }
function sqlExec(query: string): void { execFileSync("sqlcmd", ["-S", sqlServer, "-d", database, "-b", "-Q", query], { stdio: "pipe" }); }
function required(name: string): string { const value = process.env[name]?.trim(); if (!value) throw new Error(`${name} is required.`); return value; }
