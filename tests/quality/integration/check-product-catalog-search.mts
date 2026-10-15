import assert from "node:assert/strict";
import { FetchHttpClient } from "@/platform/api/client/FetchHttpClient";
import { CommercialApiClient } from "@/platform/api/generated/commercialApi";
import { ProductHttpApiAdapter } from "@/modules/products/infrastructure/http/ProductHttpApiAdapter";

const observed: URL[] = [];
const controller = new AbortController();
const client = new FetchHttpClient({ baseUrl: "https://fixture.test", accessTokenProvider: { getAccessToken: () => "synthetic" }, workspaceIdProvider: { getWorkspaceId: () => "workspace" }, fetchImplementation: async (input, init) => {
  const url = new URL(String(input)); observed.push(url);
  assert.ok(init?.signal, "Generated read must carry cancellation into fetch");
  return new Response(JSON.stringify({ items: [{ id: "second", name: "Duplicate", sku: "SKU-SECOND", status: "ACTIVE", version: 0 }], pageInfo: { hasNextPage: false } }), { status: 200, headers: { "Content-Type": "application/json" } });
} });
const adapter = new ProductHttpApiAdapter(new CommercialApiClient(client));
const page = await adapter.selections({ search: "SKU%_", limit: 20 }, controller.signal);
assert.equal(observed[0]?.pathname, "/products/selection");
assert.equal(observed[0]?.searchParams.get("q"), "SKU%_");
assert.equal(observed[0]?.searchParams.get("limit"), "20");
assert.equal(page.items[0]?.id, "second");
assert.equal(page.items[0]?.version, 0);
assert.equal("unitPrice" in (page.items[0] ?? {}), false);
await adapter.selections({ ids: ["first & special", "second"] }, controller.signal);
assert.deepEqual(observed[1]?.searchParams.getAll("ids"), ["first & special", "second"]);
assert.equal(observed[1]?.searchParams.has("limit"), false);
assert.equal(observed[1]?.searchParams.has("q"), false);
console.log("Products generated-client adapter/repeated identity query/cancellation: PASS (focused fixture, not connected acceptance)");
