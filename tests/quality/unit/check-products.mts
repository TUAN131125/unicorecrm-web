import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  createProductDuplicateDraft,
  saveProduct,
  setProductsStatus,
  toggleProductArchived,
} from "../../../src/modules/products/application/commands/productCatalogCommands";
import { parseProductsCsv, serializeProductsAsCsv } from "../../../src/modules/products/application/import-export/productCsv";
import { queryProducts } from "../../../src/modules/products/application/queries/productCatalogQueries";
import { PRODUCT_DEMO_SEED } from "../../../src/modules/products/infrastructure/dev-memory/productDemoSeed";
import { LocalProductRepository } from "../../../src/modules/products/infrastructure/LocalProductRepository";
import { PRODUCT_MODULE_MANIFEST } from "../../../src/modules/products/manifest";
import { ModuleRegistry } from "../../../src/platform/module-registry/ModuleRegistry";

const sample = PRODUCT_DEMO_SEED.slice(0, 3);
const source = (relativePath: string) => fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");

const filtered = queryProducts(
  sample,
  "enterprise",
  { type: "all", status: "all", category: "all", billingCycle: "all", tag: "all" },
  "sku",
  "asc",
);
assert.equal(filtered.length, 1, "product query should filter by search text");

const updated = saveProduct(sample, { name: "Renamed product" }, sample[0], "2026-07-06T00:00:00.000Z");
assert.equal(updated.mode, "updated");
assert.equal(updated.products[0].name, "Renamed product");

const duplicate = createProductDuplicateDraft(sample, sample[0]);
assert.equal(duplicate.status, "draft");
assert.notEqual(duplicate.sku, sample[0].sku);

const archived = toggleProductArchived(sample, sample[0].id, "2026-07-06T00:00:00.000Z");
assert.equal(archived.status, "archived");

const activated = setProductsStatus(sample, sample.map((product) => product.id), "active");
assert.ok(activated.every((product) => product.status === "active"));

const csv = serializeProductsAsCsv(sample);
const parsed = parseProductsCsv(csv, "2026-07-06T00:00:00.000Z");
assert.equal(parsed.length, sample.length);
assert.equal(parsed[0].sku, sample[0].sku);

const memory = new Map<string, unknown>();
const listeners = new Map<string, Set<(payload: unknown) => void>>();
const repository = new LocalProductRepository(
  {
    get: (key) => (memory.get(key) as any) ?? null,
    set: (key, value) => { memory.set(key, value); },
    remove: (key) => { memory.delete(key); },
  },
  {
    publish: (eventName, payload) => listeners.get(eventName)?.forEach((listener) => listener(payload)),
    subscribe: (eventName, listener) => {
      const bucket = listeners.get(eventName) ?? new Set();
      bucket.add(listener as (payload: unknown) => void);
      listeners.set(eventName, bucket);
      return () => bucket.delete(listener as (payload: unknown) => void);
    },
  },
);
let observedCount = 0;
const unsubscribe = repository.subscribe((products) => { observedCount = products.length; });
repository.replace(sample);
assert.equal(repository.list().length, sample.length);
assert.equal(observedCount, sample.length);
unsubscribe();

const registry = new ModuleRegistry().register(PRODUCT_MODULE_MANIFEST);
assert.equal(registry.get("products")?.routes.length, 2);

const productRuntime = source("src/modules/products/runtime/productModuleRuntime.ts");
const localRepository = source("src/modules/products/infrastructure/LocalProductRepository.ts");
const picker = source("src/modules/products/presentation/components/ProductPickerModal.tsx");
assert.match(productRuntime, /authorizeReads:\s*false/, "Workspace product reference data must not be projected through owner-based record scope");
assert.match(localRepository, /endsWith\(`:\$\{PRODUCT_CATALOG_STORAGE_KEY\}`\)/, "Workspace-prefixed catalog storage changes must refresh open pickers across tabs");
assert.match(picker, /p\.status !== "active"/, "Product Picker must exclude inactive products");
assert.match(picker, /context === "deal"[\s\S]*!typeConfig\.canBeSold/, "Deal Product Picker must exclude product types that cannot be sold");

console.log("Product module checks: OK");
