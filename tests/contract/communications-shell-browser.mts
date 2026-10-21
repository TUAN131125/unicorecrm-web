import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { validateOpenApiResponse } from "../../src/platform/api/contracts/openApiRuntimeValidation";

const config = JSON.parse(process.env.COM_FIXTURE ?? "null") as { url: string; controlKey: string; telegramId?: number } | null;
assert.ok(config, "Requires disposable SQL verifier host");
const artifacts = process.env.COMMUNICATIONS_VERIFICATION_ARTIFACTS ?? path.resolve("../../review-artifacts/communications-com2c-manual-crm-linking-20261016");
await mkdir(artifacts, { recursive: true });
process.env.VITE_RUNTIME_MODE = "connected";
process.env.VITE_AUTH_ADAPTER = "connected";
process.env.VITE_API_BASE_URL = config.url;
const server = await createServer({ envFile: false, server: { host: "127.0.0.1", port: 0, hmr: false, watch: null },
  define: { "import.meta.env.VITE_RUNTIME_MODE": '"connected"', "import.meta.env.VITE_AUTH_ADAPTER": '"connected"',
    "import.meta.env.VITE_API_BASE_URL": JSON.stringify(config.url) } });
await server.listen();
const address = server.httpServer?.address();
assert.ok(address && typeof address !== "string");
const browser = await chromium.launch({ headless: true }).catch(async error => { await server.close(); throw error; });
const context = await browser.newContext();
const page = await context.newPage();
const observations: string[] = [];
page.on("response", async response => {
  if (response.url().startsWith(config.url)) observations.push(`${response.request().method()} ${new URL(response.url()).pathname} ${response.status()}`);
  if (new URL(response.url()).pathname === "/auth/sessions" && response.status() === 200)
    observations.push(`SIGN_IN_CONTRACT ${JSON.stringify(validateOpenApiResponse("signIn", await response.json(), 200))}`);
});
page.on("pageerror", error => observations.push(`PAGE_ERROR ${error.message}`));
page.on("requestfailed", request => observations.push(`REQUEST_FAILED ${new URL(request.url()).origin}${new URL(request.url()).pathname} ${request.failure()?.errorText}`));
let checks = 0;
function pass(label: string) { checks++; console.log(`PASS SHELL ${label}`); }
async function control(action: string) {
  const response = await fetch(`${config?.url}/__fixture/${action}`, { method: "POST", headers: { "X-Fixture-Key": config?.controlKey ?? "" } });
  assert.equal(response.status, 204);
}
try {
  await control("grant-claim"); await control("grant-transition"); await control("crm-grant"); await control("new-queue");
  await page.goto(`http://127.0.0.1:${address.port}/#/login`);
  await page.getByLabel("Email", { exact: true }).fill("a@example.invalid", { timeout: 30000 });
  await page.getByLabel(/Password|Mật khẩu/, { exact: true }).fill("Synthetic-Claim-Only-2026!");
  await page.getByRole("button", { name: /^(Sign in|Đăng nhập)$/ }).click();
  await page.waitForURL(/#\/(select-workspace|w\/)/, { timeout: 30000 });
  await page.waitForURL(/#\/w\/com1-a\/crm\//, { timeout: 30000 });
  pass("real Identity sign-in and Workspace bootstrap enter CRM shell");
  const group = page.getByRole("button", { name: /COMMUNICATIONS|GIAO TIẾP/ });
  if (await group.getAttribute("aria-expanded") === "false") await group.click();
  await page.getByRole("link", { name: /^(Inbox|Hộp thư)$/ }).click();
  await expect(page).toHaveURL(/\/communications$/);
  if (config.telegramId) {
    await page.evaluate(id => { window.location.hash = `/w/com1-a/crm/communications/${id}`; }, config.telegramId);
    await expect(page.getByText("SYNTHETIC_TELEGRAM_A1", { exact: true })).toBeVisible();
    await expect(page.getByText("SYNTHETIC_TELEGRAM_B1", { exact: true })).toHaveCount(0);
    pass("fake Telegram HTTP to SQL to actual authorized Inbox timeline preserves Workspace isolation");
    await page.getByRole("button", { name: /^(Back to Inbox|Về Hộp thư)$/ }).click();
  }
  await page.getByRole("button", { name: /^(Unassigned|Chưa phân công)$/ }).click();
  await expect(page.getByRole("button", { name: /^(Claim|Nhận hội thoại)$/ }).last()).toBeVisible();
  pass("sidebar opens connected Inbox and Claim-enabled metadata Queue");
  await page.getByRole("button", { name: /^(Claim|Nhận hội thoại)$/ }).last().click();
  await expect(page).toHaveURL(/\/communications\/\d+$/);
  await expect(page.getByText("SYNTHETIC_CLAIM_BODY", { exact: true })).toBeVisible();
  pass("shell Claim navigates to detail and authorized Message HTTP loads content");
  const claimedId = page.url().split("/").at(-1);
  assert.ok(claimedId);
  await expect(page.locator('[data-conversation-status="NEW"]')).toBeVisible();
  pass("Claim leaves NEW status unchanged");
  const crm = page.getByRole("region", { name: "CRM", exact: true });
  await expect(crm.getByText(/No CRM link|Chưa liên kết CRM/)).toBeVisible();
  await crm.getByRole("textbox").fill("lead_crm_one");
  await crm.getByRole("button", { name: /^(Search CRM|Tìm CRM)$/ }).click();
  await crm.getByRole("button", { name: /^(Select|Chọn) Synthetic Lead lead_crm_one$/ }).click();
  await crm.getByRole("button", { name: /^(Confirm CRM|Xác nhận CRM)$/ }).click();
  await expect(crm.getByText("LEAD: Synthetic Lead lead_crm_one (lead_crm_one)", { exact: true })).toBeVisible();
  pass("full shell capability bootstrap and owner-authorized manual CRM link");
  await crm.getByRole("button", { name: /^(Unlink CRM|Hủy liên kết CRM)$/ }).click();
  await crm.getByRole("button", { name: /^(Confirm CRM|Xác nhận CRM)$/ }).click();
  await expect(crm.getByText(/No CRM link|Chưa liên kết CRM/)).toBeVisible();
  pass("full shell explicit unlink reloads authoritative empty CRM context");
  for (const step of [
    { name: /^(Start processing|Bắt đầu xử lý)$/, status: "OPEN" },
    { name: /^(Set pending|Chuyển chờ)$/, status: "PENDING" },
    { name: /^(Resume processing|Tiếp tục xử lý)$/, status: "OPEN" },
    { name: /^(Close conversation|Đóng hội thoại)$/, status: "CLOSED" },
  ]) {
    await page.getByRole("button", { name: step.name }).click();
    await expect(page.locator(`[data-conversation-status="${step.status}"]`)).toBeVisible();
    pass(`real shell lifecycle action persists ${step.status} and reloads detail`);
  }
  await page.getByRole("button", { name: /^(Back to Inbox|Về Hộp thư)$/ }).click();
  await expect(page.getByText(new RegExp(`^(Conversation|Hội thoại) ${claimedId}$`))).toHaveCount(0);
  await page.getByRole("button", { name: /^(Closed|Đã đóng)$/ }).click();
  await page.getByRole("list", { name: /^(Conversations|Hội thoại)$/ }).getByRole("button")
    .filter({ has: page.getByText(new RegExp(`^(Conversation|Hội thoại) ${claimedId}$`)) }).click();
  await expect(page.locator('[data-conversation-status="CLOSED"]')).toBeVisible();
  await page.getByRole("button", { name: /^(Reopen conversation|Mở lại hội thoại)$/ }).click();
  await expect(page.locator('[data-conversation-status="OPEN"]')).toBeVisible();
  pass("Closed Inbox discovers retained history and manual Reopen returns OPEN");
  await page.getByRole("button", { name: /^(Close conversation|Đóng hội thoại)$/ }).click();
  await expect(page.locator('[data-conversation-status="CLOSED"]')).toBeVisible();
  await control("trusted-inbound"); await page.getByRole("button", { name: /^(Refresh|Làm mới)$/ }).click();
  await expect(page.locator('[data-conversation-status="OPEN"]')).toBeVisible();
  await expect(page.getByText("SYNTHETIC_TRUSTED_INBOUND", { exact: true })).toBeVisible();
  pass("internal synthetic inbound auto-reopens same shell detail with message history");
  await page.getByRole("button", { name: /^(Back to Inbox|Về Hộp thư)$/ }).click();
  const claimedRow = page.getByRole("list", { name: /^(Conversations|Hội thoại)$/ }).getByRole("button")
    .filter({ has: page.getByText(new RegExp(`^(Conversation|Hội thoại) ${claimedId}$`)) });
  await expect(claimedRow).toBeVisible();
  await claimedRow.click();
  await expect(page.getByText("SYNTHETIC_CLAIM_BODY", { exact: true })).toBeVisible();
  pass("Assigned Inbox refresh includes Claim winner and reopens authorized detail");
  await control("revoke");
  await page.getByRole("button", { name: /^(Refresh|Làm mới)$/ }).click();
  await expect(page.getByText(/do not have access|không có quyền đọc/)).toBeVisible();
  await expect(page.getByText("SYNTHETIC_CLAIM_BODY", { exact: true })).toHaveCount(0);
  pass("same-session revocation refuses next protected read and removes content");
  await control("grant");
  await page.getByRole("button", { name: /Synthetic A/ }).click();
  await page.getByRole("button", { name: /Synthetic B/ }).click();
  await page.waitForURL(/#\/w\/com1-b\/crm\//);
  await expect(page.getByText("SYNTHETIC_CLAIM_BODY", { exact: true })).toHaveCount(0);
  pass("real Workspace switch retires previous Communications content");
  await page.getByRole("button", { name: /Synthetic B/ }).click();
  await page.getByRole("button", { name: /Synthetic A/ }).click();
  await page.waitForURL(/#\/w\/com1-a\/crm\//);
  // Open the normal routed detail after the real Workspace lifecycle completed.
  await page.evaluate(id => { window.location.hash = `/w/com1-a/crm/communications/${id}`; }, claimedId);
  await expect(page.getByText("SYNTHETIC_CLAIM_BODY", { exact: true })).toBeVisible();
  await control("reassign-shell");
  await page.getByRole("button", { name: /^(Refresh|Làm mới)$/ }).click();
  await expect(page.getByText(/not found within your access scope|Không tìm thấy hội thoại/)).toBeVisible();
  await expect(page.getByText("SYNTHETIC_CLAIM_BODY", { exact: true })).toHaveCount(0);
  pass("same-session changed assignee prevents next protected read and clears timeline");
  if (process.env.COMMUNICATIONS_FOUNDATION_VERIFY === "1") {
    await control("grant-channels");
    await page.evaluate(() => { window.location.hash = "/w/com1-a/studio/settings/communications/channels"; });
    await page.reload();
    await expect(page.getByRole("heading", { name: /^Communications · (Channel connections|Kênh kết nối)$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^(Add connection|Thêm kết nối)$/ })).toBeVisible();
    pass("registered Studio route loads backend account management with explicit capability");
    for (const name of ["Browser Gmail CSKH", "Browser Gmail Sales"]) {
      await page.getByRole("button", { name: /^(Add connection|Thêm kết nối)$/ }).click();
      const form = page.getByRole("form", { name: /^(Channel configuration|Cấu hình kênh)$/ });
      await form.getByLabel("Provider", { exact: true }).selectOption("gmail");
      await form.getByRole("textbox").fill(name);
      await form.getByRole("button", { name: /^(Save draft|Lưu bản nháp)$/ }).click();
      await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    }
    pass("Studio adds two accounts for same provider through real HTTP without overwriting");
    const card = (name: string) => page.getByRole("listitem").filter({ has: page.getByRole("heading", { name, exact: true }) });
    await card("Browser Gmail CSKH").getByRole("button", { name: /^(Rename|Đổi tên)$/ }).click();
    await page.getByRole("form").getByRole("textbox").fill("Browser Gmail Renamed");
    await page.getByRole("form").getByRole("button", { name: /^(Save draft|Lưu bản nháp)$/ }).click();
    await expect(page.getByRole("heading", { name: "Browser Gmail Renamed", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Browser Gmail Sales", exact: true })).toBeVisible();
    await card("Browser Gmail Renamed").getByRole("button", { name: /^(Disable|Vô hiệu hóa)$/ }).click();
    await expect(card("Browser Gmail Renamed").getByRole("button", { name: /^(Re-enable draft|Bật lại bản nháp)$/ })).toBeVisible();
    await expect(card("Browser Gmail Sales").getByRole("button", { name: /^(Disable|Vô hiệu hóa)$/ })).toBeVisible();
    await card("Browser Gmail Renamed").getByRole("button", { name: /^(Re-enable draft|Bật lại bản nháp)$/ }).click();
    await expect(card("Browser Gmail Renamed").getByRole("button", { name: /^(Disable|Vô hiệu hóa)$/ })).toBeVisible();
    pass("rename disable and re-enable affect only the selected ChannelAccountId");
    if (process.env.COMMUNICATIONS_CREDENTIAL_VERIFY === "1") {
      for (const name of ["Browser Telegram Secure", "Browser Telegram Second"]) {
        await page.getByRole("button", { name: /^(Add connection|Thêm kết nối)$/ }).click();
        const form = page.getByRole("form", { name: /^(Channel configuration|Cấu hình kênh)$/ });
        await form.getByLabel("Provider", { exact: true }).selectOption("telegram");
        await form.getByRole("textbox").fill(name);
        await form.getByRole("button", { name: /^(Save draft|Lưu bản nháp)$/ }).click();
        await expect(card(name)).toBeVisible();
      }
      const secure = card("Browser Telegram Secure");
      const second = card("Browser Telegram Second");
      const tokenInput = secure.getByLabel("Bot Token", { exact: true });
      await expect(tokenInput).toHaveAttribute("type", "password");
      await tokenInput.fill("fixture-browser-credential");
      await secure.getByRole("button", { name: /^(Save \/ Replace credential|Lưu \/ Thay thông tin xác thực)$/ }).click();
      await expect(secure.getByText(/Credential configured|Đã cấu hình thông tin xác thực/)).toBeVisible();
      await expect(tokenInput).toHaveValue("");
      await expect(second.getByText(/No credential configured|Chưa có thông tin xác thực/)).toBeVisible();
      pass("masked Studio credential save is account-specific, clears input and remains unverified");
      if (process.env.COMMUNICATIONS_ACTIVATION_VERIFY === "1") {
        await secure.getByRole("button", { name: /^(Verify Bot|Xác minh Bot)$/ }).click();
        await expect(secure.getByText(/Vận hành: READY_TO_ACTIVATE|Runtime: READY_TO_ACTIVATE/)).toBeVisible();
        await expect(secure.getByText(/Synthetic verified bot|Bot xác minh synthetic/)).toBeVisible();
        await expect(secure.getByText(/Inbound activated: No|Inbound được kích hoạt: Không/)).toBeVisible();
        pass("Studio verifies synthetic bot identity without activating inbound");
        await secure.getByRole("button", { name: /^(Activate Inbound|Kích hoạt Inbound)$/ }).click();
        await expect(secure.getByText(/Vận hành: STARTING|Runtime: STARTING/)).toBeVisible();
        await expect(secure.getByRole("button", { name: /^(Activate Inbound|Kích hoạt Inbound)$/ })).toBeDisabled();
        await expect(second.getByText(/No credential configured|Chưa có thông tin xác thực/)).toBeVisible();
        pass("Studio activation awaits server state and starts only the selected account");
        await control("telegram-browser-poll");
        await secure.getByRole("button", { name: /^(Refresh connection health|Cập nhật trạng thái)$/ }).click();
        await expect(secure.getByText(/Vận hành: HEALTHY|Runtime: HEALTHY/)).toBeVisible();
        await expect(secure.getByText(/Last successful poll|Polling thành công gần nhất/)).not.toHaveText(/—$/);
        await expect(secure.getByText(/Last committed update|Cập nhật đã lưu gần nhất/)).not.toHaveText(/—$/);
        pass("Studio health uses successful fake polling and committed update evidence");
        await secure.getByRole("button", { name: /^(Deactivate Inbound|Dừng Inbound)$/ }).click();
        await expect(secure.getByText(/Vận hành: READY_TO_ACTIVATE|Runtime: READY_TO_ACTIVATE/)).toBeVisible();
        pass("Studio deactivation preserves verified identity while stopping inbound");
        await secure.getByRole("button", { name: /^(Reconnect|Kết nối lại)$/ }).click();
        await expect(secure.getByText(/Vận hành: STARTING|Runtime: STARTING/)).toBeVisible();
        pass("Studio reconnect verifies the retained credential before restarting inbound");
        await secure.getByRole("button", { name: /^(Disconnect|Ngắt kết nối)$/ }).click();
        await expect(secure.getByText(/Vận hành: RECONNECT_REQUIRED|Runtime: RECONNECT_REQUIRED/)).toBeVisible();
        await expect(secure.getByText(/Credential configured|Đã cấu hình thông tin xác thực/)).toBeVisible();
        await expect(secure.getByRole("button", { name: /^(Verify Bot|Xác minh Bot)$/ })).toBeDisabled();
        pass("Studio disconnect retains protected credentials and requires reconnect without deleting history");
      }
      await tokenInput.fill("fixture-browser-replacement");
      await secure.getByRole("button", { name: /^(Save \/ Replace credential|Lưu \/ Thay thông tin xác thực)$/ }).click();
      await expect(secure.getByText(/g2 \/ c\d+$/)).toBeVisible(); await expect(tokenInput).toHaveValue("");
      await secure.getByRole("button", { name: /^(Remove local credential|Xóa thông tin xác thực cục bộ)$/ }).click();
      await expect(secure.getByText(/No credential configured|Chưa có thông tin xác thực/)).toBeVisible();
      await expect(secure.getByRole("button", { name: /^(Verify Bot|Xác minh Bot)$/ })).toBeDisabled();
      await expect(secure.getByText(/Live verification not admitted|Xác minh live chưa được phép/)).toBeVisible();
      pass("Studio replacement and local removal preserve truthful non-live state");
      await tokenInput.fill("fixture-browser-cancel");
      await secure.getByRole("button", { name: /^(Cancel token|Hủy token)$/ }).click(); await expect(tokenInput).toHaveValue("");
      await tokenInput.fill("fixture-browser-workspace");
      assert.equal(await page.evaluate(() => [...Object.values(localStorage), ...Object.values(sessionStorage)].some(v => /fixture-browser/.test(v))), false);
      await page.getByRole("button", { name: /Synthetic A/ }).click(); await page.getByRole("button", { name: /Synthetic B/ }).click();
      await page.waitForURL(/#\/w\/com1-b\//); await expect(page.getByRole("heading", { name: "Browser Telegram Secure", exact: true })).toHaveCount(0);
      await page.getByRole("button", { name: /Synthetic B/ }).click(); await page.getByRole("button", { name: /Synthetic A/ }).click();
      await page.evaluate(() => { window.location.hash = "/w/com1-a/studio/settings/communications/channels"; });
      await expect(tokenInput).toHaveValue("");
      pass("cancel and actual Workspace switch retire password draft without browser storage");
    }
    await card("Browser Gmail Sales").getByRole("button", { name: /^(Rename|Đổi tên)$/ }).click();
    await control("channel-conflict");
    await page.getByRole("form").getByRole("textbox").fill("Stale browser overwrite");
    await page.getByRole("form").getByRole("button", { name: /^(Save draft|Lưu bản nháp)$/ }).click();
    await expect(page.getByText(/Configuration changed. Reloaded|Cấu hình đã thay đổi. Đã tải lại/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Browser concurrent change", exact: true })).toBeVisible();
    pass("browser stale version reports conflict and reloads authoritative metadata");
    await page.route("**/communications/channel-accounts?*", route => route.fulfill({ status: 503, contentType: "application/problem+json", body: JSON.stringify({ code: "SYNTHETIC_UNAVAILABLE", status: 503, retryable: false }) }));
    await page.reload();
    await expect(page.getByText(/Could not load channels|Không thể tải kênh kết nối/)).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole("heading", { name: "Browser Gmail Renamed", exact: true })).toHaveCount(0);
    await page.unroute("**/communications/channel-accounts?*");
    await page.getByRole("button", { name: /^(Retry|Thử lại)$/ }).click();
    await expect(page.getByRole("heading", { name: "Browser Gmail Renamed", exact: true })).toBeVisible();
    pass("network error clears account projection and Retry reloads backend state");
    assert.equal(await page.evaluate(() => Object.values(localStorage).some(value => /Browser Gmail|Browser concurrent|Stale browser/.test(value))), false);
    pass("channel metadata and drafts are not persisted to browser storage");
    let releaseLate: () => void = () => {};
    let acknowledgeLate: () => void = () => {};
    const lateGate = new Promise<void>(resolve => { releaseLate = resolve; });
    const lateStarted = new Promise<void>(resolve => { acknowledgeLate = resolve; });
    await page.route("**/communications/channel-accounts?*", async route => {
      if (route.request().headers()["x-workspace-id"] !== "ws_com1_a") { await route.continue(); return; }
      const response = await route.fetch();
      acknowledgeLate(); await lateGate;
      try { await route.fulfill({ response }); } catch { /* Authority switch may already have aborted the old request. */ }
    });
    await page.getByLabel(/^(Filter provider|Lọc provider)$/).selectOption("gmail");
    await lateStarted;
    await page.getByRole("button", { name: /Synthetic A/ }).click();
    await page.getByRole("button", { name: /Synthetic B/ }).click();
    await page.waitForURL(/#\/w\/com1-b\//);
    await expect(page.getByText("Browser Gmail Renamed", { exact: true })).toHaveCount(0);
    await page.evaluate(() => { window.location.hash = "/w/com1-b/studio/settings/communications/channels"; });
    await expect(page.getByRole("heading", { name: "B Gmail", exact: true })).toBeVisible();
    releaseLate(); await page.unroute("**/communications/channel-accounts?*");
    await expect(page.getByRole("heading", { name: "Browser concurrent change", exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "B Gmail", exact: true })).toBeVisible();
    pass("real Workspace switch retires delayed A response and reads only B metadata");
    await page.getByRole("button", { name: /Synthetic B/ }).click();
    await page.getByRole("button", { name: /Synthetic A/ }).click();
    await page.waitForURL(/#\/w\/com1-a\//);
    await control("revoke-channels");
    await page.evaluate(() => { window.location.hash = "/w/com1-a/studio/settings/communications/channels"; });
    await page.reload();
    await expect(page.getByRole("heading", { name: "Browser Gmail Renamed", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^(Add connection|Thêm kết nối)$/ })).toHaveCount(0);
    pass("revoked permission denies Studio channel route and clears metadata/actions");
    await control("grant-channels"); await page.reload();
    await expect(page.getByRole("heading", { name: "Browser Gmail Renamed", exact: true })).toBeVisible();
    await control("expire-channel-session"); await page.reload();
    await page.waitForURL(/#\/(login|session-expired)/, { timeout: 30000 });
    await expect(page.getByRole("heading", { name: "Browser Gmail Renamed", exact: true })).toHaveCount(0);
    pass("revoked real session retires channel metadata and redirects to authentication");
  }
  console.log(`SHELL_ASSERTIONS ${checks}`);
} catch (error) {
  await page.screenshot({ path: path.join(artifacts, "shell-attempt.png"), fullPage: true });
  await writeFile(path.join(artifacts, "shell-attempt.txt"), `${page.url()}\n${await page.locator("body").innerText()}\n${observations.join("\n")}`);
  throw error;
} finally { await writeFile(path.join(artifacts, "shell-http.log"), observations.join("\n")); await context.close(); await browser.close(); await server.close(); }
