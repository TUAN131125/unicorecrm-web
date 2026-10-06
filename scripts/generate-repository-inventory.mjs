import { writeValidatedInventory } from "./repository-inventory/writeValidatedInventory.mjs";
import {
  buildRepositoryInventory,
  INVENTORY_JSON_PATH,
  INVENTORY_MARKDOWN_PATH,
  renderRepositoryInventoryMarkdown,
  serializeInventory,
} from "./repository-inventory/repositoryInventory.mjs";

const inventory = buildRepositoryInventory();
writeValidatedInventory(INVENTORY_JSON_PATH, INVENTORY_MARKDOWN_PATH,
  serializeInventory(inventory), renderRepositoryInventoryMarkdown(inventory));

console.log(`[repository-inventory] wrote ${INVENTORY_JSON_PATH}`);
console.log(`[repository-inventory] wrote ${INVENTORY_MARKDOWN_PATH}`);
console.log(`[repository-inventory] fingerprint ${inventory.inventoryFingerprint}`);
