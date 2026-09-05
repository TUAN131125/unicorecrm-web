import { expect, test } from "@playwright/test";

/**
 * Connected Support acceptance against a real backend.
 *
 * It proves that Support Cases carrying no Customer enrichment - the ordinary shape for a case
 * raised before any purchase evidence exists - list and render through the real UI without
 * fabricating a Customer identity and without a runtime failure.
 *
 * The Support detail and form routes are wrapped in EffectiveRecordAccessBoundary, which calls
 * `POST /access/records/evaluate`. That operation is implemented by AccessControl, so this suite
 * proves that the boundary renders an authorized record, keeps a record outside the caller's record
 * scope hidden, and honours backend field security - always from the backend decision, never from a
 * client-computed permission.
 *
 * It also proves the half that matters more: that the browser is not the security boundary. The
 * last tests bypass the UI entirely and call the Support API directly, exactly as a caller ignoring
 * the frontend would. A suite that only showed the frontend declining to issue a request would
 * prove nothing about the server.
 *
 * Requires UNICORECRM_TEST_API_BASE_URL to point at a real ApiHost seeded with at least one
 * pre-purchase Support Case, plus UNICORECRM_TEST_SUPPORT_CASE_ID (a case the signed-in member
 * owns) and UNICORECRM_TEST_FOREIGN_CASE_ID (a case owned by a different member, with an OWN
 * data-scope policy and a HIDDEN ownerId field policy in force).
 */

const apiBaseUrl = process.env.UNICORECRM_TEST_API_BASE_URL?.trim() || "";
const accessToken = process.env.UNICORECRM_TEST_ACCESS_TOKEN?.trim() || "";
const workspaceId = process.env.UNICORECRM_TEST_WORKSPACE_ID?.trim() || "";
const workspaceKey = process.env.UNICORECRM_TEST_WORKSPACE_KEY?.trim() || "unicore-demo";
const testEmail = process.env.UNICORECRM_TEST_EMAIL?.trim() || "admin@unicorecrm.local";
const testPassword = process.env.UNICORECRM_TEST_PASSWORD?.trim() || "";
const ownedCaseId = process.env.UNICORECRM_TEST_SUPPORT_CASE_ID?.trim() || "";
const foreignCaseId = process.env.UNICORECRM_TEST_FOREIGN_CASE_ID?.trim() || "";
const usesLocalFixture = apiBaseUrl.length === 0;

interface EffectiveRecordAccessResponse {
  workspaceId: string;
  resourceKey: string;
  recordId?: string;
  canRead: boolean;
  canUpdate: boolean;
  allowedCommands: string[];
  fieldAccess: Record<string, string>;
  decisionReasons: { code: string; effect: string }[];
  authority: string;
}

function waitForRecordAccess(page: import("@playwright/test").Page) {
  return page.waitForResponse((response) =>
    response.request().method() === "POST"
      && new URL(response.url()).pathname === "/access/records/evaluate");
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ token, workspace }) => {
    const runtime = { token };
    (window as typeof window & { __UNICORECRM_CONNECTED_RUNTIME__?: unknown }).__UNICORECRM_CONNECTED_RUNTIME__ = {
      getAccessToken: () => runtime.token,
      getWorkspaceId: () => workspace,
      refreshSession: () => false,
      onUnauthorized: () => undefined,
      logout: () => undefined,
      telemetry: () => undefined,
    };
  }, { token: accessToken, workspace: workspaceId });
});

async function signIn(page: import("@playwright/test").Page): Promise<string> {
  await page.goto("/#/login");
  await page.getByLabel("Email").fill(testEmail);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(testPassword);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL(/#\/(?:select-workspace|w\/[^/]+\/crm\/)/u);
  if (page.url().includes("#/select-workspace")) {
    await page.getByRole("button").filter({ hasText: workspaceKey }).click();
  }
  await expect(page).toHaveURL(/#\/w\/[^/]+\/crm\//u);
  const match = page.url().match(/#\/w\/([^/]+)/u);
  const resolved = match?.[1];
  if (!resolved) throw new Error("Workspace route segment was not resolved after sign-in.");
  return resolved;
}

test("connected Support list renders cases that carry no Customer enrichment", async ({ page }) => {
  test.setTimeout(180_000);
  test.skip(usesLocalFixture, "A real Support backend fixture is required.");

  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  const workspaceSegment = await signIn(page);

  const listResponse = page.waitForResponse((response) =>
    response.request().method() === "GET"
      && new URL(response.url()).pathname === "/support/cases");
  await page.goto(`/#/w/${workspaceSegment}/crm/support/cases`);
  const listHttp = await listResponse;
  expect(listHttp.status()).toBe(200);
  const listPayload = await listHttp.json() as {
    items: { id: string; caseNumber: string; title: string; relationshipRef?: { type: string; id: string }; customerId?: string; customerName?: string }[];
  };

  await expect(page.locator("#support-case-list-page")).toBeVisible();
  expect(listPayload.items.length).toBeGreaterThan(0);

  // The authoritative payload carries the canonical relationship and no Customer enrichment.
  for (const item of listPayload.items) {
    expect(item.relationshipRef?.id, "relationshipRef is the required canonical identity").toBeTruthy();
    expect(item.customerId, "customerId must be absent, not derived from relationshipRef").toBeUndefined();
    expect(item.customerName, "customerName must be absent, not fabricated").toBeUndefined();
  }

  const target = listPayload.items[0];
  if (!target) throw new Error("The seeded Support Case list was empty.");

  // The case renders by its Support-owned identity and title.
  await expect(page.getByRole("button", { name: target.caseNumber })).toBeVisible();
  await expect(page.getByText(target.title).first()).toBeVisible();

  // The customer label renders the neutral placeholder. Critically the page must not contain
  // the relationship identifier anywhere, which would mean the UI had substituted a Contact id
  // for a customer display name.
  const relationshipId = target.relationshipRef?.id;
  if (relationshipId) {
    await expect(page.locator("#support-case-list-page")).not.toContainText(relationshipId);
  }
  const card = page.locator("#support-case-list-page div").filter({ hasText: target.caseNumber }).last();
  await expect(card).toContainText("—");

  // ---- a real connected mutation driven from the UI ----
  // The list card carries the lifecycle control, which sits outside the record-access boundary
  // that gates the detail route, so the connected command path is genuinely exercisable here.
  const transitionResponse = page.waitForResponse((response) =>
    response.request().method() === "POST"
      && new URL(response.url()).pathname === `/support/cases/${target.id}/transition`);
  await page.getByRole("combobox", { name: `Chuyển trạng thái ${target.caseNumber}` }).selectOption("in_progress");
  const transitionHttp = await transitionResponse;
  expect(transitionHttp.status()).toBe(200);
  const transitioned = await transitionHttp.json() as {
    outcome: string;
    result: { supportCase: { status: string; customerId?: string; customerName?: string; relationshipRef?: { id: string } } };
  };
  expect(transitioned.outcome).toBe("COMMITTED");
  expect(transitioned.result.supportCase.status).toBe("in_progress");
  expect(transitioned.result.supportCase.customerId).toBeUndefined();
  expect(transitioned.result.supportCase.customerName).toBeUndefined();
  expect(transitioned.result.supportCase.relationshipRef?.id).toBe(relationshipId);
  await expect(page.locator("#support-case-list-page")).toBeVisible();

  // No runtime failure caused by the absent Customer fields.
  expect(pageErrors, `page errors: ${pageErrors.join(" | ")}`).toEqual([]);
  const customerRelatedConsoleErrors = consoleErrors.filter((text) => /customer/iu.test(text));
  expect(customerRelatedConsoleErrors, `console errors: ${customerRelatedConsoleErrors.join(" | ")}`).toEqual([]);
});

test("Support detail renders an authorized record from the backend record-access decision", async ({ page }) => {
  test.setTimeout(180_000);
  test.skip(usesLocalFixture, "A real Support backend fixture is required.");
  test.skip(ownedCaseId.length === 0, "UNICORECRM_TEST_SUPPORT_CASE_ID is required.");

  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const workspaceSegment = await signIn(page);

  const evaluation = waitForRecordAccess(page);
  await page.goto(`/#/w/${workspaceSegment}/crm/support/cases/${ownedCaseId}`);
  const evaluationHttp = await evaluation;

  // The boundary is no longer 404: the operation answers with its own contract.
  expect(evaluationHttp.status()).toBe(200);
  const decision = await evaluationHttp.json() as EffectiveRecordAccessResponse;
  expect(decision.authority, "the decision must come from the backend, not the client").toBe("backend");
  expect(decision.workspaceId).toBe(workspaceId);
  expect(decision.resourceKey).toBe("support");
  expect(decision.recordId).toBe(ownedCaseId);
  expect(decision.canRead).toBe(true);

  // Field access is reported by the authority, not computed by the browser. The seeded policy
  // withholds ownerId, which this boundary does not request, so every field it does request carries
  // no restriction - and the raw-response test below proves the withheld field really is absent.
  expect(decision.fieldAccess.subject).toBe("READ_WRITE");
  expect(decision.fieldAccess.description).toBe("READ_WRITE");

  // The rendered boundary reports the same authority it received.
  const granted = page.locator('[data-effective-access][data-resource-key="support"]');
  await expect(granted).toHaveAttribute("data-access-authority", "backend");
  await expect(granted).toHaveAttribute("data-record-id", ownedCaseId);
  await expect(page.locator("#support-case-detail-page")).toBeVisible();

  expect(pageErrors, `page errors: ${pageErrors.join(" | ")}`).toEqual([]);
});

test("Support detail stays hidden for a record outside the caller record scope", async ({ page }) => {
  test.setTimeout(180_000);
  test.skip(usesLocalFixture, "A real Support backend fixture is required.");
  test.skip(foreignCaseId.length === 0, "UNICORECRM_TEST_FOREIGN_CASE_ID is required.");

  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const workspaceSegment = await signIn(page);

  // A denied record must never trigger the Support business read behind the boundary.
  const businessReads: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === `/support/cases/${foreignCaseId}`) businessReads.push(request.url());
  });

  const evaluation = waitForRecordAccess(page);
  await page.goto(`/#/w/${workspaceSegment}/crm/support/cases/${foreignCaseId}`);
  const evaluationHttp = await evaluation;

  expect(evaluationHttp.status()).toBe(200);
  const decision = await evaluationHttp.json() as EffectiveRecordAccessResponse;
  expect(decision.authority).toBe("backend");
  expect(decision.canRead, "a record owned by another member must be denied under OWN scope").toBe(false);
  expect(decision.allowedCommands).toEqual([]);
  expect(decision.decisionReasons.some((reason) => reason.effect === "DENY")).toBe(true);

  const denied = page.locator('[data-effective-access="denied"]');
  await expect(denied).toBeVisible();
  await expect(denied).toHaveAttribute("data-access-authority", "backend");
  await expect(page.locator("#support-case-detail-page")).toHaveCount(0);
  expect(businessReads, "the denied record was read anyway").toEqual([]);

  expect(pageErrors, `page errors: ${pageErrors.join(" | ")}`).toEqual([]);
});

test("Support create form is gated by the backend resource-level decision", async ({ page }) => {
  test.setTimeout(180_000);
  test.skip(usesLocalFixture, "A real Support backend fixture is required.");

  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const workspaceSegment = await signIn(page);

  const evaluation = waitForRecordAccess(page);
  await page.goto(`/#/w/${workspaceSegment}/crm/support/cases/new`);
  const evaluationHttp = await evaluation;

  expect(evaluationHttp.status()).toBe(200);
  const decision = await evaluationHttp.json() as EffectiveRecordAccessResponse;
  expect(decision.authority).toBe("backend");
  // No record identifier is in play, so record scope is deliberately not applied and the answer is
  // the caller's resource-level capability answer.
  expect(decision.recordId).toBeUndefined();
  expect(decision.canRead).toBe(true);
  expect(decision.allowedCommands).toContain("support.create");
  expect(decision.decisionReasons.some((reason) => reason.code === "RECORD_SCOPE_NOT_EVALUATED")).toBe(true);

  await expect(page.locator('[data-effective-access][data-resource-key="support"]')).toHaveAttribute(
    "data-access-authority",
    "backend",
  );

  expect(pageErrors, `page errors: ${pageErrors.join(" | ")}`).toEqual([]);
});

test("the Support API refuses a hidden record even when the browser is bypassed", async ({ request }) => {
  test.setTimeout(120_000);
  test.skip(usesLocalFixture, "A real Support backend fixture is required.");
  test.skip(foreignCaseId.length === 0, "UNICORECRM_TEST_FOREIGN_CASE_ID is required.");

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "X-Workspace-Id": workspaceId,
    "X-Request-Id": "req-support-accept-bypass-01",
    "Content-Type": "application/json",
  };

  // The record the record-access decision hides must not be reachable by asking Support directly.
  const direct = await request.get(`${apiBaseUrl}/support/cases/${foreignCaseId}`, { headers });
  expect(direct.status(), "a hidden record must not be readable through the business API").toBe(404);
  const directBody = await direct.text();
  expect(directBody).not.toContain("Acceptance case owned by another member");

  // And it must be indistinguishable from a record that does not exist at all.
  const unknown = await request.get(`${apiBaseUrl}/support/cases/case_connected_does_not_exist`, { headers });
  expect(unknown.status()).toBe(404);
  expect(JSON.parse(directBody).code).toBe((JSON.parse(await unknown.text()) as { code: string }).code);

  // A mutation aimed at the hidden record must fail closed too, not merely be hidden from the UI.
  const mutation = await request.post(`${apiBaseUrl}/support/cases/${foreignCaseId}/transition`, {
    headers: { ...headers, "Idempotency-Key": "idem-support-accept-bypass-01", "If-Match": '"0"' },
    data: { nextStatus: "in_progress" },
  });
  expect(mutation.status(), "a hidden record must not be mutable through the business API").toBe(404);

  // The scoped list must not contain it either, and its total must not count it.
  const list = await request.get(`${apiBaseUrl}/support/cases`, { headers });
  expect(list.status()).toBe(200);
  const listed = await list.json() as {
    items: { id: string }[];
    pageInfo: { totalCount: number };
  };
  expect(listed.items.map((item) => item.id)).not.toContain(foreignCaseId);
  expect(listed.pageInfo.totalCount, "a hidden record must not inflate the total").toBe(listed.items.length);
});

test("the Support API withholds a hidden field from the raw response", async ({ request }) => {
  test.setTimeout(120_000);
  test.skip(usesLocalFixture, "A real Support backend fixture is required.");
  test.skip(ownedCaseId.length === 0, "UNICORECRM_TEST_SUPPORT_CASE_ID is required.");

  const response = await request.get(`${apiBaseUrl}/support/cases/${ownedCaseId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-Workspace-Id": workspaceId,
      "X-Request-Id": "req-support-accept-bypass-02",
    },
  });
  expect(response.status()).toBe(200);
  const raw = await response.text();

  // The seeded policy withholds ownerId. It must be absent from the bytes the server sent, not
  // merely undrawn by the browser.
  expect(raw, "a withheld field must not appear in the raw backend response").not.toContain("ownerId");
  const parsed = JSON.parse(raw) as { id: string; ownerId?: string };
  expect(parsed.id).toBe(ownedCaseId);
  expect(parsed.ownerId).toBeUndefined();
});
