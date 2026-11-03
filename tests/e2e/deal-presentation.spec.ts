import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

test("Standalone Deal presentation fixtures: dynamic pipeline and authoritative-shaped Quote states", async ({ page }) => {
  const directory = path.resolve("artifacts/deal-detail-design/presentation");
  await mkdir(directory, { recursive: true });
  const checks: { scenario: string; viewport: string; kind: string }[] = [];
  const external: string[] = [];
  page.on("pageerror", error => console.error("Presentation fixture error:", error.message));
  page.on("requestfailed", request => console.error("Fixture load failure:", request.url(), request.failure()?.errorText));
  page.on("console", message => { if (message.type() === "error") console.error("Fixture console:", message.text()); });
  page.on("request", request => { if (!request.url().startsWith("http://127.0.0.1:3041")) external.push(request.url()); });
  for (const [viewport, width, height] of [["desktop", 1440, 900], ["mobile", 390, 844]] as const) {
    await page.setViewportSize({ width, height });
    for (const scenario of ["default", "few", "many", "long", "custom", "inactive", "reordered", "won", "lost"]) {
      await page.goto(`/tests/fixtures/deal-workspace.html?pipeline=${scenario}`);
      await expect(page.locator("#deal-detail-header")).toBeVisible({ timeout: 20_000 });
      await expect(page.locator("[data-presentation-fixture]")).toContainText("No Connected Backend");
      if (scenario === "few") await expect(page.locator("[data-pipeline-stage-count]")).toHaveAttribute("data-pipeline-stage-count", "3");
      if (["many", "long", "custom"].includes(scenario)) await expect(page.locator("[data-pipeline-stage-count]")).toHaveAttribute("data-pipeline-stage-count", "8");
      if (scenario === "inactive") await expect(page.locator('[data-pipeline-stage="QUALIFIED"]')).toHaveAttribute("data-stage-active", "false");
      if (["won", "lost"].includes(scenario)) { await expect(page.locator(`[data-deal-outcome="${scenario}"]`)).toBeVisible(); await expect(page.locator("#deal-stage-select")).toHaveCount(0); }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: path.join(directory, `pipeline-${scenario}-${viewport}.png`), fullPage: true });
      checks.push({ scenario, viewport, kind: "PRESENTATION_ONLY" });
    }
    for (const status of ["none", "DRAFT", "REVIEW", "SENT", "ACCEPTED", "REJECTED", "EXPIRED", "multiple"]) {
      await page.goto(`/tests/fixtures/deal-workspace.html?quote=${status}`);
      await expect(page.locator("#deal-detail-header")).toBeVisible();
      await page.getByRole("tab", { name: "Báo giá", exact: true }).click();
      if (status === "none") await expect(page.getByText("Chưa có báo giá liên kết", { exact: true })).toBeVisible();
      else if (status === "multiple") await expect(page.locator("[data-related-quote]")).toHaveCount(2);
      else await expect(page.locator(`[data-quote-status="${status}"]`)).toBeVisible();
      if (status !== "none") await expect(page.locator("[data-related-quote]").first()).toContainText("12.500,50");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: path.join(directory, `quote-${status}-${viewport}.png`), fullPage: true });
      checks.push({ scenario: status, viewport, kind: "PRESENTATION_ONLY" });
    }
  }
  expect(external).toEqual([]);
  await writeFile(path.join(directory, "results.json"), JSON.stringify({ status: "PASS", mode: "PRESENTATION_ONLY", checks, externalRequests: external }, null, 2));
});
