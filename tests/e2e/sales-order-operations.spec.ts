import { expect, test } from "@playwright/test";

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/#/login");
  await page.getByLabel("Email").fill("sales.manager@unicorecrm.local");
  await page.getByLabel("Mật khẩu").fill("welcome123");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL(/#\/w\/[^/]+\/crm\//u);
}

function workspaceRoute(page: import("@playwright/test").Page, route: string): string {
  const match = page.url().match(/#\/w\/([^/]+)\/crm\//u);
  if (!match) throw new Error("Workspace route was not resolved after sign-in.");
  return `/#/w/${match[1]}/crm/${route}`;
}

test("Order list keeps lifecycle configuration out of the operational toolbar", async ({ page }) => {
  await signIn(page);
  await page.goto(workspaceRoute(page, "orders"));
  await expect(page.getByRole("button", { name: /Lifecycle|Vòng đời/u })).toHaveCount(0);
});

test("Shipping create form stays responsive and uses provider-backed booking language", async ({ page }) => {
  await signIn(page);
  await page.goto(workspaceRoute(page, "shipping/new"));
  await expect(page.getByRole("heading", { name: "Tạo vận đơn" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Trong nước/u })).toBeVisible();
  await expect(page.getByRole("button", { name: /Quốc tế/u })).toBeVisible();
  await expect(page.getByText("Tính bởi provider")).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
