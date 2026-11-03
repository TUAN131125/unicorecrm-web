import { expect, test, type Page } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { validateOpenApiResponse } from "../../src/platform/api/contracts/openApiRuntimeValidation";
const workspace = process.env.UNICORECRM_TEST_WORKSPACE_KEY || "";
const quote = process.env.UNICORECRM_TEST_LOW_QUOTE_ID || "";
const documentId = process.env.UNICORECRM_TEST_DOCUMENT_ID || "";
const proofId = process.env.UNICORECRM_TEST_CLEAN_PROOF_ID || "";
const directory = process.env.UNICORECRM_TEST_EVIDENCE_DIR || "";
async function login(page: Page, metadataOnly = false) {
  await page.goto("/#/login"); const prefix = metadataOnly ? "UNICORECRM_TEST_RESTRICTED" : "UNICORECRM_TEST";
  await page.getByLabel("Email", { exact: true }).fill(process.env[prefix + "_EMAIL"] || "");
  await page.getByLabel(/^(Mật khẩu|Password)$/u).fill(process.env[prefix + "_PASSWORD"] || "");
  await page.getByRole("button", { name: /^(Đăng nhập|Sign in)$/u }).click();
  await page.waitForURL(/#\/(?:select-workspace|w\/)/u); await expect(page.locator("#user-profile-dropdown")).toBeVisible();
}
async function detail(page: Page) {
  await page.goto(`/#/w/${workspace}/crm/quotes/${quote}`);
  await expect(page.locator("#quote-detail-header")).toBeVisible();
  await page.locator('[data-quote-acceptance="document"]').selectOption(documentId);
  await expect(page.locator('[data-quote-acceptance="binding"]')).toContainText(documentId);
  return page.locator('[data-quote-proofs="panel"]');
}
test("real CLEAN history and attachment download survive refresh and logout/login", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message)); await login(page); const panel = await detail(page);
  const proof = panel.locator('[data-quote-proofs="proof"]').filter({ hasText: proofId });
  await expect(proof).toContainText("CLEAN"); await expect(proof).toContainText(/Chưa xác minh|Unverified/u);
  const pending = page.waitForResponse(r => r.url().endsWith(`/proofs/${proofId}/scans` + "?limit=20"));
  await proof.getByRole("button", { name: /Lịch sử kiểm tra|Scan history/u }).click(); const response = await pending;
  expect(response.status()).toBe(200); const history = await response.json(); expect(validateOpenApiResponse("getQuoteAcceptanceProofScanHistory", history, 200)).toEqual({ valid: true, issues: [] });
  expect(history.items[0].status).toBe("CLEAN"); await expect(proof.locator('[data-quote-proofs="scan-history"]')).toContainText("1.5.4");
  const download = page.waitForEvent("download"); await proof.getByRole("button", { name: /Tải bằng chứng PDF|Download proof PDF/u }).click(); const file = await download;
  const saved = path.join(directory, "clean-proof-downloaded.pdf"); await file.saveAs(saved); const bytes = await readFile(saved);
  const hash = createHash("sha256").update(bytes).digest("hex").toUpperCase(); expect(hash).toBe(history.items[0].inputSha256);
  expect(await page.locator("iframe, object, embed").count()).toBe(0);
  await page.reload(); await detail(page); await expect(page.locator('[data-quote-proofs="proof"]').filter({ hasText: proofId })).toContainText("CLEAN");
  await page.locator("#user-profile-dropdown").click(); await page.getByRole("menuitem", { name: /^(Đăng xuất|Sign out)$/u }).click(); await expect(page).toHaveURL(/#\/login/u);
  await login(page); await detail(page); await expect(page.locator('[data-quote-proofs="proof"]').filter({ hasText: proofId })).toContainText("CLEAN");
  await page.screenshot({ path: path.join(directory, "clean-proof.png"), fullPage: true, animations: "disabled" });
  await writeFile(path.join(directory, "clean-proof-evidence.json"), JSON.stringify({ proofId, sha256: hash, bytes: bytes.length, history, inlineViewers: 0, pageErrors: errors }, null, 2)); expect(errors).toEqual([]);
});
test("metadata-only actor reads failed history but cannot download any proof", async ({ page }) => {
  await login(page, true); const panel = await detail(page);
  await expect(panel.locator('[data-quote-proofs="proof"]').filter({ hasText: proofId })).toContainText("CLEAN");
  await expect(panel.getByRole("button", { name: /Tải bằng chứng PDF|Download proof PDF/u })).toHaveCount(0);
  const failed = panel.locator('[data-quote-proofs="proof"]').filter({ hasText: /INVALID_PDF|UNSAFE|NEEDS_INTERVENTION/u }).first();
  await expect(failed).toBeVisible(); await failed.getByRole("button", { name: /Lịch sử kiểm tra|Scan history/u }).click();
  await expect(failed.locator('[data-quote-proofs="scan-history"]')).toContainText(/PDF_ACTIVE_OR_UNSUPPORTED_CONTENT|CLAMAV_THREAT_DETECTED|SCANNER_RUNTIME_OR_SIGNATURE_UNAVAILABLE/u);
  await page.screenshot({ path: path.join(directory, "metadata-failed-history.png"), fullPage: true, animations: "disabled" });
});
test("browser upload stays unverified while real worker scans and releases an authorized attachment", async ({ page }) => {
  const fixture = process.env.UNICORECRM_TEST_UPLOAD_PROOF_FIXTURE;
  test.skip(!fixture, "This phase requires an explicitly admitted synthetic PDF upload fixture and available case quota.");
  await login(page); const panel = await detail(page);
  await panel.getByRole("button", { name: /^(Tải lên bằng chứng|Upload proof)$/u }).click();
  const bytes = Buffer.concat([await readFile(fixture || ""), Buffer.from(`\n% SYNTHETIC CONNECTED SCANNER ${crypto.randomUUID()}\n`)]);
  await page.getByLabel(/^(PDF bằng chứng|Proof PDF)$/u).setInputFiles({ name: "browser-scan-synthetic.pdf", mimeType: "application/pdf", buffer: bytes });
  const pending = page.waitForResponse(r => r.url().endsWith("/proofs") && r.request().method() === "POST");
  await page.getByRole("button", { name: /^(Tiếp nhận tài liệu|Submit document)$/u }).click(); const response = await pending;
  expect(response.status()).toBe(201); const uploaded = await response.json();
  expect(validateOpenApiResponse("uploadQuoteAcceptanceProof", uploaded, 201)).toEqual({ valid: true, issues: [] });
  expect(uploaded.result.proof.scanStatus).toBe("SCAN_PENDING"); expect(uploaded.result.proof.contentAvailable).toBe(false);
  const proof = panel.locator('[data-quote-proofs="proof"]').filter({ hasText: uploaded.result.proof.proofId });
  await expect(proof.locator('[data-quote-proofs="scan-state"]')).toContainText(/Đạt kiểm tra an toàn kỹ thuật|Technical safety checks passed/u, { timeout: 60_000 });
  await expect(proof).toContainText(/Chưa xác minh|Unverified/u);
  const download = page.waitForEvent("download"); await proof.getByRole("button", { name: /Tải bằng chứng PDF|Download proof PDF/u }).click();
  const file = await download; const target = path.join(directory, "browser-upload-scanned.pdf"); await file.saveAs(target);
  expect(createHash("sha256").update(await readFile(target)).digest("hex").toUpperCase()).toBe(uploaded.result.proof.sha256);
  await proof.screenshot({ path: path.join(directory, "browser-upload-clean.png"), animations: "disabled" });
  await writeFile(path.join(directory, "browser-scan-upload.json"), JSON.stringify(uploaded, null, 2));
});
