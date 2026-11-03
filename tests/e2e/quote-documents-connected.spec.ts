import { validateOpenApiResponse } from "../../src/platform/api/contracts/openApiRuntimeValidation";
import { expect, test, type Page } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

const api = process.env.UNICORECRM_TEST_API_BASE_URL || "";
const workspace = process.env.UNICORECRM_TEST_WORKSPACE_KEY || "";
const directory = process.env.UNICORECRM_TEST_EVIDENCE_DIR || "";
const quoteId = process.env.UNICORECRM_TEST_LOW_QUOTE_ID || "";
async function login(page: Page, admin = false, restricted = false) {
  await page.goto("/#/login");
  const prefix = restricted ? "UNICORECRM_TEST_RESTRICTED" : admin ? "UNICORECRM_TEST_APPROVER" : "UNICORECRM_TEST";
  await page.getByLabel("Email", { exact: true }).fill(process.env[prefix + "_EMAIL"] || "");
  await page.getByLabel(/^(Mật khẩu|Password)$/u).fill(process.env[prefix + "_PASSWORD"] || "");
  const signedIn = page.waitForResponse(r => r.url() === `${api}/auth/sessions` && r.request().method() === "POST");
  await page.getByRole("button", { name: /^(Đăng nhập|Sign in)$/u }).click(); expect((await signedIn).status()).toBe(200);
  await page.waitForURL(/#\/(?:select-workspace|w\/)/u, { timeout: 30_000 });
  await expect(page.locator("#user-profile-dropdown")).toBeVisible();
}
async function logout(page: Page) {
  await page.locator("#user-profile-dropdown").click(); await page.getByRole("menuitem", { name: /^(Đăng xuất|Sign out)$/u }).click(); await expect(page).toHaveURL(/#\/login/u);
}
async function detail(page: Page) {
  await page.goto(`/#/w/${workspace}/crm/quotes/${quoteId}`);
  await expect(page.locator("#quote-detail-header")).toBeVisible();
  await expect(page.locator('[data-quote-documents="panel"]')).toBeVisible();
}
async function download(page: Page, file: string) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Tải PDF đã phát hành", exact: true }).first().click(); const downloaded = await pending;
  const output = path.join(directory, file); await downloaded.saveAs(output); const bytes = await readFile(output);
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-"); return { sha256: createHash("sha256").update(bytes).digest("hex").toUpperCase(), bytes: bytes.length, file: output };
}

test("@issue Studio seller configuration issues a durable Backend PDF without delivery", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  page.on("response", async r => { if (r.url().startsWith(api) && new URL(r.url()).pathname.endsWith("/bootstrap") && r.status() === 200) { const result = validateOpenApiResponse("getWorkspaceBootstrap", await r.json(), 200); if (!result.valid) console.log("B5_BOOTSTRAP_SCHEMA", JSON.stringify(result.issues)); } });
  page.on("response", r => { if (r.url().startsWith(api) && r.status() >= 400) console.log("B5_HTTP_FAILURE", r.request().method(), new URL(r.url()).pathname, r.status(), r.headers()["x-correlation-id"] || ""); });
  await login(page, true); await page.goto(`/#/w/${workspace}/studio/settings/business-information`);
  await expect(page.getByRole("heading", { name: "Thông tin doanh nghiệp", exact: true }).first()).toBeVisible();
  const closeSetup = page.getByRole("button", { name: "Đóng Thiết lập nhanh", exact: true });
  if (await closeSetup.isVisible()) await closeSetup.click();
  await expect(page.locator('[data-seller-document-requirements="true"]')).toBeVisible();
  await page.getByLabel("Tên hiển thị", { exact: true }).fill("SELLER SYNTHETIC B5 BROWSER");
  await page.getByLabel("Tên pháp lý", { exact: true }).fill("CÔNG TY SYNTHETIC B5 BROWSER — CHỈ KIỂM THỬ");
  await page.getByLabel("Email", { exact: true }).fill("seller-browser@example.test");
  await page.getByRole("button", { name: /^(Thêm|Add)$/u }).click();
  await page.getByLabel(/Dòng địa chỉ 1|Địa chỉ dòng 1|Address line 1/u).fill("ĐỊA CHỈ SYNTHETIC BROWSER — KHÔNG DÙNG THỰC");
  await page.getByLabel(/^(Tên địa chỉ|Address name)$/u).fill("Địa chỉ đăng ký synthetic");
  const registered = page.getByRole("checkbox", { name: /Đăng ký|Registered/u });
  await registered.locator("..").click(); await expect(registered).toBeChecked();
  const saved = page.waitForResponse(r => r.url() === `${api}/workspace-configuration/business-information` && r.request().method() === "PATCH");
  await page.getByRole("button", { name: /^(Lưu|Save)$/u }).first().click(); expect((await saved).status()).toBe(200);
  await page.screenshot({ path: path.join(directory, "studio-seller.png"), fullPage: true, animations: "disabled" });
  await logout(page); await login(page); await detail(page);
  const panel = page.locator('[data-quote-documents="panel"]'); await expect(panel.locator('[data-quote-seller="verified"]')).toContainText("SYNTHETIC");
  await expect(panel.getByRole("button", { name: "Phát hành PDF", exact: true })).toBeEnabled();
  const issue = page.waitForResponse(r => r.url() === `${api}/quotes/${quoteId}/documents/issue` && r.request().method() === "POST");
  await panel.getByRole("button", { name: "Phát hành PDF", exact: true }).click();
  await page.getByRole("button", { name: "Xác nhận phát hành", exact: true }).click();
  const response = await issue; expect(response.status()).toBe(201); const body = await response.json(); const doc = body.result.document;
  expect(body.result.quote.status).toBe("DRAFT"); expect(body.result.quote.deliveryHistory).toBeUndefined(); expect(body.result.quote.customerDecisionHistory).toBeUndefined();
  await expect(panel.locator(`[data-quote-document-id="${doc.documentId}"]`)).toBeVisible();
  await expect(panel.getByRole("button", { name: "Phát hành PDF", exact: true })).toBeDisabled();
  const first = await download(page, "browser-issued.pdf"); expect(first.sha256).toBe(doc.pdfSha256); expect(first.bytes).toBe(doc.fileSize);
  await page.reload(); await expect(panel.locator(`[data-quote-document-id="${doc.documentId}"]`)).toBeVisible();
  await logout(page); await login(page); await detail(page); const afterLogin = await download(page, "browser-after-login.pdf"); expect(afterLogin.sha256).toBe(first.sha256);
  await page.screenshot({ path: path.join(directory, "quote-issued.png"), fullPage: true, animations: "disabled" });
  expect(errors).toEqual([]); await mkdir(directory, { recursive: true }); await writeFile(path.join(directory, "issued-proof.json"), JSON.stringify({ document: doc, first, afterLogin, errors }, null, 2));
});

test("@restart downloads exactly the same issued document after Backend restart", async ({ page }) => {
  const previous = JSON.parse(await readFile(path.join(directory, "issued-proof.json"), "utf8"));
  await login(page); await detail(page); const result = await download(page, "browser-after-restart.pdf"); expect(result.sha256).toBe(previous.document.pdfSha256);
  await expect(page.locator("#quote-detail-header")).toContainText("Nháp");
  await writeFile(path.join(directory, "restart-proof.json"), JSON.stringify(result, null, 2));
});

test("@restart read-only user cannot issue and issuer cannot open Studio configuration", async ({ page }) => {
  await login(page, false, true); await detail(page);
  await expect(page.locator('[data-quote-documents="panel"]').getByRole("button", { name: "Phát hành PDF", exact: true })).toBeDisabled();
  await logout(page); await login(page); await page.goto(`/#/w/${workspace}/studio/settings/business-information`);
  await expect(page.getByText(/Bạn không có quyền|Không có quyền|Access denied|không có quyền truy cập/u).first()).toBeVisible();
});

test("@history new Quote revision keeps the original issued PDF unchanged", async ({ page }) => {
  const previous = JSON.parse(await readFile(path.join(directory, "issued-proof.json"), "utf8"));
  await login(page); await detail(page);
  await page.locator('[data-quote-lifecycle="panel"]').getByRole("button", { name: "Tạo phiên bản mới", exact: true }).click();
  const revised = page.waitForResponse(r => r.url() === `${api}/quotes/${quoteId}/revise` && r.request().method() === "POST");
  await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
  const response = await revised; expect(response.status()).toBe(201); const next = (await response.json()).result.quote;
  await expect(page).toHaveURL(new RegExp(`/quotes/${next.id}/edit`, "u"));
  await expect(page.locator("#quote-builder-page")).toBeVisible();
  await page.goto(`/#/w/${workspace}/crm/quotes/${next.id}`);
  await expect(page.locator('[data-quote-documents="panel"]')).toBeVisible();
  await expect(page.locator('[data-quote-document-id]')).toHaveCount(0);
  await detail(page); await expect(page.locator('[data-quote-revision-chain="true"] li')).toHaveCount(2);
  const result = await download(page, "browser-old-revision.pdf"); expect(result.sha256).toBe(previous.document.pdfSha256);
  await page.reload(); await expect(page.locator('[data-quote-documents="panel"]')).toBeVisible();
  await page.screenshot({ path: path.join(directory, "historical-document.png"), fullPage: true, animations: "disabled" });
  await writeFile(path.join(directory, "history-proof.json"), JSON.stringify({ nextId: next.id, originalDocumentId: previous.document.documentId, result }, null, 2));
});
