import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { validateOpenApiRequest, validateOpenApiResponse } from "../../src/platform/api/contracts/openApiRuntimeValidation";

const spec = JSON.parse(fs.readFileSync(new URL("../../docs/api/openapi.json", import.meta.url), "utf8"));
const ownership = JSON.parse(fs.readFileSync(new URL("../../scripts/api/openapi/client-ownership.json", import.meta.url), "utf8"));
const operations = Object.entries(spec.paths).flatMap(([path, item]) => Object.entries(item as Record<string, Record<string, unknown>>)
  .filter(([, op]) => typeof op.operationId === "string").map(([method, op]) => ({ path, method: method.toUpperCase(), op })));
const communicationOps = operations.filter(({path}) => path.startsWith("/communications/"));
assert.equal(communicationOps.length, 24, "Every current Core/channel/Telegram route is admitted");
assert.equal(new Set(operations.map(x => x.op.operationId)).size, operations.length);
const generated = fs.readFileSync(new URL("../../src/platform/api/generated/communicationsApi.ts", import.meta.url), "utf8");
const schemas = spec.components.schemas;
const concurrency = JSON.parse(fs.readFileSync(new URL("../../docs/backend-readiness/concurrency-policy.json", import.meta.url), "utf8"));
const idempotency = JSON.parse(fs.readFileSync(new URL("../../docs/backend-readiness/idempotency-policy.json", import.meta.url), "utf8"));
assert.equal(concurrency.operations.find((op: {operationId:string}) => op.operationId === "activateTelegramConnection").conflictStatus,409);
assert.equal(idempotency.operations.find((op: {operationId:string}) => op.operationId === "activateTelegramConnection").keyScope,"WORKSPACE_ACTOR_KEY");
assert.equal(idempotency.operations.find((op: {operationId:string}) => op.operationId === "activateTelegramConnection").replayPolicy,"CURRENT_VERSION_ONLY_NO_PROVIDER_REPLAY");
const resolved = (p: Record<string, unknown>) => p.$ref ? spec.components.parameters[String(p.$ref).split("/").at(-1)!] : p;
for (const {op} of communicationOps) {
  assert.deepEqual(op.security, [{bearerAuth: []}]);
  const parameters = (op.parameters as Record<string, unknown>[]).map(resolved);
  assert(parameters.some(p => p.name === "X-Workspace-Id" && p.required));
  assert.equal(op["x-actor-required"], true);
  assert(Object.hasOwn(op.responses as object,"422"));
  assert(generated.includes(`  ${op.operationId}<`));
  if (op["x-required-capability"] === "communications.channels.manage") assert.equal(op["x-data-scope"], "SAFE_METADATA_ONLY");
}
assert(ownership.clients.some((client: {id: string}) => client.id === "communications"));
assert(Object.hasOwn((communicationOps.find(x=>x.op.operationId==="disconnectCommunicationChannelAccount")!.op.responses as object),"501"));
assert.equal(schemas.TelegramCredentialWrite.properties.botToken.writeOnly, true);
assert.equal(schemas.TelegramCredentialWrite.properties.botToken["x-sensitive"], true);
assert.equal(schemas.TelegramCredentialWrite.properties.botToken.example, undefined);
assert.equal(schemas.TelegramCredentialWrite.properties.botToken.default, undefined);
function noSecretResponse(schema: Record<string, unknown>, visited = new Set<string>()) {
  if (typeof schema.$ref === "string") {
    const name = schema.$ref.split("/").at(-1)!;
    if (visited.has(name)) return;
    visited.add(name); noSecretResponse(schemas[name], visited);
  }
  for (const [key, value] of Object.entries(schema.properties ?? {})) {
    assert(!/botToken|ciphertext|privateKey|credentialId|credentialRef/i.test(key), `Secret response field ${key}`);
    noSecretResponse(value as Record<string, unknown>, visited);
  }
  if (schema.items) noSecretResponse(schema.items as Record<string, unknown>, visited);
  for (const branch of (schema.anyOf ?? []) as Record<string, unknown>[]) noSecretResponse(branch, visited);
}
for (const {op} of communicationOps) for (const [code, response] of Object.entries(op.responses as Record<string, {content?: Record<string, {schema: Record<string, unknown>}>}>)) {
  if (code.startsWith("2")) noSecretResponse(response.content?.["application/json"]?.schema ?? {});
}
assert(validateOpenApiRequest("replaceTelegramCredential", {botToken:"fixture-contract",expectedVersion:1}).valid);
assert(!validateOpenApiRequest("replaceTelegramCredential", {botToken:"fixture-contract",expectedVersion:1,workspaceId:"spoof"}).valid);
assert(!validateOpenApiRequest("activateTelegramConnection", {expectedVersion:0}).valid);
assert(!validateOpenApiRequest("activateTelegramConnection", {expectedVersion:1,force:true}).valid);
assert(!validateOpenApiRequest("claimConversation", {}).valid, "Claim is body-free");
assert(validateOpenApiRequest("claimConversation", undefined).valid);
assert(!validateOpenApiResponse("getTelegramConnection", {botToken:"must-not-return"}).valid);
assert(validateOpenApiResponse("listConversations", {items:[{id:"1",lastActivityAt:"2026-10-17T00:00:00Z"}],nextCursor:null,canClaim:true}).valid);
assert(!validateOpenApiResponse("listConversations", {items:[{id:"1",lastActivityAt:"2026-10-17T00:00:00Z",text:"leak"}]}).valid);
assert(validateOpenApiResponse("createCommunicationChannelAccount", {account:{id:"12345678-1234-4234-8234-123456789abc",providerKey:"telegram",channelType:"MESSAGING",displayName:"Fixture",status:"DRAFT",configurationVersion:1,createdAt:null,updatedAt:null,externalAccountKey:null,lastVerifiedAt:null},auditId:"audit",occurredAt:"2026-10-17T00:00:00Z",correlationId:"fixture",replayed:true},200).valid);

const evidencePath = process.env.COMMUNICATIONS_CONTRACT_EVIDENCE;
if (evidencePath) {
  const evidence = JSON.parse(fs.readFileSync(evidencePath,"utf8"));
  const runtime = evidence.endpoints.flatMap((e: {path:string;operationId:string;methods:string[];authenticated:boolean;trustedWorkspace:boolean}) => e.methods.map(method => ({...e, method, path:e.path.replace(/:guid/g,"")})));
  assert.equal(runtime.length, communicationOps.length);
  for (const route of runtime) {
    assert(route.authenticated && route.trustedWorkspace, route.operationId);
    assert(communicationOps.some(x => x.path === route.path && x.method === route.method && x.op.operationId === route.operationId), route.operationId);
  }
  let successes = 0;
  for (const sample of evidence.responses) {
    const match = communicationOps.find(x => x.method === sample.method && new RegExp("^"+x.path.replace(/\{id\}/g,"[^/]+")+"$").test(sample.path.split("?")[0]));
    assert(match, sample.path);
    if (sample.status >= 200 && sample.status < 300) {
      const result = validateOpenApiResponse(String(match.op.operationId),sample.body,sample.status);
      assert(result.valid, `${match.op.operationId}: ${JSON.stringify(result.issues)}`); successes++;
    } else if (sample.status !== 500) {
      assert(Object.hasOwn(match.op.responses as object, String(sample.status)));
      assert.equal(typeof sample.body.code,"string");
      assert.equal(sample.body.status,sample.status);
      assert(Object.keys(sample.body).every(key => Object.hasOwn(schemas.CommunicationProblem.properties,key)));
    }
  }
  assert(successes > 20);
  console.log(`PASS canonical actual ApiHost alignment: ${runtime.length} routes; ${successes} successful response schemas; safe error envelopes`);
}
console.log(`PASS Communications canonical contracts: ${communicationOps.length} operations, generated ownership, body validation and secret-free responses (${fileURLToPath(import.meta.url)})`);
