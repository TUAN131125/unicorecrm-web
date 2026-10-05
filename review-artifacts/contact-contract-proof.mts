import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { validateOpenApiRequest } from '../src/platform/api/contracts/openApiRuntimeValidation';
const before = JSON.parse(execFileSync('git', ['show', 'HEAD:docs/api/openapi.json'], { encoding: 'utf8', maxBuffer: 20e6 }));
const after = JSON.parse(fs.readFileSync('docs/api/openapi.json', 'utf8'));
const oldSchema = before.components.schemas.UpdateContactRequest;
const schema = after.components.schemas.UpdateContactRequest;
assert.equal(schema.type, 'object');
assert.equal(schema.additionalProperties, false);
assert.equal(schema.minProperties, 1);
assert.ok(!schema.required?.includes('fullName'));
assert.deepEqual(schema.properties.fullName, oldSchema.properties.fullName);
for (const [field, original] of Object.entries(oldSchema.properties)) {
  if (field !== 'fullName') assert.deepEqual(schema.properties[field], { anyOf: [original, { type: 'null' }] });
}
assert.deepEqual(schema.properties.displayName, { anyOf: [{ type: 'string', maxLength: 200 }, { type: 'null' }] });
const comparison = structuredClone(after);
comparison.components.schemas.UpdateContactRequest = oldSchema;
assert.deepEqual(comparison, before, 'Unrelated OpenAPI semantic drift');
const cases: [string, unknown, boolean][] = [
  ['empty patch', {}, false],
  ['notes only', { notes: 'updated' }, true],
  ['notes null', { notes: null }, true],
  ['owner null', { ownerId: null }, true],
  ['fullName value', { fullName: 'Updated Name' }, true],
  ['fullName null', { fullName: null }, false],
  ['unknown field', { notAField: 'x' }, false],
  ['fullName empty', { fullName: '' }, false],
  ['fullName max', { fullName: 'x'.repeat(200) }, true],
  ['fullName over max', { fullName: 'x'.repeat(201) }, false],
  ['owner value', { ownerId: 'owner-1' }, true],
  ['owner empty', { ownerId: '' }, false],
  ['owner over max', { ownerId: 'x'.repeat(129) }, false],
  ['email valid', { workEmail: 'person@example.com' }, true],
  ['email invalid format', { workEmail: 'invalid' }, false],
  ['email over max', { workEmail: 'x'.repeat(321) + '@example.com' }, false],
  ['channel enum', { preferredContactChannel: 'phone' }, true],
  ['channel unknown', { preferredContactChannel: 'unknown' }, false],
  ['notes max', { notes: 'x'.repeat(5000) }, true],
  ['notes over max', { notes: 'x'.repeat(5001) }, false],
  ['tags null', { tags: null }, true],
  ['tags item max', { tags: ['x'.repeat(100)] }, true],
  ['tags item over max', { tags: ['x'.repeat(101)] }, false],
  ['tags invalid item', { tags: [1] }, false],
  ['displayName null', { displayName: null }, true],
  ['displayName over max', { displayName: 'x'.repeat(201) }, false],
];
for (const field of Object.keys(schema.properties)) if (field !== 'fullName') cases.push([`${field} nullable`, { [field]: null }, true]);
const results = cases.map(([name, body, expected]) => {
  const result = validateOpenApiRequest('updateContact', body);
  assert.equal(result.valid, expected, `${name}: ${JSON.stringify(result.issues)}`);
  return { name, expected: expected ? 'VALID' : 'INVALID', actual: result.valid ? 'VALID' : 'INVALID', result: 'PASS' };
});
assert.equal(after.components.schemas.UpdateOrganizationRequest.minProperties, 1);
const genericResults = [
  { name: 'existing UpdateOrganizationRequest empty', body: {}, expected: false },
  { name: 'existing UpdateOrganizationRequest notes', body: { notes: 'updated' }, expected: true },
].map(({ name, body, expected }) => {
  const result = validateOpenApiRequest('updateOrganization', body);
  assert.equal(result.valid, expected, name);
  if (!expected) assert.ok(result.issues.some(issue => issue.path === '$' && issue.message === 'Expected at least 1 properties.'));
  return { name, expected: expected ? 'VALID' : 'INVALID', actual: result.valid ? 'VALID' : 'INVALID', result: 'PASS' };
});
const files = execFileSync('git', ['diff', '--name-only'], { encoding: 'utf8' }).trim().split('\n');
for (const file of files) {
  if (file === 'src/platform/api/contracts/openApiRuntimeValidation.ts' || file === 'docs/api/openapi.json' || file === 'src/platform/api/generated/commercialApi.ts' || file === 'src/platform/api/contracts/generatedOpenApiRuntimeContract.ts' || file === 'docs/api/openapi.sha256') continue;
  const old = execFileSync('git', ['show', `HEAD:${file}`], { encoding: 'utf8', maxBuffer: 20e6 });
  const current = fs.readFileSync(file, 'utf8');
  assert.equal(current.replace(/[a-f0-9]{64}/g, '<checksum>').replace(/\r\n/g, '\n'), old.replace(/[a-f0-9]{64}/g, '<checksum>').replace(/\r\n/g, '\n'), `Unrelated generated drift: ${file}`);
}
const oldRuntime = execFileSync('git', ['show', 'HEAD:src/platform/api/contracts/generatedOpenApiRuntimeContract.ts'], { encoding: 'utf8', maxBuffer: 20e6 });
const currentRuntime = fs.readFileSync('src/platform/api/contracts/generatedOpenApiRuntimeContract.ts', 'utf8');
const parseRuntime = (source: string) => JSON.parse(source.split('export const OPENAPI_RUNTIME_SCHEMAS = ')[1]!.split(' as const;')[0]!);
const previousRuntime = parseRuntime(oldRuntime);
const nextRuntime = parseRuntime(currentRuntime);
assert.deepEqual(nextRuntime.UpdateContactRequest, schema);
nextRuntime.UpdateContactRequest = previousRuntime.UpdateContactRequest;
assert.deepEqual(nextRuntime, previousRuntime);
const oldClient = execFileSync('git', ['show', 'HEAD:src/platform/api/generated/commercialApi.ts'], { encoding: 'utf8', maxBuffer: 20e6 });
const currentClient = fs.readFileSync('src/platform/api/generated/commercialApi.ts', 'utf8');
const interfacePattern = /export interface UpdateContactRequest \{[\s\S]*?\n\}/;
const beforeType = oldClient.match(interfacePattern)![0];
const afterType = currentClient.match(interfacePattern)![0];
assert.match(afterType, /fullName\?: string;/);
assert.match(afterType, /ownerId\?: EntityId \| null;/);
assert.equal(currentClient.replace(interfacePattern, '<Contact>').replace(/[a-f0-9]{64}/g, '<checksum>'), oldClient.replace(interfacePattern, '<Contact>').replace(/[a-f0-9]{64}/g, '<checksum>'));
fs.writeFileSync('review-artifacts/contact-validator-results.json', JSON.stringify({ results, genericResults, constraintsPreserved: true, unrelatedApiDrift: 'NONE', beforeType, afterType, schema, files }, null, 2) + '\n');
console.log(`Contact runtime validator: PASS (${results.length} cases); constraints preserved; unrelated API drift NONE.`);
