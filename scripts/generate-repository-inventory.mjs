import fs from "node:fs";
import {
  buildRepositoryInventory,
  INVENTORY_JSON_PATH,
  INVENTORY_MARKDOWN_PATH,
  renderRepositoryInventoryMarkdown,
  serializeInventory,
} from "./repository-inventory/repositoryInventory.mjs";

const inventory = buildRepositoryInventory();
fs.writeFileSync(INVENTORY_JSON_PATH, serializeInventory(inventory), "utf8");
fs.writeFileSync(INVENTORY_MARKDOWN_PATH, renderRepositoryInventoryMarkdown(inventory), "utf8");

console.log(`[repository-inventory] wrote ${INVENTORY_JSON_PATH}`);
console.log(`[repository-inventory] wrote ${INVENTORY_MARKDOWN_PATH}`);
console.log(`[repository-inventory] fingerprint ${inventory.inventoryFingerprint}`);
