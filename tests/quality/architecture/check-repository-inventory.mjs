import assert from "node:assert/strict";
import fs from "node:fs";
import {
  buildRepositoryInventory,
  INVENTORY_JSON_PATH,
  INVENTORY_MARKDOWN_PATH,
  renderRepositoryInventoryMarkdown,
  serializeInventory,
} from "../../../scripts/repository-inventory/repositoryInventory.mjs";

assert.ok(fs.existsSync(INVENTORY_JSON_PATH), "Missing docs/quality/repository-inventory.json. Run npm run repo:inventory.");
assert.ok(fs.existsSync(INVENTORY_MARKDOWN_PATH), "Missing docs/quality/repository-inventory.md. Run npm run repo:inventory.");

const inventory = buildRepositoryInventory();
const expectedJson = serializeInventory(inventory);
const expectedMarkdown = renderRepositoryInventoryMarkdown(inventory);
const actualJson = fs.readFileSync(INVENTORY_JSON_PATH, "utf8");
const actualMarkdown = fs.readFileSync(INVENTORY_MARKDOWN_PATH, "utf8");

assert.equal(actualJson, expectedJson, "Repository inventory JSON drifted. Run npm run repo:inventory and review the change.");
assert.equal(actualMarkdown, expectedMarkdown, "Repository inventory Markdown drifted. Run npm run repo:inventory and review the change.");
assert.ok(inventory.summary.modules > 0, "Repository inventory must contain registered modules.");
assert.ok(inventory.summary.routes > 0, "Repository inventory must contain route keys.");
assert.ok(inventory.summary.loadableRouteModules > 0, "Repository inventory must contain loadable route modules.");
assert.ok(inventory.summary.capabilities > 0, "Repository inventory must contain capabilities.");
assert.ok(inventory.summary.workspaceFlags > 0, "Repository inventory must contain workspace flags.");
assert.ok(inventory.summary.workflows > 0, "Repository inventory must contain cross-module workflows.");

for (const journey of inventory.criticalJourneys) {
  for (const evidence of journey.evidenceStatus) {
    assert.ok(evidence.exists, `${journey.id} is missing source evidence: ${evidence.path}`);
  }
  for (const gate of journey.gateStatus) {
    assert.ok(gate.exists, `${journey.id} references a missing quality gate: ${gate.gateId}`);
  }
}

console.log("[repository-inventory] PASS");
console.log(JSON.stringify(inventory.summary, null, 2));
