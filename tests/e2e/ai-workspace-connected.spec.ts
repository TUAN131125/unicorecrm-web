import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const api = required("UNICORECRM_TEST_API_BASE_URL");
const workspace = required("UNICORECRM_TEST_WORKSPACE_ID");
const key = required("UNICORECRM_TEST_WORKSPACE_KEY");
const database = required("UNICORECRM_TEST_DATABASE");
const server = required("UNICORECRM_TEST_SQL_SERVER");
const evidence = required("UNICORECRM_AI_EVIDENCE");

test("manual Lead, Contact, Customer and Task with Workspace AI configuration and safe failures (deterministic provider transport)", async ({ page, request }, info) => {
  test.setTimeout(240000);
  const marker = `AI ${Date.now()}`;
  const checks: string[] = [];
  const records: Record<string, string> = {};
  const headers = (token: string, version?: number) => ({ Authorization: `Bearer ${token}`, "X-Workspace-Id": workspace,
    "X-Request-Id": crypto.randomUUID(), "X-Correlation-Id": crypto.randomUUID(), "Idempotency-Key": crypto.randomUUID(),
    ...(version === undefined ? {} : { "If-Match": `"${version}"` }) });
  async function login() {
    await page.goto("/#/login");
    await page.getByLabel("Email", { exact: true }).fill(required("UNICORECRM_TEST_EMAIL"));
    await page.getByLabel(/Mật khẩu|Password/u, { exact: true }).fill(required("UNICORECRM_TEST_PASSWORD"));
    const response = page.waitForResponse(r => r.request().method() === "POST" && new URL(r.url()).pathname === "/auth/sessions");
    await page.getByRole("button", { name: /^(Đăng nhập|Sign in)$/u }).click();
    const result = await response; expect(result.status()).toBe(200);
    const token = (await result.json() as { accessToken: string }).accessToken;
    await page.waitForURL(/#\/(?:select-workspace|w\/)/u);
    if (!page.url().includes(`/w/${key}/`)) {
      await page.goto("/#/select-workspace"); await page.getByRole("button").filter({ hasText: key }).click();
    }
    await expect(page).toHaveURL(new RegExp(`/w/${key}/crm/`, "u")); return token;
  }
  async function mutation(path: string, action: () => Promise<unknown>, status = 200) {
    const pending = page.waitForResponse(r => r.request().method() !== "GET" && new URL(r.url()).pathname === path);
    await action(); const response = await pending; expect(response.status(), path).toBe(status);
    return response.json() as Promise<{ aggregateId: string }>;
  }
  async function studio() {
    await page.goto(`/#/w/${key}/studio/settings/ai`);
    await expect(page.getByRole("heading", { name: /AI Assistant|Trợ lý AI/u })).toBeVisible();
    await expect(page.getByLabel(/Nhà cung cấp|Provider/u).first()).toBeVisible();
  }
  async function ask(type: string, id: string, question: string, status = 200) {
    await page.goto(`/#/w/${key}/crm/${type}s/${id}`);
    await page.locator("#floating-ai-assistant-btn").click();
    const pending = page.waitForResponse(r => r.request().method() === "POST" && new URL(r.url()).pathname === "/ai/advisories");
    await page.getByPlaceholder(/Message Unicore AI|Nhắn cho Unicore AI/u).fill(question);
    await page.getByRole("button", { name: /^(Send|Gửi)$/u }).click();
    const response = await pending; expect(response.status()).toBe(status);
    expect(response.request().postDataJSON()).toMatchObject({ contextReferences: [{ type, id }] });
    expect(Object.keys(response.request().postDataJSON() as object).sort()).toEqual(["contextReferences", "conversation", "locale", "question"]);
    const body = await response.json() as { provider: { name: string }; evidence: { entityType: string; entityId: string }[]; fieldErrors?: { provider?: string[] } };
    if (status === 200) { expect(body.evidence).toEqual(expect.arrayContaining([expect.objectContaining({ entityType: type, entityId: id })])); await expect(page.getByText(/Read-only advisory|Tư vấn chỉ đọc/u).last()).toBeVisible(); }
    return body;
  }
  async function closeAssistant() { await page.getByRole("button", { name: /Close AI Assistant|Đóng Trợ lý AI/u }).click(); }
  async function configCommand(token: string, command: string, data: unknown, status = 200) {
    const config = await request.get(`${api}/ai/configuration`, { headers: headers(token) }); expect(config.status()).toBe(200);
    const version = (await config.json() as { version: number }).version;
    const response = await request.fetch(`${api}/ai/configuration${command}`, { method: command === "" || command === "/credential" ? "PUT" : "POST", headers: headers(token, version), data });
    expect(response.status(), command).toBe(status); return response;
  }
  const token = await login(); checks.push("browser login and Workspace selection");
  await studio();
  await page.getByLabel(/Nguồn thông tin xác thực|Credential source/u).first().selectOption("WORKSPACE");
  await expect(page.getByRole("button", { name: /^(Test|Kiểm tra)$/u })).toBeDisabled();
  await mutation("/ai/configuration", () => page.getByRole("button", { name: /Save draft|Lưu bản nháp/u }).click());
  await page.getByLabel(/^(API key|Khóa API)$/u).fill("deterministic-invalid-key");
  await mutation("/ai/configuration/credential", () => page.getByRole("button", { name: /Set key|Đặt khóa/u }).click());
  await mutation("/ai/configuration/test", () => page.getByRole("button", { name: /^(Test|Kiểm tra)$/u }).click(), 503);
  await expect(page.getByText(/từ chối API key|rejected the API key/u)).toBeVisible();
  await page.getByLabel(/^(API key|Khóa API)$/u).fill("deterministic-workspace-key");
  await mutation("/ai/configuration/credential", () => page.getByRole("button", { name: /Rotate key|Xoay vòng khóa/u }).click());
  await expect(page.getByLabel(/^(API key|Khóa API)$/u)).toHaveValue("");
  await mutation("/ai/configuration/test", () => page.getByRole("button", { name: /^(Test|Kiểm tra)$/u }).click());
  await mutation("/ai/configuration/activate", () => page.getByRole("button", { name: /Activate|Kích hoạt/u }).click());
  await page.reload(); await expect(page.locator('[data-ai-active-configuration="true"]')).toContainText("GEMINI");
  checks.push("Studio invalid key, rotation, real backend credential test through deterministic HTTP transport, activate and refresh");

  await page.goto(`/#/w/${key}/crm/leads`);
  await page.getByRole("button", { name: /Thêm Tiềm năng|Thêm Lead|Add Lead/iu }).first().click();
  const leadDialog = page.getByRole("dialog").filter({ has: page.locator("#lead-name") });
  await leadDialog.locator("#lead-name").fill(marker);
  await leadDialog.locator("#lead-email").fill(`ai-${Date.now()}@example.test`);
  records.leadId = (await mutation("/leads", () => leadDialog.locator('button[type="submit"]').click(), 201)).aggregateId;
  await expect(leadDialog).toBeHidden();
  expect((await ask("lead", records.leadId, "Tóm tắt Lead này theo bằng chứng hiện có.")).provider.name).toBe("GEMINI");
  await closeAssistant(); checks.push("manual Lead creation and grounded reference from Lead detail");
  await page.goto(`/#/w/${key}/crm/contacts`);
  await page.getByRole("button", { name: /^(Thêm liên hệ(?: mới)?|Add contact)$/iu }).first().click();
  const contactDialog = page.getByRole("dialog").filter({ has: page.locator("#contact-create-name") });
  await contactDialog.locator("#contact-create-name").fill(`${marker} Contact`);
  await contactDialog.locator("#contact-create-email").fill(`contact-${Date.now()}@example.test`);
  records.contactId = (await mutation("/contacts", () => contactDialog.locator('button[type="submit"]').click(), 201)).aggregateId;
  await expect(contactDialog).toBeHidden();
  await page.goto(`/#/w/${key}/crm/customers`);
  await page.getByRole("button", { name: /^(Tạo Customer|Create Customer)$/u }).click();
  const customerDialog = page.getByRole("dialog", { name: /^(Tạo Customer|Create Customer)$/u });
  await customerDialog.locator("#customer-onboarding-source").click();
  await page.getByRole("option").filter({ hasText: `${marker} Contact` }).click();
  await customerDialog.locator("#customer-onboarding-tier").click();
  await page.getByRole("option", { name: "GOLD", exact: true }).click();
  records.customerId = (await mutation("/customers", () => customerDialog.locator('button[type="submit"]').click(), 201)).aggregateId;
  await expect(customerDialog).toBeHidden();
  await page.goto(`/#/w/${key}/crm/customers/${records.customerId}`);
  await page.getByRole("button", { name: /^(Thêm công việc|Tạo công việc|Add task|Create task)$/u }).first().click();
  const taskDialog = page.getByRole("dialog").filter({ has: page.locator("#task-create-title") });
  await taskDialog.locator("#task-create-title").fill(`${marker} chăm sóc`);
  await taskDialog.locator("#task-create-dueAt").click(); await page.getByRole("button", { name: /^(Áp dụng|Apply)$/u }).click();
  records.taskId = (await mutation("/tasks", () => taskDialog.locator('button[type="submit"]').click(), 201)).aggregateId;
  await expect(taskDialog).toBeHidden();
  await expect(page.locator(`[data-customer-task-id="${records.taskId}"]`)).toBeVisible();
  const before = sql(`SELECT CONCAT(c.Version,':',t.Version) FROM customers.Customers c CROSS JOIN tasks.Tasks t WHERE c.CustomerId='${records.customerId}' AND t.TaskId='${records.taskId}';`);
  expect((await ask("customer", records.customerId, "Phân tích tình trạng, rủi ro và đề xuất chăm sóc. Nêu rõ dữ liệu chưa đủ.")).provider.name).toBe("GEMINI");
  await page.screenshot({ path: info.outputPath("customer-ai.png"), fullPage: true });
  await closeAssistant(); checks.push("manual Contact, Customer and related Task; Customer AI reads authorized summary");

  const related = await request.post(`${api}/ai/advisories`, { headers: headers(token), data: { question: "Analyze Customer and this explicit Task reference.", locale: "en", contextReferences: [{ type: "customer", id: records.customerId }, { type: "task", id: records.taskId }] } });
  expect(related.status()).toBe(200); expect((await related.json() as { evidence: unknown[] }).evidence).toHaveLength(2);
  await configCommand(token, "/credential", { credential: "deterministic-invalid-key" });
  await configCommand(token, "/test", {}, 503);
  expect((await ask("customer", records.customerId, "Active snapshot remains available during failed rotation.")).provider.name).toBe("GEMINI"); await closeAssistant();
  await configCommand(token, "/credential", { credential: "deterministic-rotated-key" }); await configCommand(token, "/test", {}); await configCommand(token, "/activate", {});
  checks.push("explicit Customer+Task tool references; failed key rotation preserves active snapshot; tested rotation activates");

  await studio();
  await mutation("/ai/configuration/disable", () => page.getByRole("button", { name: /^(Disable|Tắt)$/u }).click());
  const attempts = sql(`SELECT COUNT(*) FROM platform_ai.AiProviderAttempts WHERE WorkspaceId='${workspace}';`);
  expect((await ask("customer", records.customerId, "AI disabled must not use deployment default.", 503)).fieldErrors?.provider).toEqual(["WORKSPACE_AI_INACTIVE"]);
  await expect(page.getByText(/đang tắt hoặc chưa kích hoạt|disabled or awaiting activation/u)).toBeVisible(); await closeAssistant();
  expect(sql(`SELECT COUNT(*) FROM platform_ai.AiProviderAttempts WHERE WorkspaceId='${workspace}';`)).toBe(attempts);
  await configCommand(token, "", { primaryProvider: "OPENAI", primaryModel: "gpt-5-mini", primaryCredentialSource: "WORKSPACE", fallbackEnabled: false, retryRateLimited: false });
  await configCommand(token, "/credential", { credential: "deterministic-openai-key" }); await configCommand(token, "/test", {}); await configCommand(token, "/activate", {});
  expect((await ask("customer", records.customerId, "Use Workspace-selected OpenAI.")).provider.name).toBe("OPENAI"); await closeAssistant();
  checks.push("Disable blocks deployment fallback with zero provider attempts; explicit provider change activates OpenAI");

  await ask("customer", records.customerId, "DETERMINISTIC_RATE_LIMIT", 429);
  await expect(page.locator('[data-ai-interaction-state="rate_limited"]')).toBeVisible(); await closeAssistant();
  await configCommand(token, "", { primaryProvider: "GEMINI", primaryModel: "gemini-2.5-flash", primaryCredentialSource: "DEPLOYMENT", fallbackEnabled: false, retryRateLimited: false });
  await configCommand(token, "/test", {}); await configCommand(token, "/activate", {});
  await ask("customer", records.customerId, "DETERMINISTIC_GEMINI_TRANSIENT_FAILURE", 503);
  await expect(page.locator('[data-ai-interaction-state="provider_unavailable"]')).toBeVisible(); await closeAssistant();
  checks.push("rate limit and provider outage remain explicit errors without demo substitution");
  await configCommand(token, "", { primaryProvider: "OPENAI", primaryModel: "gpt-5-mini", primaryCredentialSource: "WORKSPACE", fallbackEnabled: false, retryRateLimited: false });
  await configCommand(token, "/credential", { credential: "deterministic-openai-final-key" }); await configCommand(token, "/test", {}); await configCommand(token, "/activate", {});

  sql(`DELETE rc FROM access.RoleCapabilities rc INNER JOIN access.Roles r ON r.RoleId=rc.RoleId WHERE r.WorkspaceId='${workspace}' AND rc.Capability='customers.view';`);
  const deniedAttempts = sql(`SELECT COUNT(*) FROM platform_ai.AiProviderAttempts WHERE WorkspaceId='${workspace}';`);
  // Direct API isolates revoked authority from the shell's already-loaded capability snapshot.
  const denied = await request.post(`${api}/ai/advisories`, { headers: headers(token), data: { question: "Reveal Customer anyway", locale: "en", contextReferences: [{ type: "customer", id: records.customerId }] } });
  expect(denied.status()).toBe(403);
  await ask("customer", records.customerId, "Revoked permission must be visible in Chat.", 403);
  await expect(page.locator('[data-ai-interaction-state="permission_denied"]')).toBeVisible(); await closeAssistant();
  expect(sql(`SELECT COUNT(*) FROM platform_ai.AiProviderAttempts WHERE WorkspaceId='${workspace}';`)).toBe(deniedAttempts);
  sql(`INSERT INTO access.RoleCapabilities(RoleId,Capability) SELECT RoleId,'customers.view' FROM access.Roles WHERE WorkspaceId='${workspace}';`);
  sql(`DELETE rc FROM access.RoleCapabilities rc INNER JOIN access.Roles r ON r.RoleId=rc.RoleId WHERE r.WorkspaceId='${workspace}' AND rc.Capability IN ('ai.configuration.read','ai.configuration.manage');`);
  expect((await request.get(`${api}/ai/configuration`, { headers: headers(token) })).status()).toBe(403);
  expect((await request.post(`${api}/ai/configuration/disable`, { headers: headers(token, 0), data: {} })).status()).toBe(403);
  sql(`INSERT INTO access.RoleCapabilities(RoleId,Capability) SELECT RoleId,c.Capability FROM access.Roles CROSS JOIN (VALUES ('ai.configuration.read'),('ai.configuration.manage')) c(Capability) WHERE WorkspaceId='${workspace}';`);
  checks.push("revoked Customer read stops provider; configuration read/manage enforced independently by backend");

  await page.goto(`/#/w/${required("UNICORECRM_TEST_WORKSPACE_B_KEY")}/crm/dashboard`);
  await page.locator("#floating-ai-assistant-btn").click();
  await expect(page.getByText("Use Workspace-selected OpenAI.", { exact: true })).toHaveCount(0); await closeAssistant();
  const workspaceB = sql("SELECT WorkspaceId FROM workspace.Workspaces WHERE [Key]='ai-workspace-b';");
  const foreignHeaders = { ...headers(token), "X-Workspace-Id": workspaceB };
  const bConfig = await request.get(`${api}/ai/configuration`, { headers: foreignHeaders }); expect(bConfig.status()).toBe(200);
  expect((await bConfig.json() as { status: string }).status).toBe("UNCONFIGURED");
  await page.goto(`/#/w/${required("UNICORECRM_TEST_WORKSPACE_B_KEY")}/studio/settings/ai`);
  await expect(page.getByText(/UNCONFIGURED/u)).toBeVisible();
  await expect(page.locator('[data-ai-active-configuration="true"]')).toHaveCount(0);
  const foreign = await request.post(`${api}/ai/advisories`, { headers: foreignHeaders, data: { question: "Read Workspace A Customer", locale: "en", contextReferences: [{ type: "customer", id: records.customerId }] } });
  expect(foreign.status()).toBe(404);
  await page.locator("#user-profile-dropdown").click(); await page.getByRole("menuitem", { name: /^(Đăng xuất|Sign out|Log out)$/u }).click();
  await page.waitForURL(/#\/login/u); await login();
  await studio(); await expect(page.locator('[data-ai-active-configuration="true"]')).toContainText("OPENAI");
  await ask("customer", records.customerId, "Customer after logout/login."); await page.reload();
  await expect(page.getByText("Use Workspace-selected OpenAI.", { exact: true })).toHaveCount(0);
  expect(sql(`SELECT CONCAT(c.Version,':',t.Version) FROM customers.Customers c CROSS JOIN tasks.Tasks t WHERE c.CustomerId='${records.customerId}' AND t.TaskId='${records.taskId}';`)).toBe(before);
  expect(sql("SELECT COUNT(*) FROM customers.Customers;")).toBe("1");
  expect(sql("SELECT COUNT(*) FROM tasks.Tasks;")).toBe("1");
  checks.push("Workspace switch clears conversation and isolates config/context; logout/login, refresh; AI does not change Customer/Task versions");
  await writeFile(`${evidence}/journey.json`, JSON.stringify({ ...records, checks, transport: "DETERMINISTIC", realProvider: "BLOCKED_NO_CREDENTIAL" }, null, 2));
});

function required(name: string): string { const value = process.env[name]; if (!value) throw new Error(`${name} required`); return value; }
function sql(query: string): string { return execFileSync("sqlcmd", ["-S", server, "-d", database, "-b", "-h", "-1", "-W", "-Q", `SET NOCOUNT ON; ${query}`], { encoding: "utf8" }).trim(); }
