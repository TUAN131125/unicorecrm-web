import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function signIn(page: import("@playwright/test").Page, redirect?: string) {
  const query = redirect === undefined ? "" : `?redirect=${redirect}`;
  await page.goto(`/#/login${query}`);
  await page.getByLabel("Email").fill("sales.manager@unicorecrm.local");
  await page.getByLabel("Mật khẩu").fill("welcome123");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL(/#\/w\/[^/]+\/crm\//u);
}

test("malformed post-login redirect falls back without crashing", async ({ page }) => {
  await signIn(page, "%25");
  await expect(page.locator("body")).not.toContainText("URI malformed");
});

test("global search is a named keyboard-contained dialog", async ({ page }) => {
  await signIn(page);
  const trigger = page.getByRole("button", { name: "Tìm kiếm" });
  await trigger.focus();
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "Tìm kiếm toàn cục" });
  await expect(dialog).toBeVisible();
  const input = dialog.getByRole("combobox", { name: "Từ khóa tìm kiếm toàn cục" });
  await expect(input).toBeFocused();
  await expect(page.locator("#root")).toHaveAttribute("inert", "");

  const accessibility = await new AxeBuilder({ page }).include("#global-search-dialog").analyze();
  expect(accessibility.violations).toEqual([]);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});
