import real from "./playwright.crm-real.config";
import { defineConfig } from "@playwright/test";

export default defineConfig({ ...real, testMatch: "crm-ui-real.spec.ts", outputDir: "test-results/crm-ui-real" });
