import { expect, test, type Page, type Response } from "@playwright/test";

const api = process.env.UNICORECRM_TEST_API_BASE_URL!;
const member = process.env.UNICORECRM_TEST_MEMBER_ID!;
const email = process.env.UNICORECRM_TEST_EMAIL!;
const password = process.env.UNICORECRM_TEST_PASSWORD!;

async function signIn(page: Page) {
  await page.goto("/#/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/Mật khẩu|Password/, { exact: true }).fill(password);
  await page.getByRole("button", { name: /Đăng nhập|Sign in/, exact: true }).click();
  // Connected entry resolves membership/bootstrap/access before redirecting.
  // Do not race a demo workspace button: its pending click can fire later in the shell.
  const routeWorkspace = process.env.UNICORECRM_TEST_WORKSPACE_KEY!;
  expect(routeWorkspace).toBeTruthy();
  await expect(page).toHaveURL(new RegExp(`#/w/${routeWorkspace}/crm/`), { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: /Không thể mở không gian làm việc|This workspace could not be opened/ })).toHaveCount(0);
  return routeWorkspace!;
}

function responseFor(page: Page, path: string, predicate: (url: URL) => boolean = () => true) {
  return page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.origin === api && url.pathname === path && response.request().method() === "GET" && predicate(url);
  });
}
async function bounded(response: Response, total: number) {
  expect(response.status()).toBe(200);
  const query = new URL(response.url()).searchParams;
  const limit = Number(query.get("limit") || "25");
  expect(limit).toBeGreaterThan(0); expect(limit).toBeLessThanOrEqual(100);
  const body = await response.json();
  expect(body.items.length).toBeLessThanOrEqual(limit);
  expect(body.pageInfo.totalCount).toBe(total);
  return body;
}

test("real Contact list pages lazily, filters on server, selects my principal and loads SQL summary", async ({ page }, info) => {
  const requests: string[] = [];
  page.on("request", request => {
    const url = new URL(request.url());
    if (url.origin === api && url.pathname === "/contacts") requests.push(url.pathname + url.search);
  });
  const routeWorkspace = await signIn(page);
  const firstResponse = responseFor(page, "/contacts");
  await page.goto(`/#/w/${routeWorkspace}/crm/contacts`);
  const first = await bounded(await firstResponse, 130);
  expect(first.items).toHaveLength(25);
  expect(first.pageInfo.hasNextPage).toBe(true);
  await expect(page.locator("#contact-workspace")).toBeVisible();
  await expect(page.locator('[data-list-pagination="canonical"]')).toContainText("130");
  await page.waitForLoadState("networkidle");
  expect(requests.filter(path => new URL(path, api).searchParams.has("cursor"))).toHaveLength(0);
  const nextResponse = responseFor(page, "/contacts", url => url.searchParams.has("cursor"));
  await page.getByRole("button", { name: /Trang sau|Next page/, exact: true }).click();
  const next = await bounded(await nextResponse, 130);
  expect(new URL((await nextResponse).url()).searchParams.get("cursor")).toBe(first.pageInfo.nextCursor);
  expect(next.items.some((item: { id: string }) => first.items.some((prior: { id: string }) => prior.id === item.id))).toBe(false);

  const searchedResponse = responseFor(page, "/contacts", url => url.searchParams.get("search") === "Browser Contact 001");
  await page.locator("#contact-workspace input").filter({ visible: true }).first().fill("Browser Contact 001");
  const searched = await bounded(await searchedResponse, 1);
  expect(searched.items[0].id).toBe("contact_browser_001");
  const clearResponse = responseFor(page, "/contacts", url => !url.searchParams.get("search"));
  await page.locator("#contact-workspace input").filter({ visible: true }).first().fill("");
  await bounded(await clearResponse, 130);
  await page.getByRole("button", { name: /Bộ lọc|Filters/, exact: true }).click();
  const filters = page.getByRole("dialog", { name: /Bộ lọc liên hệ|Contact filters/ });
  const statusResponse = responseFor(page, "/contacts", url => url.searchParams.get("status") === "needs_follow_up");
  await filters.getByLabel(/Trạng thái|Status/, { exact: true }).selectOption("needs_follow_up");
  expect((await bounded(await statusResponse, 65)).items.every((item: { status: string }) => item.status === "needs_follow_up")).toBe(true);
  const resetStatus = responseFor(page, "/contacts", url => !url.searchParams.has("status") && !url.searchParams.get("search"));
  await filters.getByLabel(/Trạng thái|Status/, { exact: true }).selectOption("all");
  await bounded(await resetStatus, 130);
  await filters.getByRole("button", { name: /Hoàn tất|Done/, exact: true }).click();
  await page.getByRole("button", { name: /Tất cả liên hệ|All Contacts/ }).click();
  const myResponse = responseFor(page, "/contacts", url => url.searchParams.get("ownerScope") === "my");
  await page.getByRole("button", { name: /Liên hệ của tôi|My Contacts/ }).click();
  const mine = await bounded(await myResponse, 65);
  expect(mine.items.every((item: { ownerId: string }) => item.ownerId === member)).toBe(true);
  const summaryResponse = responseFor(page, "/contacts/summary", url => url.searchParams.get("ownerScope") === "my");
  await page.getByRole("button", { name: /Thống kê|Statistics/ }).click();
  const summary = await summaryResponse;
  expect(summary.status()).toBe(200);
  expect(await summary.json()).toMatchObject({ totalCount: 65, statusCounts: { active: 65 } });
  await info.attach("real-contact-requests", { body: JSON.stringify(requests, null, 2), contentType: "application/json" });
});

test("real Lead Kanban keeps column cursors and loading independent", async ({ page }, info) => {
  const requests: string[] = [];
  page.on("request", request => {
    const url = new URL(request.url());
    if (url.origin === api && url.pathname.startsWith("/leads/kanban/")) requests.push(url.pathname + url.search);
  });
  const routeWorkspace = await signIn(page);
  const firstNew = responseFor(page, "/leads/kanban/NEW");
  const firstContacting = responseFor(page, "/leads/kanban/CONTACTING");
  await page.goto(`/#/w/${routeWorkspace}/crm/leads?view=kanban`);
  const newPage = await bounded(await firstNew, 65);
  const contactingPage = await bounded(await firstContacting, 65);
  expect(newPage.items).toHaveLength(50); expect(contactingPage.items).toHaveLength(50);
  const newColumn = page.locator('[data-kanban-column="NEW"]');
  const contactingColumn = page.locator('[data-kanban-column="CONTACTING"]');
  await expect(newColumn.getByRole("button", { name: /Tải thêm|Load more/, exact: true })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expect(newColumn.locator('[data-kanban-card="lead"]')).toHaveCount(50);
  await expect(contactingColumn.locator('[data-kanban-card="lead"]')).toHaveCount(50);
  const contactingSnapshot = await contactingColumn.textContent();
  const otherRequestsBefore = requests.filter(path => path.startsWith("/leads/kanban/CONTACTING")).length;
  const moreNew = responseFor(page, "/leads/kanban/NEW", url => url.searchParams.has("cursor"));
  await newColumn.getByRole("button", { name: /Tải thêm|Load more/, exact: true }).click();
  const moreResponse = await moreNew;
  expect(new URL(moreResponse.url()).searchParams.get("cursor")).toBe(newPage.pageInfo.nextCursor);
  const more = await bounded(moreResponse, 65);
  expect(more.items).toHaveLength(15); expect(more.pageInfo.hasNextPage).toBe(false);
  await expect(newColumn.getByRole("button", { name: /Tải thêm|Load more/, exact: true })).toHaveCount(0);
  expect(await contactingColumn.textContent()).toBe(contactingSnapshot);
  expect(requests.filter(path => path.startsWith("/leads/kanban/CONTACTING"))).toHaveLength(otherRequestsBefore);
  const moreContacting = responseFor(page, "/leads/kanban/CONTACTING", url => url.searchParams.has("cursor"));
  await contactingColumn.getByRole("button", { name: /Tải thêm|Load more/, exact: true }).click();
  const contactingResponse = await moreContacting;
  expect(new URL(contactingResponse.url()).searchParams.get("cursor")).toBe(contactingPage.pageInfo.nextCursor);
  expect((await bounded(contactingResponse, 65)).items).toHaveLength(15);
  await info.attach("real-kanban-requests", { body: JSON.stringify(requests, null, 2), contentType: "application/json" });
});
