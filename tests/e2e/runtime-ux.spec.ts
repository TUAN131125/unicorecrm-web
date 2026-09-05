import { expect, test } from "@playwright/test";

async function signIn(page: import("@playwright/test").Page): Promise<string> {
  await page.goto("/#/login");
  await page.getByLabel("Email").fill("sales.manager@unicorecrm.local");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("welcome123");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL(/#\/(?:select-workspace|w\/[^/]+\/crm\/)/u);
  if (page.url().includes("#/select-workspace")) {
    await page.getByRole("button", { name: /Unicore Vietnam/u }).click();
  }
  await expect(page).toHaveURL(/#\/w\/[^/]+\/crm\//u);
  const workspaceKey = page.url().match(/#\/w\/([^/]+)/u)?.[1];
  expect(workspaceKey).toBeTruthy();
  return workspaceKey ?? "";
}

async function expectCanonicalMenuInViewport(page: import("@playwright/test").Page, triggerId: string) {
  await page.locator(triggerId).click();
  const menu = page.locator('[data-floating-overlay="menu"]');
  await expect(menu).toBeVisible();
  await expect(menu.evaluate((element) => element.parentElement === document.body)).resolves.toBe(true);
  const box = await menu.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
  expect(box?.y ?? -1).toBeGreaterThanOrEqual(0);
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewport?.width ?? 0);
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(viewport?.height ?? 0);
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
}

test("Lead and Contact saved-view menus use the viewport portal", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 500 });
  const workspaceKey = await signIn(page);

  await page.goto(`/#/w/${workspaceKey}/crm/leads`);
  await expect(page.locator("#lead-list-page")).toBeVisible();
  await expectCanonicalMenuInViewport(page, "#misa-view-dropdown-trigger");

  await page.goto(`/#/w/${workspaceKey}/crm/contacts`);
  await expect(page.locator("#contact-workspace")).toBeVisible();
  await expectCanonicalMenuInViewport(page, "#contact-view-dropdown-trigger");
});

test("healthy CRM list pages do not show backend-authority success copy", async ({ page }) => {
  const workspaceKey = await signIn(page);
  for (const route of ["leads", "deals", "tasks", "contacts"]) {
    await page.goto(`/#/w/${workspaceKey}/crm/${route}`);
    await expect(page.getByText(/Dữ liệu authoritative từ backend|Dữ liệu backend cập nhật lúc|Authoritative backend data|Backend data updated at/u)).toHaveCount(0);
  }
});
