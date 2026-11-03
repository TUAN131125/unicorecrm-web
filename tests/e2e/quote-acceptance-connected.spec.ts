import { expect, test, type Page } from "@playwright/test";
import { writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { validateOpenApiResponse } from "../../src/platform/api/contracts/openApiRuntimeValidation";
const api = process.env.UNICORECRM_TEST_API_BASE_URL || "";
const workspace = process.env.UNICORECRM_TEST_WORKSPACE_KEY || "";
const quote = process.env.UNICORECRM_TEST_LOW_QUOTE_ID || "";
const documentId = process.env.UNICORECRM_TEST_DOCUMENT_ID || "";
const hash = process.env.UNICORECRM_TEST_DOCUMENT_SHA || "";
const directory = process.env.UNICORECRM_TEST_EVIDENCE_DIR || "";
async function login(page: Page, restricted = false) {
  await page.goto("/#/login"); const prefix = restricted ? "UNICORECRM_TEST_RESTRICTED" : "UNICORECRM_TEST";
  await page.getByLabel("Email", { exact: true }).fill(process.env[prefix + "_EMAIL"] || "");
  await page.getByLabel(/^(Mật khẩu|Password)$/u).fill(process.env[prefix + "_PASSWORD"] || "");
  await page.getByRole("button", { name: /^(Đăng nhập|Sign in)$/u }).click();
  await page.waitForURL(/#\/(?:select-workspace|w\/)/u);
  await expect(page.locator("#user-profile-dropdown")).toBeVisible();
}
async function detail(page: Page) {
  await page.goto(`/#/w/${workspace}/crm/quotes/${quote}`);
  await expect(page.locator("#quote-detail-header")).toBeVisible();
  await expect(page.locator('[data-quote-acceptance="readiness"]')).toBeVisible();
}
async function binding(page: Page) {
  const panel = page.locator('[data-quote-acceptance="readiness"]');
  await expect(panel.locator('[data-quote-acceptance="blocked"]')).toBeVisible();
  const response = page.waitForResponse(r => r.url().startsWith(`${api}/quotes/${quote}/customer-acceptance?`) && r.url().includes(documentId));
  await panel.locator("select").selectOption(documentId); const r = await response; expect(r.status()).toBe(200); const body = await r.json();
  expect(validateOpenApiResponse("getQuoteCustomerAcceptanceReadiness", body, 200)).toEqual({ valid: true, issues: [] });
  expect(body.verificationStatus).toBe("NOT_VERIFIED"); expect(body.lifecycleCommitted).toBe(false); expect(body.quoteStatus).toBe("SENT");
  await expect(panel.locator('[data-quote-acceptance="binding"]')).toContainText(hash);
  await expect(panel.locator("input[type=file]")).toHaveCount(0);
  await expect(panel.getByRole("button", { name: /^(Xác minh|Chấp nhận|Verify|Accept)$/iu })).toHaveCount(0);
  return body;
}
test("@review customer response remains unverified while exact B5 binding is inspectable", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  await login(page); await detail(page); const body = await binding(page);
  await expect(page.locator('[data-quote-customer-response="panel"]').getByText("Chưa xác minh", { exact: true })).toBeVisible();
  const downloading = page.waitForEvent("download"); await page.getByRole("button", { name: "Tải PDF đã phát hành", exact: true }).first().click();
  const file = path.join(directory, "b5-preserved.pdf"); await (await downloading).saveAs(file);
  expect(createHash("sha256").update(await readFile(file)).digest("hex").toUpperCase()).toBe(hash);
  await page.reload(); await expect(page.locator("#quote-detail-header")).toBeVisible(); await binding(page);
  await page.locator("#user-profile-dropdown").click(); await page.getByRole("menuitem", { name: /^(Đăng xuất|Sign out)$/u }).click();
  await expect(page).toHaveURL(/#\/login/u); await login(page); await detail(page); await binding(page);
  await page.screenshot({ path: path.join(directory, "readiness-blocked.png"), fullPage: true, animations: "disabled" });
  expect(errors).toEqual([]); await writeFile(path.join(directory, "review-proof.json"), JSON.stringify({ body, sha256: hash, errors }, null, 2));
});
test("@restart missing contracts remain truthful after Backend restart", async ({ page }) => {
  await login(page); await detail(page); const body = await binding(page);
  expect(body.blockerCodes).toEqual(expect.arrayContaining(["BLOCKED_CONTRACT_IDENTITY_AUTHORITY_SOURCE", "BLOCKED_CONTRACT_TRUSTED_SCANNER", "BLOCKED_CONTRACT_ACCEPTANCE_PROOF_STORAGE"]));
  await writeFile(path.join(directory, "restart-proof.json"), JSON.stringify(body, null, 2));
});
test("@restart read-only user has no proof-read permission", async ({ page }) => {
  await login(page, true); await detail(page);
  await expect(page.locator('[data-quote-acceptance="readiness"]').getByRole("alert")).toContainText(/quyền|phép|denied/iu);
  await expect(page.locator('[data-quote-acceptance="binding"]')).toHaveCount(0);
});
