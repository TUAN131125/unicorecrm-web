import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

test("Restricted CRM reader sees current Deal and cannot configure Studio or mutate lifecycle", async ({ page }) => {
  const key = process.env.UNICORECRM_TEST_REVIEW_WORKSPACE_KEY;
  const workspaceId = process.env.UNICORECRM_TEST_REVIEW_WORKSPACE_ID;
  const dealId = process.env.UNICORECRM_TEST_REVIEW_DEAL_ID;
  const api = process.env.UNICORECRM_TEST_API_BASE_URL;
  const directory = process.env.UNICORECRM_TEST_EVIDENCE_DIR;
  expect(key).toBeTruthy(); expect(workspaceId).toBeTruthy(); expect(dealId).toBeTruthy(); expect(directory).toBeTruthy();
  if (!key || !workspaceId || !dealId || !directory || !api) throw new Error("Isolated review fixture is required");
  await mkdir(directory, { recursive: true });
  const http: Array<{ method: string; path: string; workspace?: string; status: number }> = [];
  const businessWrites: string[] = [];
  page.on("response", response => {
    if (!response.url().startsWith(`${api}/`)) return;
    const request = response.request(); const url = new URL(response.url());
    http.push({ method: request.method(), path: url.pathname, workspace: request.headers()["x-workspace-id"], status: response.status() });
    // This POST evaluates record permissions; it is an authoritative read, not a CRM mutation.
    const recordAccessRead = request.method() === "POST" && url.pathname === "/access/records/evaluate";
    if (request.method() !== "GET" && !url.pathname.startsWith("/auth/") && !recordAccessRead) businessWrites.push(`${request.method()} ${url.pathname}`);
  });
  let result = "FAIL";
  try {
    await page.goto("/#/login");
    await page.getByLabel("Email", { exact: true }).fill(process.env.UNICORECRM_TEST_EMAIL || "");
    await page.getByLabel(/^(Mật khẩu|Password)$/u).fill(process.env.UNICORECRM_TEST_PASSWORD || "");
    await page.getByRole("button", { name: /^(Đăng nhập|Sign in)$/u }).click();
    await page.waitForURL(/#\/(?:select-workspace|w\/)/u);
    const detail = `/#/w/${key}/crm/deals/${dealId}`;
    await page.goto(detail);
    await expect(page.locator("#deal-detail-header")).toContainText("Cơ hội kiểm thử lịch sử và quyền chỉ xem");
    await expect(page.locator('[data-pipeline-stage="REVIEW_FOLLOWUP"]')).toHaveAttribute("aria-current", "step");
    await expect(page.locator('[data-pipeline-stage="REVIEW_INTAKE"]')).toHaveCount(0);
    await expect(page.locator("#deal-stage-select")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^(Cập nhật giai đoạn|Update stage|Đánh dấu thắng|Mark won|Đánh dấu thua|Mark lost)$/u })).toHaveCount(0);
    await page.screenshot({ path: path.join(directory, "restricted-deal-desktop.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('[data-pipeline-stage="REVIEW_FOLLOWUP"]')).toHaveAttribute("aria-current", "step");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: path.join(directory, "restricted-deal-mobile.png"), fullPage: true });
    await page.reload();
    await expect(page.locator("#deal-detail-header")).toBeVisible();
    await expect(page.locator("#deal-stage-select")).toHaveCount(0);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/#/w/${key}/studio/settings/pipelines-statuses`);
    await expect(page.getByText(/Bạn không có quyền truy cập|You do not have access|Bạn không có quyền truy cập khu vực này/u).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /^(Thêm pipeline|Add pipeline|Lưu pipeline đã chọn|Save selected pipeline)$/u })).toHaveCount(0);
    await expect(page.getByLabel(/^(Tên tiếng Việt|Vietnamese name)$/u)).toHaveCount(0);
    await page.screenshot({ path: path.join(directory, "restricted-studio-denied.png"), fullPage: true });
    await page.goto(detail);
    await expect(page.locator("#deal-detail-header")).toBeVisible();
    expect(http.some(call => call.method === "GET" && call.path === `/deals/${dealId}` && call.status === 200 && call.workspace === workspaceId)).toBe(true);
    expect(http.some(call => call.method === "GET" && call.path === "/crm-configuration/pipelines" && call.status === 200 && call.workspace === workspaceId)).toBe(true);
    expect(businessWrites).toEqual([]);
    result = "PASS";
  } finally {
    await writeFile(path.join(directory, "restricted-role-review.json"), JSON.stringify({ result, workspaceId, dealId, businessWrites, http }, null, 2));
  }
});
