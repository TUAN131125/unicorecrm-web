import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";

type Mutation = { aggregateId: string; version: number; result: { customerId?: string; leadId?: string } };
type Session = { principal: { memberId: string } };
type ActivityPage = { items: { id: string; recordRef?: { recordId: string } }[]; pageInfo: { totalCount: number } };

test("API CRM workflow with real UI sign-in, projection and durable Activity", async ({ page, request, browser }, testInfo) => {
  const marker = `crm-${Date.now()}`;
  const api = process.env.UNICORECRM_TEST_API_BASE_URL ?? "";
  const workspace = process.env.UNICORECRM_TEST_WORKSPACE_ID ?? "";
  const evidence: { method: string; path: string; status: number; correlationId: string }[] = [];
  await page.goto("/#/login");
  await page.getByLabel("Email", { exact: true }).fill(process.env.UNICORECRM_TEST_EMAIL ?? "");
  await page.getByLabel(/Mật khẩu|Password/u, { exact: true }).fill(process.env.UNICORECRM_TEST_PASSWORD ?? "");
  const signedIn = page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname === "/auth/sessions");
  await page.getByRole("button", { name: /^(Đăng nhập|Sign in)$/u }).click();
  const login = await signedIn;
  expect(login.status()).toBe(200);
  const credentials = await login.json() as { accessToken: string };
  // A single eligible Workspace may redirect immediately after the selection route appears.
  try { await page.waitForURL(/#\/w\/[^/]+\/crm\//u, { timeout: 5_000 }); }
  catch { await page.getByRole("button").filter({ hasText: "unicore-demo" }).click({ timeout: 15_000 }); }
  await expect(page).toHaveURL(/#\/w\/[^/]+\/crm\//u);
  const workspaceKey = page.url().match(/#\/w\/([^/]+)/u)?.[1];
  expect(workspaceKey).toBeTruthy();
  const headers = { Authorization: `Bearer ${credentials.accessToken}`, "X-Workspace-Id": workspace };
  async function call<T>(method: string, path: string, expected: number, data?: unknown, key?: string, version?: number): Promise<T> {
    const correlationId = `${marker}-${evidence.length}`;
    const response = await request.fetch(`${api}${path}`, {
      method, headers: { ...headers, "X-Request-Id": correlationId, "X-Correlation-Id": correlationId,
        ...(key ? { "Idempotency-Key": key } : {}), ...(version === undefined ? {} : { "If-Match": `"${version}"` }) },
      ...(data === undefined ? {} : { data }),
    });
    evidence.push({ method, path, status: response.status(), correlationId });
    expect(response.status(), `${method} ${path}`).toBe(expected);
    return response.json() as Promise<T>;
  }
  try {
    const session = await call<Session>("GET", "/auth/session", 200);
    const member = session.principal.memberId;
    const lead = await call<Mutation>("POST", "/leads", 201, {
      displayName: marker, email: `${marker}@example.test`, phone: "0900000123", source: "WEB", ownerId: member,
      estimatedValue: { amount: "0", currency: "USD" },
    }, `${marker}-lead`);
    const leadRecord = await call<{ ownerId: string }>("GET", `/leads/${lead.aggregateId}`, 200);
    expect(leadRecord.ownerId).toBe(member);
    const contact = await call<Mutation>("POST", "/contacts", 201, { fullName: `${marker} Contact`, workEmail: `${marker}-contact@example.test`, ownerId: member }, `${marker}-contact`);
    const organization = await call<Mutation>("POST", "/organizations", 200, { displayName: `${marker} Organization` }, `${marker}-organization`);
    await call<Mutation>("POST", `/contacts/${contact.aggregateId}/organization-relationships`, 200,
      { organizationId: organization.aggregateId, role: "employee", isPrimaryAffiliation: true }, `${marker}-relationship`, contact.version);
    const conversionBody = { accountSubject: { type: "CONTACT", mode: "EXISTING", id: contact.aggregateId } };
    const conversionPath = `/workflows/lead-customer-conversion/${lead.aggregateId}`;
    const conversion = await call<Mutation>("POST", conversionPath, 200, conversionBody, `${marker}-convert`, lead.version);
    const replay = await call<Mutation>("POST", conversionPath, 200, conversionBody, `${marker}-convert`, lead.version);
    expect(replay.result.customerId).toBe(conversion.result.customerId);
    const customerId = conversion.result.customerId;
    expect(customerId).toBeTruthy();
    const summary = await call<{ customerIds: string[]; customerRelationships: unknown[] }>("GET", `/contacts/${contact.aggregateId}/relationship-summary`, 200);
    expect(summary.customerIds).toEqual([customerId]);
    expect(summary.customerRelationships).toEqual([]);
    const organizationLead = await call<Mutation>("POST", "/leads", 201, {
      displayName: `${marker} Organization lead`, email: `${marker}-org@example.test`, phone: "0900000123", source: "WEB", ownerId: member,
      estimatedValue: { amount: "0", currency: "USD" },
    }, `${marker}-organization-lead`);
    const organizationConversion = await call<Mutation>("POST", `/workflows/lead-customer-conversion/${organizationLead.aggregateId}`, 200,
      { accountSubject: { type: "ORGANIZATION_ACCOUNT", mode: "EXISTING", id: organization.aggregateId } }, `${marker}-organization-convert`, organizationLead.version);
    const organizationCustomer = await call<{ relationshipRef: { type: string; id: string } }>("GET", `/customers/${organizationConversion.result.customerId}`, 200);
    expect(organizationCustomer.relationshipRef).toEqual({ type: "ORGANIZATION_ACCOUNT", id: organization.aggregateId });
    const directSummary = await call<{ customerIds: string[] }>("GET", `/contacts/${contact.aggregateId}/relationship-summary`, 200);
    expect(directSummary.customerIds).toEqual([customerId]);
    const taskInput = { title: `${marker} Task`, assigneeId: member, dueAt: new Date(Date.now() + 86400000).toISOString(),
      recordRef: { moduleKey: "customers", recordId: customerId } };
    await call<Mutation>("POST", "/tasks", 201, taskInput, `${marker}-task`);
    const meeting = await call<Mutation>("POST", "/tasks", 201, { ...taskInput, title: `${marker} Meeting`,
      description: "Agenda: isolated acceptance; location: test office; attendees: test Contact",
      sourceRef: { type: "CUSTOMER_MEETING", id: customerId } }, `${marker}-meeting`);
    await call<Mutation>("POST", `/tasks/${meeting.aggregateId}/complete`, 200, { outcome: "meeting completed" }, `${marker}-complete`, meeting.version);
    const activityInput = { type: "NOTE", subject: `${marker} Activity`, recordRef: { moduleKey: "contacts", recordId: contact.aggregateId },
      relationshipRef: { type: "ORGANIZATION_ACCOUNT", id: organization.aggregateId }, sourceRef: { type: "CONTACT_ACTIVITY", id: contact.aggregateId } };
    const activity = await call<Mutation>("POST", "/activities", 201, activityInput, `${marker}-activity`);
    const activityReplay = await call<Mutation>("POST", "/activities", 201, activityInput, `${marker}-activity`);
    expect(activityReplay.aggregateId).toBe(activity.aggregateId);
    const history = await call<ActivityPage>("GET", `/activities?recordModuleKey=contacts&recordId=${contact.aggregateId}`, 200);
    expect(history.items.map(item => item.id)).toEqual([activity.aggregateId]);
    await page.goto(`/#/w/${workspaceKey}/crm/contacts/${contact.aggregateId}`);
    await expect(page.getByText(`${marker} Contact`, { exact: true }).first()).toBeVisible();
    await page.reload();
    await expect(page.getByText(`${marker} Contact`, { exact: true }).first()).toBeVisible();
    await expect(page.getByText("1 hồ sơ khách hàng", { exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "Lịch sử", exact: true }).click();
    await expect(page.getByText(`${marker} Activity`, { exact: true }).first()).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("contact-after-refresh.png"), fullPage: true });
    await call("POST", "/auth/session/logout", 200, { reason: "isolated acceptance" }, `${marker}-logout`);
    await page.goto("/#/login");
    await page.getByLabel("Email", { exact: true }).fill(process.env.UNICORECRM_TEST_EMAIL ?? "");
    await page.getByLabel(/Mật khẩu|Password/u, { exact: true }).fill(process.env.UNICORECRM_TEST_PASSWORD ?? "");
    const reloginResponse = page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname === "/auth/sessions");
    await page.getByRole("button", { name: /^(Đăng nhập|Sign in)$/u }).click();
    expect((await reloginResponse).status()).toBe(200);
    await page.waitForURL(/#\/w\/[^/]+\/crm\//u);
    await page.goto(`/#/w/${workspaceKey}/crm/contacts/${contact.aggregateId}`);
    await page.getByRole("tab", { name: "Lịch sử", exact: true }).click();
    await expect(page.getByText(`${marker} Activity`, { exact: true }).first()).toBeVisible();
    const ownContext = await browser.newContext({ baseURL: "http://127.0.0.1:3039" });
    try {
      const ownPage = await ownContext.newPage();
      await ownPage.goto("/#/login");
      await ownPage.getByLabel("Email", { exact: true }).fill(process.env.UNICORECRM_TEST_OWN_EMAIL ?? "");
      await ownPage.getByLabel(/Mật khẩu|Password/u, { exact: true }).fill(process.env.UNICORECRM_TEST_PASSWORD ?? "");
      const ownLogin = ownPage.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname === "/auth/sessions");
      await ownPage.getByRole("button", { name: /^(Đăng nhập|Sign in)$/u }).click();
      expect((await ownLogin).status()).toBe(200);
      await ownPage.goto(`/#/w/${workspaceKey}/crm/contacts/${process.env.UNICORECRM_TEST_OWN_CONTACT_ID ?? ""}`);
      await ownPage.getByRole("tab", { name: "Lịch sử", exact: true }).click();
      await expect(ownPage.getByText("Activity security test", { exact: true }).first()).toBeVisible();
      await expect(ownPage.getByText(`${marker} Activity`, { exact: true })).toHaveCount(0);
      await ownPage.reload();
      await ownPage.getByRole("tab", { name: "Lịch sử", exact: true }).click();
      await expect(ownPage.getByText("Activity security test", { exact: true }).first()).toBeVisible();
      await ownPage.screenshot({ path: testInfo.outputPath("sales-own-history-after-refresh.png"), fullPage: true });
    } finally { await ownContext.close(); }
    await writeFile(testInfo.outputPath("records.json"), JSON.stringify({ marker, leadId: lead.aggregateId, contactId: contact.aggregateId,
      organizationId: organization.aggregateId, customerId, organizationCustomerId: organizationConversion.result.customerId,
      taskMeetingId: meeting.aggregateId, activityId: activity.aggregateId }, null, 2));
  } finally {
    await writeFile(testInfo.outputPath("http.json"), JSON.stringify(evidence, null, 2));
  }
});
