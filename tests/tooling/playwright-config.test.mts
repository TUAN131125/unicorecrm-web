import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { createAiWorkspaceConfig } from "../config/playwright/ai-workspace";
import { createCrmConfig } from "../config/playwright/crm";
import { createDealPipelineConfig } from "../config/playwright/deal-pipeline";
import { createQuoteApprovalConfig } from "../config/playwright/quote-approval";
import { createQuoteCoreConfig } from "../config/playwright/quote-core";
import { createQuoteListPipelineConfig } from "../config/playwright/quote-list-pipeline";
import { createServiceConfig } from "../config/playwright/services";
import { e2eTestDirectory, frontendPath, frontendRoot } from "../config/playwright/shared";

const fixtureEnvironment = {
  UNICORECRM_TEST_API_BASE_URL: "http://127.0.0.1:5098",
  UNICORECRM_TEST_EMAIL: "config-test@fixture.invalid",
  UNICORECRM_TEST_PASSWORD: "config-fixture-only",
  UNICORECRM_TEST_EVIDENCE_DIR: "config-test-evidence",
  UNICORECRM_TEST_BUYER_ID: "config-test-buyer",
  UNICORECRM_TEST_DEAL_ID: "config-test-deal",
};

function withEnvironment(values: Record<string, string | undefined>, run: () => void) {
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("Quote approval rejects missing fixture bindings and non-isolated APIs", () => {
  withEnvironment(fixtureEnvironment, () => {
    for (const key of ["UNICORECRM_TEST_API_BASE_URL", "UNICORECRM_TEST_EMAIL", "UNICORECRM_TEST_PASSWORD", "UNICORECRM_TEST_EVIDENCE_DIR"]) {
      withEnvironment({ [key]: undefined }, () => assert.throws(() => createQuoteApprovalConfig("quote-proof"), /isolated local API/u));
    }
    for (const api of ["http://localhost:5098", "https://example.invalid", " http://127.0.0.1:5098 "]) {
      withEnvironment({ UNICORECRM_TEST_API_BASE_URL: api }, () => assert.throws(() => createQuoteApprovalConfig("quote-approval"), /isolated local API/u));
    }
  });
});

test("Buyer, Deal and read-only fixture requirements stay separate", () => {
  withEnvironment(fixtureEnvironment, () => {
    withEnvironment({ UNICORECRM_TEST_BUYER_ID: undefined }, () => {
      assert.throws(() => createDealPipelineConfig("deal-pipeline"), /buyer ID/u);
      assert.doesNotThrow(() => createQuoteCoreConfig());
    });
    withEnvironment({ UNICORECRM_TEST_DEAL_ID: undefined }, () => {
      assert.throws(() => createQuoteCoreConfig(), /credentials\/Deal/u);
      assert.doesNotThrow(() => createQuoteApprovalConfig("quote-approval"));
    });
    withEnvironment({ UNICORECRM_TEST_EMAIL: undefined, UNICORECRM_TEST_PASSWORD: undefined }, () => {
      assert.doesNotThrow(() => createQuoteListPipelineConfig());
      assert.throws(() => createQuoteApprovalConfig("quote-lifecycle"));
    });
  });
});

test("Server reuse remains opt-in only for the existing pipeline and core profiles", () => {
  withEnvironment({ ...fixtureEnvironment, UNICORECRM_TEST_REUSE_VITE: "1" }, () => {
    const pipeline = createDealPipelineConfig("deal-pipeline").webServer;
    const core = createQuoteCoreConfig().webServer;
    const approval = createQuoteApprovalConfig("quote-delivery").webServer;
    const crm = createCrmConfig("crm-ui").webServer;
    assert.ok(pipeline && core && approval && crm);
    assert.ok(!Array.isArray(pipeline) && !Array.isArray(core) && !Array.isArray(approval) && !Array.isArray(crm));
    assert.equal(pipeline.reuseExistingServer, true);
    assert.equal(core.reuseExistingServer, true);
    assert.equal(approval.reuseExistingServer, false);
    assert.equal(crm.reuseExistingServer, false);
  });
});

test("Relocated configs preserve frontend-relative evidence and server working directories", () => {
  withEnvironment(fixtureEnvironment, () => {
    assert.equal(e2eTestDirectory, path.join(frontendRoot, "tests/e2e"));
    assert.equal(createCrmConfig("connections").outputDir, frontendPath("../../review-artifacts/studio-connections-pr1-20261022/browser"));
    assert.equal(createQuoteApprovalConfig("quote-documents").outputDir, frontendPath("config-test-evidence/test-results"));
    const servers = createServiceConfig("support-connected").webServer;
    assert.ok(Array.isArray(servers));
    assert.equal(servers[0]?.cwd, frontendRoot);
    assert.equal(servers[0]?.reuseExistingServer, false);
    assert.equal(servers[0]?.timeout, 180_000);
  });
});

test("External-service profiles retain their environment, browser and timeout distinctions", () => {
  withEnvironment({ ...fixtureEnvironment, UNICORECRM_CONFIG_TEST_MARKER: "inherited", PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: "config-test-chromium" }, () => {
    const health = createServiceConfig("customer-health-connected");
    const ai = createServiceConfig("ai-connected");
    assert.ok(Array.isArray(health.webServer) && Array.isArray(ai.webServer));
    assert.equal(health.webServer[0]?.timeout, 120_000);
    assert.equal(ai.webServer[0]?.timeout, 180_000);
    assert.equal(health.webServer[0]?.env?.UNICORECRM_CONFIG_TEST_MARKER, "inherited");
    assert.equal(health.projects?.[0]?.use?.launchOptions?.executablePath, "config-test-chromium");
    assert.equal(createCrmConfig("crm-real").use?.launchOptions, undefined);
    assert.equal(createAiWorkspaceConfig().projects?.[0]?.use?.launchOptions, undefined);
    assert.equal(health.use?.trace, "retain-on-failure");
    assert.equal(createQuoteApprovalConfig("quote-identity").use?.trace, "off");
  });
});
