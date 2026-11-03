import { expect, test, type Page, type Locator } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import type { DealPipelineDocument, SaveDealPipelineRequest } from "../../src/platform/api/generated/crmConfigurationApi";

const controlKey = process.env.UNICORECRM_TEST_CONTROL_WORKSPACE_KEY || "unicore-demo-anh-duong-control";
const controlId = process.env.UNICORECRM_TEST_CONTROL_WORKSPACE_ID || "ws_811689cfc4b446eab4f29dc109e2abf2";
const alternateKey = process.env.UNICORECRM_TEST_ALTERNATE_WORKSPACE_KEY || "unicore-demo-anh-duong";
const alternateId = process.env.UNICORECRM_TEST_ALTERNATE_WORKSPACE_ID || "ws_f2332a12d56a421d8a722bd2f65c5efb";
const controlName = process.env.UNICORECRM_TEST_CONTROL_WORKSPACE_NAME || "UniCoreCRM Demo - Kiểm tra cô lập";
const alternateName = process.env.UNICORECRM_TEST_ALTERNATE_WORKSPACE_NAME || "UniCoreCRM Demo - Công ty Ánh Dương";
const api = process.env.UNICORECRM_TEST_API_BASE_URL || "";
const buyerId = process.env.UNICORECRM_TEST_BUYER_ID || "";
const directory = process.env.UNICORECRM_TEST_EVIDENCE_DIR || path.join(os.tmpdir(), "unicorecrm-deal-pipeline-connected");
const route = (key: string, suffix: string) => `/#/w/${key}/${suffix}`;

async function login(page: Page) {
  await page.goto("/#/login");
  await page.getByLabel("Email", { exact: true }).fill(process.env.UNICORECRM_TEST_EMAIL || "");
  await page.getByLabel(/^(Mật khẩu|Password)$/u).fill(process.env.UNICORECRM_TEST_PASSWORD || "");
  await page.getByRole("button", { name: /^(Đăng nhập|Sign in)$/u }).click();
  await page.waitForURL(/#\/(?:select-workspace|w\/)/u);
}
function responseFor(page: Page, method: string, suffix: string) {
  return page.waitForResponse(response => response.url() === `${api}${suffix}` && response.request().method() === method);
}
async function selectChoice(page: Page, control: Locator, value: string, label: string | RegExp) {
  await expect(control).toBeVisible();
  if (await control.evaluate(element => element.tagName === "SELECT")) {
    await control.selectOption(value);
    return;
  }
  await control.click();
  // SearchableSelect renders its listbox in a portal outside the form dialog.
  await page.getByRole("listbox").getByRole("option", { name: label, exact: true }).click();
}
async function editStage(page: Page, code: string, vi: string, en: string) {
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/^(Tên tiếng Việt|Vietnamese name)$/u).fill(vi);
  await dialog.getByLabel(/^(Tên tiếng Anh|English name)$/u).fill(en);
  await dialog.getByLabel(/Mã ổn định|Stable code/u).fill(code);
  await dialog.getByRole("button", { name: /^(Hoàn tất|Done)$/u }).click();
}

test("Control workspace pipelines persist custom stages and isolate Deal Kanban/detail", async ({ page }) => {
  expect(controlId).not.toBe(alternateId);
  expect(controlKey).not.toBe(alternateKey);
  expect(controlKey).toContain("control");
  await mkdir(directory, { recursive: true });
  const prefix = `Pipeline acceptance ${Date.now()}`;
  const name = `${prefix} control`;
  const renamed = `${prefix} renamed`;
  const dealName = `${prefix} opportunity`;
  const firstCode = "PROPOSAL";
  const secondCode = "ACCEPTANCE_REVIEW";
  const firstLabel = `${prefix} đánh giá`;
  const secondLabel = `${prefix} xem xét giải pháp và yêu cầu mua hàng dài`;
  const http: Array<{ method: string; path: string; query: string; status: number; workspace?: string }> = [];
  const checks: string[] = [];
  let pipelineId = "";
  let dealId = "";
  let authHeaders: Record<string, string> = {};
  let result = "FAIL";
  page.on("response", response => {
    if (!response.url().startsWith(`${api}/`)) return;
    const url = new URL(response.url());
    const headers = response.request().headers();
    http.push({ method: response.request().method(), path: url.pathname, query: url.search, status: response.status(), workspace: headers["x-workspace-id"] });
    if (headers["x-workspace-id"] === controlId && headers.authorization) {
      authHeaders = { authorization: headers.authorization, "x-workspace-id": controlId };
    }
  });
  const requestMetadata = () => ({ ...authHeaders, "x-request-id": randomUUID(), "x-correlation-id": randomUUID() });
  const saveSelected = () => page.getByRole("button", { name: /^(Lưu pipeline đã chọn|Save selected pipeline)$/u });
  const readPipeline = async () => {
    const response = await page.request.get(`${api}/crm-configuration/pipelines/${pipelineId}`, { headers: requestMetadata() });
    expect(response.status()).toBe(200);
    const value = await response.json() as DealPipelineDocument;
    expect(value.workspaceId).toBe(controlId);
    return value;
  };
  async function setStudioDefault(pipeline: DealPipelineDocument) {
    await page.goto(route(controlKey, "studio/settings/pipelines-statuses"));
    await page.getByRole("button").filter({ hasText: pipeline.nameVi }).first().click();
    await expect(page.getByLabel(/^(Tên tiếng Việt|Vietnamese name)$/u)).toHaveValue(pipeline.nameVi);
    const toggle = page.getByRole("switch", { name: /^(Pipeline mặc định|Default pipeline)$/u });
    if (await toggle.getAttribute("aria-checked") !== "true") {
      await toggle.click();
      const saved = responseFor(page, "PATCH", `/crm-configuration/pipelines/${pipeline.id}`);
      await saveSelected().click();
      const response = await saved;
      expect(response.status()).toBe(200);
      const value = (await response.json()) as { pipeline: DealPipelineDocument };
      expect(value.pipeline.id).toBe(pipeline.id);
      expect(value.pipeline.workspaceId).toBe(controlId);
      expect(value.pipeline.isDefault).toBe(true);
      await expect(saveSelected()).toBeDisabled();
    }
  }
  async function assertDetail() {
    await expect(page.locator("#deal-detail-header")).toContainText(dealName);
    await expect(page.getByText(`Pipeline: ${renamed}`, { exact: true })).toBeVisible();
    await expect(page.locator("[data-pipeline-stage-count]")).toHaveAttribute("data-pipeline-stage-count", "2");
    expect(await page.locator("[data-pipeline-stage]").evaluateAll(elements => elements.map(element => element.getAttribute("data-pipeline-stage")))).toEqual([secondCode, firstCode]);
    await expect(page.locator(`[data-pipeline-stage="${secondCode}"]`)).toHaveAttribute("aria-current", "step");
  }
  try {
    await login(page);
    await page.goto(route(controlKey, "studio/settings/pipelines-statuses"));
    await expect(page.getByRole("heading", { name: /Pipeline & trạng thái|Pipelines & statuses/u })).toBeVisible();
    await expect(page.getByRole("button", { name: /^(Thêm pipeline|Add pipeline)$/u }).first()).toBeEnabled();
    await page.getByRole("button", { name: /^(Thêm pipeline|Add pipeline)$/u }).first().click();
    await page.getByLabel(/^(Tên tiếng Việt|Vietnamese name)$/u).fill(name);
    await page.getByLabel(/^(Tên tiếng Anh|English name)$/u).fill(name);
    await page.locator("article").filter({ hasText: "STAGE_10" }).getByRole("button", { name: /^(Cấu hình|Configure)$/u }).click();
    await editStage(page, firstCode, firstLabel, `${prefix} assessment`);
    await page.getByRole("button", { name: /^(Thêm|Add)$/u }).click();
    await editStage(page, secondCode, secondLabel, `${prefix} long solution review with purchasing decision makers`);
    const createdResponse = responseFor(page, "POST", "/crm-configuration/pipelines");
    await saveSelected().click();
    const createdHttp = await createdResponse;
    expect(createdHttp.status()).toBe(201);
    expect(createdHttp.request().headers()["x-workspace-id"]).toBe(controlId);
    const headers = createdHttp.request().headers();
    authHeaders = { authorization: headers.authorization || "", "x-workspace-id": controlId };
    expect(authHeaders.authorization).toMatch(/^Bearer /u);
    pipelineId = ((await createdHttp.json()) as { pipeline: DealPipelineDocument }).pipeline.id;
    await expect(page.getByRole("status").filter({ hasText: /đã được máy chủ lưu|server saved/u }).first()).toBeVisible();
    let current = await readPipeline();
    expect(current.stages.map(stage => stage.code)).toContain(firstCode);
    checks.push("Created a complete custom pipeline through Studio; authoritative GET confirms control workspace");

    await page.getByLabel(/^(Tên tiếng Việt|Vietnamese name)$/u).fill(renamed);
    await page.getByLabel(/^(Tên tiếng Anh|English name)$/u).fill(renamed);
    for (let index = 0; index < 3; index += 1) {
      await page.locator("article").filter({ hasText: secondCode }).getByRole("button", { name: /^(Di chuyển lên|Move up)$/u }).click();
    }
    const updatedResponse = responseFor(page, "PATCH", `/crm-configuration/pipelines/${pipelineId}`);
    await saveSelected().click();
    const updatedHttp = await updatedResponse;
    expect(updatedHttp.status()).toBe(200);
    expect(updatedHttp.request().headers()["if-match"]).toBe(`"${current.resourceVersion}"`);
    current = await readPipeline();
    expect(current.nameVi).toBe(renamed);
    expect(current.stages.filter(stage => stage.category === "OPEN").map(stage => stage.code)).toEqual([secondCode, firstCode]);
    await page.reload();
    await page.getByRole("button").filter({ hasText: renamed }).first().click();
    await expect(page.getByLabel(/^(Tên tiếng Việt|Vietnamese name)$/u)).toHaveValue(renamed);
    checks.push("Rename and custom stage reorder survive server readback and browser reload");

    const registryResponse = await page.request.get(`${api}/crm-configuration/pipelines`, { headers: requestMetadata() });
    expect(registryResponse.status()).toBe(200);
    const registry = (await registryResponse.json()) as { items: DealPipelineDocument[] };
    const originalDefault = registry.items.find(item => item.isDefault && item.isActive);
    expect(originalDefault, "the Workspace has one authoritative default to restore after creation").toBeTruthy();
    if (!originalDefault) throw new Error("Missing Workspace default fixture");
    const otherPipeline = registry.items.find(item => item.id !== pipelineId && item.stages.some(stage => stage.code === firstCode && stage.requiresPositiveAmount));
    expect(otherPipeline, "a different pipeline must exercise the conflicting same-code policy").toBeTruthy();
    if (!otherPipeline) throw new Error("Missing conflicting pipeline fixture");
    expect(current.stages.find(stage => stage.code === firstCode)?.requiresPositiveAmount).toBe(false);
    expect(otherPipeline.stages.find(stage => stage.code === firstCode)?.requiresPositiveAmount).toBe(true);
    await setStudioDefault(current);
    await page.goto(route(controlKey, "crm/deals?view=kanban"));
    await expect(page.locator('#deals-kanban-section')).toHaveAttribute("data-deal-default-pipeline", pipelineId);
    await expect(page.locator('[data-guidance-id="deals.pipeline.workspace"]')).toContainText(renamed);
    await expect(page.locator('[data-guidance-id="deals.pipeline.selector"]')).toHaveCount(0);
    await page.getByRole("button", { name: /^(Thêm Cơ hội|Add Deal|Add opportunity)$/u }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator("#deal-create-pipeline")).toHaveAttribute("readonly", "");
    await expect(dialog.locator("#deal-create-pipeline")).toHaveValue(renamed);
    await dialog.locator("#deal-create-name").fill(dealName);
    await dialog.locator("#deal-buyer-search").fill(process.env.UNICORECRM_TEST_BUYER_SEARCH || "");
    await dialog.locator('[data-guidance-id="deals.form.buyer"] button').filter({ hasText: buyerId }).click();
    await dialog.locator("#deal-create-amount").fill("0");
    await dialog.locator("#deal-create-expectedCloseDate").click();
    const calendar = page.locator('[data-temporal-picker="true"]');
    await calendar.getByRole("button", { name: /^(Tháng sau|Next month)$/u }).click();
    await calendar.getByRole("button").filter({ hasText: /^15$/u }).click();
    await calendar.getByRole("button", { name: /^(Áp dụng|Apply)$/u }).click();
    await dialog.locator("#deal-create-demandSummary").fill("Synthetic control opportunity for custom pipeline verification");
    await selectChoice(page, dialog.locator("#deal-create-stage"), firstCode, new RegExp(`^${prefix} (đánh giá|assessment)$`, "u"));
    await dialog.locator("#deal-create-probability").fill("17");
    const createDealResponse = responseFor(page, "POST", "/deals");
    await dialog.getByRole("button", { name: /^(Tạo cơ hội|Create opportunity)$/u }).click();
    const dealHttp = await createDealResponse;
    expect(dealHttp.status()).toBe(201);
    const submitted = dealHttp.request().postDataJSON() as { pipelineId?: string; amount: { amount: string; currency: string } };
    expect(submitted).not.toHaveProperty("pipelineId");
    expect(submitted.amount.amount).toBe("0");
    const createdDeal = (await dealHttp.json()).result.deal as { id: string; pipelineId: string; stageCode: string; amount: { amount: string; currency: string } };
    dealId = createdDeal.id;
    expect(createdDeal.pipelineId).toBe(pipelineId);
    expect(createdDeal.stageCode).toBe(firstCode);
    expect(createdDeal.amount.currency).toBe(submitted.amount.currency);
    await expect(page.locator(`[data-deal-kanban-column="${firstCode}"]`)).toContainText(dealName);
    checks.push("Studio-saved Workspace default owns creation: readonly form and omitted pipelineId; custom PROPOSAL permits zero under its own policy and preserves currency despite a conflicting same-code pipeline");
    await setStudioDefault(originalDefault);
    await page.goto(route(controlKey, "crm/deals?view=kanban"));
    await expect(page.locator('#deals-kanban-section')).toHaveAttribute("data-deal-default-pipeline", originalDefault.id);
    const assignedBoard = page.locator(`[data-deal-assigned-pipeline="${pipelineId}"]`);
    await expect(assignedBoard.locator(`[data-deal-assigned-stage="${firstCode}"]`)).toContainText(dealName);
    await expect(page.locator('#deals-kanban-section')).not.toContainText(dealName);
    checks.push("Restoring the prior Studio default preserves the existing Deal in its assigned read-only board and does not migrate it");
    await page.goto(route(controlKey, `crm/deals/${dealId}`));
    await expect(page.locator("#deal-detail-header")).toContainText(dealName);
    await page.locator("#deal-stage-select").selectOption(secondCode);
    const stageResponse = responseFor(page, "POST", `/deals/${dealId}/change-stage`);
    await page.getByRole("button", { name: /^(Cập nhật giai đoạn|Update stage)$/u }).click();
    expect((await stageResponse).status()).toBe(200);
    checks.push("Created synthetic Deal and moved it between custom OPEN stages through actual UI commands");

    for (const [label, width, height] of [["desktop", 1440, 900], ["laptop", 1366, 768], ["tablet", 768, 1024], ["mobile", 390, 844]] as const) {
      await page.setViewportSize({ width, height });
      await assertDetail();
      await page.locator("#deal-detail-header").evaluate(element => { for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) ancestor.scrollTop = 0; });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: path.join(directory, `custom-pipeline-${label}.png`), fullPage: true });
    }
    await page.reload();
    await assertDetail();
    await page.setViewportSize({ width: 1440, height: 900 });
    const sidebar = page.locator("#unicore-sidebar");
    await sidebar.getByRole("button", { name: controlName, exact: true }).click();
    await sidebar.getByRole("button", { name: alternateName, exact: true }).click();
    await page.waitForURL(new RegExp(`/w/${alternateKey}/`, "u"));
    await sidebar.getByRole("link", { name: /^(Cơ hội|Deals)$/u }).click();
    await page.waitForURL(/\/crm\/deals(?:\?|$)/u);
    await expect(page.locator(`[data-deal-assigned-pipeline="${pipelineId}"]`)).toHaveCount(0);
    await expect(page.locator('[data-guidance-id="deals.pipeline.workspace"]')).not.toContainText(renamed);
    await expect(page.getByText(dealName, { exact: true })).toHaveCount(0);
    await page.goto(route(alternateKey, `crm/deals/${dealId}`));
    await expect(page.locator("#deal-detail-header")).toHaveCount(0);
    await expect(page.getByText(/Không thể xác minh quyền truy cập|Bạn không có quyền xem bản ghi này|Không thể tải cơ hội|could not be verified|cannot access|could not load/iu).first()).toBeVisible();
    await page.goto(route(controlKey, `crm/deals/${dealId}`));
    await assertDetail();
    await page.locator("#user-profile-dropdown").click();
    await page.getByRole("menuitem", { name: /^(Đăng xuất|Sign out)$/u }).click();
    await expect(page).toHaveURL(/#\/login/u);
    await login(page);
    await page.goto(route(controlKey, `crm/deals/${dealId}`));
    await assertDetail();
    checks.push("Four viewport sizes, refresh, logout/login and real workspace navigation preserve dynamic pipeline and isolation");

    // These are real API rejection probes scoped to the pipeline created above; no response mocking.
    current = await readPipeline();
    const validBody: SaveDealPipelineRequest = {
      nameVi: current.nameVi, nameEn: current.nameEn, description: current.description, isActive: current.isActive, isDefault: current.isDefault,
      stages: current.stages.map(stage => ({ id: stage.id, code: stage.code, labelVi: stage.labelVi, labelEn: stage.labelEn, order: stage.order, category: stage.category, defaultProbability: stage.defaultProbability, color: stage.color, isActive: stage.isActive })),
    };
    const problems: Array<{ scenario: string; status: number; code: string }> = [];
    for (const [scenario, expectedStatus, version, body] of [
      ["stale-version", 412, 0, validBody],
      ["invalid-code", 422, current.resourceVersion, { ...validBody, stages: validBody.stages.map((stage, index) => index === 0 ? { ...stage, code: "invalid-code!" } : stage) }],
      ["referenced-stage", 409, current.resourceVersion, { ...validBody, stages: validBody.stages.filter(stage => stage.code !== secondCode) }],
    ] as const) {
      const response = await page.request.patch(`${api}/crm-configuration/pipelines/${pipelineId}`, { headers: { ...requestMetadata(), "if-match": `"${version}"`, "idempotency-key": `${prefix}-${scenario}` }, data: body });
      expect(response.status()).toBe(expectedStatus);
      expect(response.headers()["content-type"]).toContain("application/problem+json");
      const problem = await response.json() as { code: string; status: number; correlationId: string; fieldErrors?: unknown };
      expect(problem.status).toBe(expectedStatus);
      expect(problem.correlationId).toBeTruthy();
      expect(problem.code).toBe(scenario === "stale-version" ? "VERSION_CONFLICT" : scenario === "referenced-stage" ? "PIPELINE_STAGE_IN_USE" : "VALIDATION_FAILED");
      if (scenario !== "stale-version") expect(problem.fieldErrors).toBeTruthy();
      problems.push({ scenario, status: problem.status, code: problem.code });
    }
    await writeFile(path.join(directory, "pipeline-problems.json"), JSON.stringify(problems, null, 2));
    const configWrites = http.filter(call => call.method !== "GET" && (/^\/crm-configuration\/pipelines/u.test(call.path) || /^\/deals(?:\/|$)/u.test(call.path)));
    expect(configWrites.every(call => call.workspace === controlId)).toBe(true);
    expect(http.some(call => call.method === "GET" && call.path === "/deals" && new URLSearchParams(call.query).get("pipelineId") === pipelineId)).toBe(true);
    result = "PASS";
  } finally {
    await writeFile(path.join(directory, "pipeline-connected-results.json"), JSON.stringify({ result, pipelineId, dealId, controlId, alternateId, checks, http }, null, 2));
  }
});

test("Read-only visual matrix uses real small large inactive and terminal pipeline records", async ({ page }) => {
  await mkdir(directory, { recursive: true });
  const viewports = [["desktop", 1440, 900], ["laptop", 1366, 768], ["tablet", 768, 1024], ["mobile", 390, 844]] as const;
  const rows: Array<{ scenario: string; status: string; reason?: string; pipelineId?: string; dealId?: string; totalStages?: number; openStages?: number }> = [];
  const writes: string[] = [];
  let authorization = "";
  page.on("request", request => {
    if (!request.url().startsWith(`${api}/`)) return;
    const headers = request.headers();
    if (headers.authorization) authorization = headers.authorization;
    if (request.method() !== "GET" && /^\/(?:deals(?:\/|$)|crm-configuration\/pipelines(?:\/|$))/u.test(new URL(request.url()).pathname)) writes.push(request.method() + " " + new URL(request.url()).pathname);
  });
  const headers = (workspaceId: string) => ({ authorization, "x-workspace-id": workspaceId, "x-request-id": randomUUID(), "x-correlation-id": randomUUID() });
  const get = async <T,>(workspaceId: string, suffix: string): Promise<T> => {
    const response = await page.request.get(`${api}${suffix}`, { headers: headers(workspaceId) });
    expect(response.status()).toBe(200);
    return await response.json() as T;
  };
  type ExistingDeal = { id: string; name: string; pipelineId: string; stageCode: string; stageCategory: "OPEN" | "WON" | "LOST" };
  const deals = async (workspaceId: string, pipelineId?: string, category?: string) => {
    const query = new URLSearchParams({ limit: "250", ...(pipelineId ? { pipelineId } : {}), ...(category ? { stageCategory: category } : {}) });
    return (await get<{ items: ExistingDeal[] }>(workspaceId, `/deals?${query}`)).items;
  };
  async function capture(scenario: string, key: string, pipeline: DealPipelineDocument, deal?: ExistingDeal) {
    const expectedOpen = pipeline.stages.filter(stage => stage.category === "OPEN" && (stage.isActive || stage.code === deal?.stageCode));
    for (const [label, width, height] of viewports) {
      await page.setViewportSize({ width, height });
      await page.goto(route(key, "crm/deals?view=kanban"));
      await expect(page.locator("#deal-pipeline-page")).toBeVisible();
      const board = pipeline.isDefault
        ? page.locator(`#deals-kanban-section[data-deal-default-pipeline="${pipeline.id}"]`)
        : page.locator(`[data-deal-assigned-pipeline="${pipeline.id}"]`);
      const columns = pipeline.isDefault ? "[data-deal-kanban-column]" : "[data-deal-assigned-stage]";
      await expect(board).toBeVisible();
      await expect(board.locator(columns)).toHaveCount(pipeline.stages.length);
      await expect(page.locator('[data-guidance-id="deals.pipeline.selector"]')).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: path.join(directory, `matrix-${scenario}-kanban-${label}.png`), fullPage: true });
      await page.goto(route(key, deal ? `crm/deals/${deal.id}` : "crm/deals?view=kanban"));
      if (deal) {
        await expect(page.locator("#deal-detail-header")).toContainText(deal.name);
        await expect(page.locator("[data-pipeline-stage-count]")).toHaveAttribute("data-pipeline-stage-count", String(expectedOpen.length));
        expect(await page.locator("[data-pipeline-stage]").evaluateAll(elements => elements.map(element => element.getAttribute("data-pipeline-stage")))).toEqual(expectedOpen.sort((left, right) => left.order - right.order).map(stage => stage.code));
        if (deal.stageCategory !== "OPEN") {
          await expect(page.locator(`[data-deal-outcome="${deal.stageCategory.toLowerCase()}"]`)).toBeVisible();
          await expect(page.locator("#deal-stage-select")).toHaveCount(0);
        }
        await page.locator("#deal-detail-header").evaluate(element => { for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) ancestor.scrollTop = 0; });
      } else {
        await expect(page.locator("#deal-pipeline-page")).toBeVisible();
        await expect(board).toBeVisible();
        await expect(board.locator(columns)).toHaveCount(pipeline.stages.length);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: path.join(directory, `matrix-${scenario}-${label}.png`), fullPage: true });
    }
    rows.push({ scenario, status: deal ? "PASS_DETAIL" : "PASS_KANBAN", pipelineId: pipeline.id, ...(deal ? { dealId: deal.id } : {}), totalStages: pipeline.stages.length, openStages: expectedOpen.length });
  }
  try {
    await login(page);
    await page.goto(route(controlKey, "studio/settings/pipelines-statuses"));
    await expect(page.getByRole("heading", { name: /Pipeline & trạng thái|Pipelines & statuses/u })).toBeVisible();
    await expect.poll(() => Boolean(authorization)).toBe(true);
    const control = (await get<{ items: DealPipelineDocument[] }>(controlId, "/crm-configuration/pipelines")).items;
    const demo = (await get<{ items: DealPipelineDocument[] }>(alternateId, "/crm-configuration/pipelines")).items;
    expect(control.filter(pipeline => pipeline.isDefault && pipeline.isActive)).toHaveLength(1);
    expect(demo.filter(pipeline => pipeline.isDefault && pipeline.isActive)).toHaveLength(1);
    const few = control.find(pipeline => pipeline.stages.length === 3 && pipeline.stages.some(stage => stage.code === "RETENTION"));
    expect(few, "existing RETENTION pipeline has three total stages").toBeTruthy();
    const many = demo.find(pipeline => pipeline.stages.filter(stage => stage.category === "OPEN").length === 5);
    expect(many, "existing demo pipeline has five OPEN stages").toBeTruthy();
    const advisory = control.find(pipeline => pipeline.id === (process.env.UNICORECRM_TEST_ADVISORY_PIPELINE_ID || "pipeline_bcce9f1d07f145cf9bf2c0beecd51fce"));
    expect(advisory, "existing ADVISORY fixture is available").toBeTruthy();
    if (!few || !many || !advisory) throw new Error("Required authoritative visual fixtures are unavailable");
    expect(advisory.stages.length).toBe(8);
    for (const [scenario, key, workspaceId, pipeline] of [["few-retention", controlKey, controlId, few], ["five-open-demo", alternateKey, alternateId, many], ["eight-total-advisory", controlKey, controlId, advisory]] as const) {
      const records = await deals(workspaceId, pipeline.id, "OPEN");
      await capture(scenario, key, pipeline, records[0]);
      if (!records[0]) rows.push({ scenario: `${scenario}-detail`, status: "BLOCKED", reason: "No existing OPEN Deal is assigned to this pipeline; read-only matrix does not create one." });
    }
    const inactivePipeline = control.find(pipeline => pipeline.stages.some(stage => stage.code === "RACE_OPEN" && !stage.isActive));
    expect(inactivePipeline, "concurrency fixture retains inactive RACE_OPEN").toBeTruthy();
    if (inactivePipeline) {
      for (const [label, width, height] of viewports) {
        await page.setViewportSize({ width, height });
        await page.goto(route(controlKey, "studio/settings/pipelines-statuses"));
        await page.getByRole("button").filter({ hasText: inactivePipeline.nameVi }).first().click();
        await expect(page.locator("article").filter({ hasText: "RACE_OPEN" })).toContainText(/Tạm ẩn|Inactive/u);
        await page.screenshot({ path: path.join(directory, `matrix-inactive-unused-${label}.png`), fullPage: true });
      }
      rows.push({ scenario: "inactive-unused-race-open", status: "PASS_STUDIO", pipelineId: inactivePipeline.id });
    }
    const demoLost = (await deals(alternateId, undefined, "LOST"))[0];
    expect(demoLost, "existing demo LOST Deal is required").toBeTruthy();
    if (demoLost) {
      const pipeline = demo.find(value => value.id === demoLost.pipelineId);
      expect(pipeline).toBeTruthy();
      if (pipeline) await capture("lost", alternateKey, pipeline, demoLost);
    }
    const won = (await deals(alternateId, undefined, "WON"))[0];
    if (won) {
      const pipeline = demo.find(value => value.id === won.pipelineId);
      if (pipeline) await capture("won", alternateKey, pipeline, won);
    } else rows.push({ scenario: "won", status: "BLOCKED", reason: "No existing WON Deal; verified Quote/evidence writes are blocked. No fabricated lifecycle or SQL data." });
    let historical = false;
    for (const [key, workspaceId, pipelines] of [[controlKey, controlId, control], [alternateKey, alternateId, demo]] as const) {
      for (const pipeline of pipelines.filter(value => value.stages.some(stage => !stage.isActive))) {
        const record = (await deals(workspaceId, pipeline.id)).find(value => pipeline.stages.some(stage => stage.code === value.stageCode && !stage.isActive));
        if (record) { await capture("historical-inactive", key, pipeline, record); historical = true; break; }
      }
      if (historical) break;
    }
    if (!historical) rows.push({ scenario: "historical-inactive-deal", status: "BLOCKED", reason: "No existing Deal references an inactive stage; backend rejects deactivation of referenced stages. Read-only verification cannot manufacture that history." });
    expect(writes).toEqual([]);
  } finally {
    await writeFile(path.join(directory, "pipeline-visual-matrix.json"), JSON.stringify({ rows, businessWrites: writes }, null, 2));
  }
});
