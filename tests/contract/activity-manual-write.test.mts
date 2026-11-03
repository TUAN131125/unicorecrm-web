import assert from "node:assert/strict";
import fs from "node:fs";
import { mapLogActivityRequest, mapActivityReadModel } from "@/modules/tasks/infrastructure/http/TaskApiMapper";
import { validateOpenApiRequest } from "@/platform/api/contracts/openApiRuntimeValidation";

const document = JSON.parse(fs.readFileSync("docs/api/openapi.json", "utf8"));
const request = document.components.schemas.LogActivityRequest;
const writeType = document.components.schemas[request.properties.type.$ref.split("/").at(-1)];
assert.deepEqual(writeType.enum, ["CALL", "EMAIL", "MEETING", "NOTE", "MESSAGE"]);
assert.ok(document.components.schemas.ActivityType.enum.includes("SYSTEM"));
const recordRef = { moduleKey: "contacts", recordId: "contact_fixture" };
for (const type of ["CALL", "EMAIL", "MEETING", "NOTE", "MESSAGE"] as const) {
  const input = { type, subject: "Manual activity", recordRef };
  assert.equal(validateOpenApiRequest("logActivity", input).valid, true);
  assert.equal(mapLogActivityRequest(input).type, type);
}
for (const type of ["SYSTEM", "UNKNOWN", "note", "", null, 7]) {
  const input = { type, subject: "Invalid type", recordRef };
  assert.equal(validateOpenApiRequest("logActivity", input).valid, false);
  assert.throws(() => Reflect.apply(mapLogActivityRequest, undefined, [input]), { code: "CONNECTED_CONTRACT_VIOLATION" });
}
const read = mapActivityReadModel({ id: "historic_system", type: "SYSTEM", subject: "Trusted historical event", actorId: "actor", occurredAt: "2026-10-21T00:00:00Z" });
assert.equal(read.type, "SYSTEM");
assert.ok(document.paths["/activities"].post.responses["422"]);
for (const entry of Object.values(document.paths["/activities"].post.requestBody.content["application/json"].examples) as { value: unknown }[])
  assert.equal(validateOpenApiRequest("logActivity", entry.value).valid, true);
console.log("PASS Activity manual write schema/runtime mapper: five write types, unknown/SYSTEM rejected, read SYSTEM retained, official valid examples and 422 contract. No SQL claim.");
