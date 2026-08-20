import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function signInToLeads(page: import("@playwright/test").Page) {
  await page.goto("/#/login");
  await page.getByLabel("Email").fill("sales.manager@unicorecrm.local");
  await page.getByLabel("Mật khẩu").fill("welcome123");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL(/#\/w\/[^/]+\/crm\//u);

  const workspaceMatch = page.url().match(/#\/w\/([^/]+)/u);
  expect(workspaceMatch?.[1]).toBeTruthy();
  await page.goto(`/#/w/${workspaceMatch?.[1]}/crm/leads`);
  await expect(page.locator("#lead-list-page")).toBeVisible();
}

test("Lead list exposes accessible pagination and responsive filter popover", async ({ page }) => {
  await signInToLeads(page);

  const pagination = page.getByRole("navigation", { name: /Phân trang danh sách Lead|Lead list pagination/i });
  await expect(pagination).toBeVisible();
  const pageSize = pagination.getByLabel(/Số Lead mỗi trang|Leads per page/i);
  await expect(pageSize).toHaveValue("25");
  await expect(pageSize).toHaveCSS("height", "40px");
  await expect(page.getByText(/Của tôi|Của đội|Được phép xem/i)).toHaveCount(0);

  const filterButton = page.getByRole("button", { name: /Bộ lọc|Advanced filters/i });
  await filterButton.click();
  const drawer = page.getByRole("dialog", { name: /Bộ lọc Lead|Lead filters/i });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByLabel(/Trạng thái|Status/i)).toBeVisible();
  await expect(drawer.getByLabel(/Sắp xếp|Sort/i)).toBeVisible();
  await expect(page.getByText(/leads\.filterPanel|common\.done/i)).toHaveCount(0);
  await expect(filterButton).not.toContainText(/\d+/u);

  const toolbarBox = await filterButton.locator("xpath=ancestor::div[contains(@class,'relative') and contains(@class,'grid')][1]").boundingBox();
  const filterBox = await drawer.boundingBox();
  expect(toolbarBox).not.toBeNull();
  expect(filterBox).not.toBeNull();
  expect(Math.abs((toolbarBox?.width || 0) - (filterBox?.width || 0))).toBeLessThanOrEqual(2);

  const accessibility = await new AxeBuilder({ page })
    .include("#lead-list-page")
    .analyze();
  expect(accessibility.violations).toEqual([]);

  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
});


test("Lead column selection applies and remains selected after reopening", async ({ page }) => {
  await signInToLeads(page);
  await page.getByRole("button", { name: /Cột|Columns/i }).click();
  const drawer = page.locator("#crm-column-settings-drawer");
  await expect(drawer).toBeVisible();
  const companyColumn = drawer.locator("#col-cfg-companyName");
  await expect(companyColumn).toBeChecked();
  await companyColumn.uncheck();
  await drawer.getByRole("button", { name: /Lưu|Save/i }).click();
  await expect(drawer).toBeHidden();
  await page.getByRole("button", { name: /Cột|Columns/i }).click();
  await expect(page.locator("#crm-column-settings-drawer #col-cfg-companyName")).not.toBeChecked();
});

test("Lead list remains usable at a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await signInToLeads(page);

  const pageRoot = page.locator("#lead-list-page");
  await expect(pageRoot).toBeVisible();
  await expect(page.getByRole("navigation", { name: /Phân trang danh sách Lead|Lead list pagination/i })).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(hasHorizontalOverflow).toBe(false);

  await expect(page.getByText(/AI đang chuẩn hóa|Opening share options|Mở tùy chọn chia sẻ/i)).toHaveCount(0);
});


test("Lead create modal accepts continuous typing and keeps footer outside the scroll body", async ({ page }) => {
  await signInToLeads(page);
  await page.getByRole("button", { name: /Thêm Tiềm năng|Thêm Lead|Add Lead/i }).click();

  const dialog = page.getByRole("dialog", { name: /Thêm Tiềm năng mới|Thêm Lead mới|Add new Lead/i });
  await expect(dialog).toBeVisible();
  const nameField = dialog.getByLabel(/Họ và tên khách hàng|Full name/i);
  await nameField.fill("Nguyễn Văn An");
  await expect(nameField).toHaveValue("Nguyễn Văn An");
  await expect(nameField).toBeFocused();
  await expect(dialog.getByText("Select a contact channel", { exact: true })).toHaveCount(0);
  await expect(dialog.getByText(/Có thể dùng số điện thoại làm tài khoản Zalo|System parameters/i)).toHaveCount(0);

  const footer = dialog.locator(".crm-form-action-bar");
  await expect(footer).toBeVisible();
  await expect(footer.locator('button[type="submit"]')).toBeVisible();
  const scrollBody = dialog.locator("#lead-form-scroll-container");
  await expect(scrollBody.locator(".crm-form-action-bar")).toHaveCount(0);
});

test("Lead Kanban supports lifecycle-safe drag and drop", async ({ page }) => {
  await signInToLeads(page);
  await page.getByTitle(/Kanban/i).click();

  const newColumn = page.locator('[data-kanban-column="NEW"]');
  const contactingColumn = page.locator('[data-kanban-column="CONTACTING"]');
  await expect(newColumn).toBeVisible();
  await expect(contactingColumn).toBeVisible();

  const card = newColumn.locator('[data-kanban-card="lead"]').first();
  const leadName = (await card.locator("h5").textContent())?.trim();
  expect(leadName).toBeTruthy();
  await card.dragTo(contactingColumn);
  const contactingCard = contactingColumn.locator('[data-kanban-card="lead"]', { hasText: leadName || "" });
  await expect(contactingCard).toBeVisible();

  const cardHeightBeforeMenu = (await contactingCard.boundingBox())?.height || 0;
  await contactingCard.getByTitle(/Thêm thao tác|More actions/i).click();
  await expect(page.getByText(/Bắt đầu xác minh|Start verifying/i)).toBeVisible();
  const cardHeightAfterMenu = (await contactingCard.boundingBox())?.height || 0;
  expect(Math.abs(cardHeightAfterMenu - cardHeightBeforeMenu)).toBeLessThanOrEqual(2);
  await page.keyboard.press("Escape");

  const verifyingColumn = page.locator('[data-kanban-column="VERIFYING"]');
  await contactingCard.dragTo(verifyingColumn);
  const readinessDialog = page.getByRole("dialog", { name: /Hoàn thiện thông tin xác minh|Complete verification information/i });
  await expect(readinessDialog).toBeVisible();
  await readinessDialog.getByLabel(/Công ty|Company/i).fill("Techcom Solutions");
  await readinessDialog.getByLabel(/Nhu cầu|Need/i).fill("Chuẩn hóa quy trình bán hàng");
  await readinessDialog.getByLabel(/Lịch chăm sóc|Next follow-up/i).fill("2026-07-20T09:00");
  await readinessDialog.getByRole("button", { name: /Chuyển sang Đang xác minh|Move to Verifying/i }).click();
  await expect(readinessDialog).toBeHidden();
  await expect(verifyingColumn.getByText(leadName || "", { exact: true })).toBeVisible();
});
