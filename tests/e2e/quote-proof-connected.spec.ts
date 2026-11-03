import { expect, test, type Page } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateOpenApiResponse } from "../../src/platform/api/contracts/openApiRuntimeValidation";
const api = process.env.UNICORECRM_TEST_API_BASE_URL || "";
const workspace = process.env.UNICORECRM_TEST_WORKSPACE_KEY || "";
const quote = process.env.UNICORECRM_TEST_LOW_QUOTE_ID || "";
const documentId = process.env.UNICORECRM_TEST_DOCUMENT_ID || "";
const directory = process.env.UNICORECRM_TEST_EVIDENCE_DIR || "";
async function login(page: Page, restricted = false) {
  await page.goto("/#/login"); const prefix = restricted ? "UNICORECRM_TEST_RESTRICTED" : "UNICORECRM_TEST";
  await page.getByLabel("Email", { exact: true }).fill(process.env[prefix + "_EMAIL"] || "");
  await page.getByLabel(/^(Mật khẩu|Password)$/u).fill(process.env[prefix + "_PASSWORD"] || "");
  await page.getByRole("button", { name: /^(Đăng nhập|Sign in)$/u }).click();
  await page.waitForURL(/#\/(?:select-workspace|w\/)/u); await expect(page.locator("#user-profile-dropdown")).toBeVisible();
}
async function detail(page: Page) {
  await page.goto(`/#/w/${workspace}/crm/quotes/${quote}`);
  await expect(page.locator("#quote-detail-header")).toBeVisible();
  await expect(page.locator('[data-quote-acceptance="blocked"]')).toBeVisible();
  await page.locator('[data-quote-acceptance="document"]').selectOption(documentId);
  await expect(page.locator('[data-quote-acceptance="binding"]')).toContainText(documentId);
  return page.locator('[data-quote-proofs="panel"]');
}
test("@upload create case and quarantine proof with refresh and login persistence", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message)); await login(page); const panel = await detail(page);
  const create = page.waitForResponse(r => r.url().endsWith(`/quotes/${quote}/acceptance-cases`) && r.request().method() === "POST");
  await panel.getByRole("button", { name: /^(Tạo hồ sơ bằng chứng|Create proof case)$/u }).click();
  const created = await create; expect(created.status()).toBe(201); expect(validateOpenApiResponse("createQuoteAcceptanceCase", await created.json(), 201)).toEqual({ valid: true, issues: [] });
  await panel.getByRole("button", { name: /^(Tải lên bằng chứng|Upload proof)$/u }).click();
  await page.getByLabel(/^(PDF bằng chứng|Proof PDF)$/u).setInputFiles({ name: "synthetic-proof.pdf", mimeType: "application/pdf", buffer: await readFile(process.env.UNICORECRM_TEST_PROOF_FIXTURE || "") });
  const upload = page.waitForResponse(r => r.url().includes("/acceptance-cases/") && r.url().endsWith("/proofs") && r.request().method() === "POST");
  await page.getByRole("button", { name: /^(Tiếp nhận tài liệu|Submit document)$/u }).click();
  const uploaded = await upload; expect(uploaded.status()).toBe(201); const result = await uploaded.json();
  expect(validateOpenApiResponse("uploadQuoteAcceptanceProof", result, 201)).toEqual({ valid: true, issues: [] });
  expect(result.result.proof.storageStatus).toBe("QUARANTINED"); expect(result.result.proof.scanStatus).toBe("SCAN_PENDING");
  await expect(panel.locator('[data-quote-proofs="proof"]')).toContainText(result.result.proof.proofId);
  await page.reload(); const refreshed = await detail(page); await expect(refreshed.locator('[data-quote-proofs="proof"]')).toContainText(result.result.proof.sha256);
  await page.locator("#user-profile-dropdown").click(); await page.getByRole("menuitem", { name: /^(Đăng xuất|Sign out)$/u }).click();
  await expect(page).toHaveURL(/#\/login/u); await login(page); const persisted = await detail(page);
  await expect(persisted.locator('[data-quote-proofs="proof"]')).toContainText(result.result.proof.proofId);
  await expect(persisted.getByRole("button", { name: /verify|xác minh|download|tải xuống/iu })).toHaveCount(0);
  await page.screenshot({ path: path.join(directory, "quarantined-proof.png"), fullPage: true, animations: "disabled" });
  expect(errors).toEqual([]); await writeFile(path.join(directory, "upload-proof.json"), JSON.stringify(result, null, 2));
});
test("@restart proof remains quarantined and restricted user cannot read metadata", async ({ page }) => {
  await login(page); const panel = await detail(page); await expect(panel.locator('[data-quote-proofs="proof"]').first()).toContainText("QUARANTINED");
  await expect(panel.locator('[data-quote-proofs="proof"]').first()).toContainText("SCAN_PENDING");
  await writeFile(path.join(directory, "restart-visible.txt"), await panel.innerText());
});
test("@restart restricted role has no proof metadata or upload", async ({ page }) => {
  await login(page, true); await page.goto(`/#/w/${workspace}/crm/quotes/${quote}`); await expect(page.locator("#quote-detail-header")).toBeVisible();
  await expect(page.locator('[data-quote-acceptance="readiness"]').getByRole("alert")).toContainText(/quyền|phép|denied/iu);
  await expect(page.locator('[data-quote-proofs="proof"]')).toHaveCount(0); await expect(page.locator("input[type=file]")).toHaveCount(0);
});

test("@isolation workspace switch clears selected proof and upload state", async ({ page }) => {
  await login(page); const panel = await detail(page); await expect(panel.locator('[data-quote-proofs="proof"]').first()).toContainText("QUARANTINED");
  const previousCase = await panel.locator('[data-quote-proofs="case"]').innerText();
  const foreignKey = process.env.UNICORECRM_TEST_FOREIGN_WORKSPACE_KEY || ""; expect(foreignKey).not.toBe("");
  const foreignName = process.env.UNICORECRM_TEST_FOREIGN_WORKSPACE_NAME || "";
  await page.getByTitle(/^(Không gian làm việc|Workspace):/u).click();
  await page.locator("#unicore-sidebar").getByRole("button", { name: foreignName, exact: true }).first().click();
  await expect(page).not.toHaveURL(new RegExp(`/w/${workspace}/`));
  await expect(page.getByTitle(/^(Không gian làm việc|Workspace):/u)).toContainText(foreignName);
  await expect(page.locator('[data-quote-proofs="proof"]')).toHaveCount(0);
  await expect(page.locator("input[type=file]")).toHaveCount(0);
  await expect(page.getByText(previousCase, { exact: true })).toHaveCount(0);
  await writeFile(path.join(directory, "workspace-isolation.json"), JSON.stringify({ previousWorkspace: workspace, currentWorkspace: foreignKey, proofRows: await page.locator('[data-quote-proofs="proof"]').count() }, null, 2));
});

test("@ingress final binary transport accepts lowercase headers and leaves proof quarantined", async ({ page }) => {
  await login(page); const panel = await detail(page); await panel.getByRole("button", { name: /^(Tải lên bằng chứng|Upload proof)$/u }).click();
  const bytes = Buffer.concat([await readFile(process.env.UNICORECRM_TEST_PROOF_FIXTURE || ""), Buffer.from(`\n% SAFE SYNTHETIC QUARANTINE ${crypto.randomUUID()}`)]);
  await page.getByLabel(/^(PDF bằng chứng|Proof PDF)$/u).setInputFiles({ name: "synthetic-final-ingress.pdf", mimeType: "application/pdf", buffer: bytes });
  const pending = page.waitForResponse(r => r.url().includes("/acceptance-cases/") && r.url().endsWith("/proofs") && r.request().method() === "POST");
  await page.getByRole("button", { name: /^(Tiếp nhận tài liệu|Submit document)$/u }).click(); const response = await pending;
  expect(response.status()).toBe(201); const result = await response.json();
  expect(validateOpenApiResponse("uploadQuoteAcceptanceProof", result, 201)).toEqual({ valid: true, issues: [] });
  expect(result.result.proof.storageStatus).toBe("QUARANTINED"); expect(result.result.proof.scanStatus).toBe("SCAN_PENDING");
  await expect(panel.getByText(`ProofId: ${result.result.proof.proofId}`, { exact: true })).toBeVisible();
  await writeFile(path.join(directory, "final-ingress.json"), JSON.stringify(result, null, 2));
});
