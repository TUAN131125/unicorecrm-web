import assert from 'node:assert/strict';
import { findBreakingChanges, schemaUsage, parameterCompatibilityViews } from '../../../scripts/api/openapi/breaking-changes.mjs';
let count = 0;
export const proofs = [];
function snapshot(schema, role = 'REQUEST', extra = {}) {
  return { schemas: { Root: schema, ...extra }, operations: [{ operationId: 'test', method: 'PATCH', path: '/test', parameters: [], requestBody: role !== 'RESPONSE' ? { schema: 'Root' } : null, success: role !== 'REQUEST' ? { status: '200', schema: 'Root' } : null }] };
}
function test(name, before, after, requestBreaking, responseBreaking, extraBefore = {}, extraAfter = extraBefore) {
  for (const [role, expected] of [['REQUEST', requestBreaking], ['RESPONSE', responseBreaking], ['SHARED', requestBreaking || responseBreaking]]) {
    const findings = findBreakingChanges(snapshot(before, role, extraBefore), snapshot(after, role, extraAfter));
    assert.equal(findings.length > 0, expected, `${name} ${role}: ${JSON.stringify(findings)}`);
    proofs.push(`${name} ${role}`); count++;
  }
}
const string = { type: 'string' };
const nullable = { anyOf: [string, { type: 'null' }] };
test('nullable widening anyOf', string, nullable, false, true);
test('nullable narrowing anyOf', nullable, string, true, false);
test('nullable widening type array', string, { type: ['string', 'null'] }, false, true);
test('nullable equivalent representation', nullable, { type: ['null', 'string'] }, false, false);
test('enum add', { type: 'string', enum: ['A', 'B'] }, { type: 'string', enum: ['A', 'B', 'C'] }, false, true);
test('enum remove', { type: 'string', enum: ['A', 'B'] }, { type: 'string', enum: ['A'] }, true, false);
const object = { type: 'object', additionalProperties: false, properties: { name: string } };
test('required add', object, { ...object, required: ['name'] }, true, false);
test('required remove', { ...object, required: ['name'] }, object, false, true);
const patchObject = { ...object, properties: { name: string, notes: string } };
test('exact required-to-minProperties transition', { ...patchObject, required: ['name'] }, { ...patchObject, minProperties: 1 }, false, true);
test('minProperties uncompensated', object, { ...object, minProperties: 1 }, true, false);
for (const [key, type] of [['minimum', 'number'], ['minLength', 'string'], ['minItems', 'array'], ['minProperties', 'object']]) {
  test(`${key} tighten`, { type, [key]: 2 }, { type, [key]: 3 }, true, false);
  test(`${key} loosen`, { type, [key]: 3 }, { type, [key]: 2 }, false, true);
  test(`${key} introduced`, { type }, { type, [key]: 1 }, true, false);
}
for (const [key, type] of [['maximum', 'number'], ['maxLength', 'string'], ['maxItems', 'array'], ['maxProperties', 'object']]) {
  test(`${key} tighten`, { type, [key]: 100 }, { type, [key]: 50 }, true, false);
  test(`${key} loosen`, { type, [key]: 50 }, { type, [key]: 100 }, false, true);
  test(`${key} removed`, { type, [key]: 100 }, { type }, false, true);
}
for (const [name, value] of [['pattern', '^a'], ['format', 'email']]) {
  test(`${name} add`, string, { ...string, [name]: value }, true, false);
  test(`${name} remove`, { ...string, [name]: value }, string, false, true);
  test(`${name} changed conservative`, { ...string, [name]: value }, { ...string, [name]: 'other' }, true, true);
}
test('type widening', string, { type: ['string', 'number'] }, false, true);
test('property removed closed', object, { ...object, properties: {} }, true, false);
test('property added closed', { ...object, properties: {} }, object, false, true);
test('items constraint', { type: 'array', items: string }, { type: 'array', items: { ...string, maxLength: 5 } }, true, false);
for (const [name, before, after, req, res] of [
  ['true to false', true, false, true, false], ['false to true', false, true, false, true],
  ['true to schema', true, string, true, false], ['schema to true', string, true, false, true],
  ['schema to false', string, false, true, false], ['false to schema', false, string, false, true],
  ['schema constraint', string, { ...string, maxLength: 5 }, true, false],
]) test(`additionalProperties ${name}`, { type: 'object', additionalProperties: before }, { type: 'object', additionalProperties: after }, req, res);
test('nested enum anyOf', { anyOf: [{ type: 'string', enum: ['A'] }, { type: 'null' }] }, { anyOf: [{ type: 'string', enum: ['A', 'B'] }, { type: 'null' }] }, false, true);
test('composition ordering', nullable, { anyOf: [{ type: 'null' }, string] }, false, false);
test('oneOf widening', { oneOf: [string] }, { oneOf: [string, { type: 'number' }] }, false, true);
test('oneOf narrowing', { oneOf: [string, { type: 'number' }] }, { oneOf: [string] }, true, false);
test('allOf referenced bounds', { allOf: [{ $ref: '#/components/schemas/Bound' }] }, { allOf: [{ $ref: '#/components/schemas/Bound' }] }, true, false, { Bound: { type: 'string', maxLength: 10 } }, { Bound: { type: 'string', maxLength: 5 } });
test('ref equivalent rename', { $ref: '#/components/schemas/A' }, { $ref: '#/components/schemas/B' }, false, false, { A: string }, { B: string });
test('stable ref changed', { $ref: '#/components/schemas/A' }, { $ref: '#/components/schemas/A' }, true, false, { A: string }, { A: { ...string, maxLength: 5 } });
const graph = snapshot({ type: 'object', properties: { nested: { $ref: '#/components/schemas/Props' } }, items: { $ref: '#/components/schemas/Items' }, additionalProperties: { $ref: '#/components/schemas/Map' }, allOf: [{ $ref: '#/components/schemas/All' }], anyOf: [{ $ref: '#/components/schemas/Any' }], oneOf: [{ $ref: '#/components/schemas/One' }] }, 'REQUEST', {
  Props: { properties: { cycle: { $ref: '#/components/schemas/Root' }, shared: { $ref: '#/components/schemas/Shared' } } }, Items: string, Map: string, All: string, Any: string, One: string, Shared: string, Response: { properties: { shared: { $ref: '#/components/schemas/Shared' } } }, Unreachable: string,
});
graph.operations[0].success = { status: '200', schema: 'Response' };
const roles = schemaUsage(graph);
for (const name of ['Root', 'Props', 'Items', 'Map', 'All', 'Any', 'One']) assert.equal(roles[name], 'REQUEST_ONLY', name);
assert.equal(roles.Shared, 'SHARED'); assert.equal(roles.Response, 'RESPONSE_ONLY'); assert.equal(roles.Unreachable, 'UNREACHABLE');
assert.deepEqual(findBreakingChanges(graph, structuredClone(graph)), []);
proofs.push('graph roles/cycles/properties/items/maps/allOf/anyOf/oneOf');
function parameterCase(name, previous, current, expected) {
  const b = snapshot(string), c = snapshot(string);
  b.operations[0].parameters = [previous]; c.operations[0].parameters = current ? [current] : [];
  const findings = findBreakingChanges(b, c); assert.equal(findings.length > 0, expected, `${name}: ${findings}`); proofs.push(name); count++;
}
const param = (schema, required = false) => ({ in: 'query', name: 'p', required, schema });
parameterCase('parameter legacy equivalent inline', param({ ref: null, type: 'string', format: null, pattern: null }), param(string), false);
parameterCase('parameter legacy ref equivalent', param({ ref: 'Root', type: null, format: null, pattern: null }), param({ $ref: '#/components/schemas/Root' }), false);
parameterCase('parameter optional to required', param(string), param(string, true), true);
parameterCase('parameter enum removal', param({ ...string, enum: ['A', 'B'] }), param({ ...string, enum: ['A'] }), true);
parameterCase('parameter tightening', param({ ...string, maxLength: 10 }), param({ ...string, maxLength: 5 }), true);
parameterCase('parameter schema removal', param(string), param(undefined), true);
parameterCase('parameter removal', param(string), null, true);
assert.deepEqual(parameterCompatibilityViews({ ref: null, type: 'string', format: null, pattern: null }, { type: 'string', maxLength: 5 }).unknownLegacyFields, ['maxLength']);
console.log(`Round2B regression PASS: ${count} directional/parameter cases plus graph and legacy evidence proofs.`);

const accepted = snapshot(object);
const preCorrection = snapshot({ ...object, required: ['name'] });
const postCorrection = snapshot({ ...object, minProperties: 1 });
const inheritedBefore = findBreakingChanges(accepted, preCorrection);
const inheritedAfter = findBreakingChanges(accepted, postCorrection);
assert.deepEqual(inheritedAfter.filter(finding => !inheritedBefore.includes(finding)), []);
assert.ok(inheritedAfter.some(finding => finding.includes('minProperties')));
proofs.push('canonical inherited empty-object exclusion: required versus minProperties');

test('integer-to-number', { type: 'integer' }, { type: 'number' }, false, true);
test('oneOf overlap excludes old values', { oneOf: [{ type: 'string', enum: ['A'] }, { type: 'string', enum: ['B'] }] }, { oneOf: [{ type: 'string', enum: ['A', 'B'] }, { type: 'string', enum: ['B'] }] }, true, false);
const cyclic = snapshot({ allOf: [{ $ref: '#/components/schemas/Root' }] });
assert.deepEqual(findBreakingChanges(cyclic, structuredClone(cyclic)), []);
proofs.push('allOf recursive reference termination');
console.log('Extended exclusive-composition and recursive-allOf proofs PASS.');
test('allOf order invariance', { allOf: [{ type: 'string' }, { maxLength: 5 }] }, { allOf: [{ maxLength: 5 }, { type: 'string' }] }, false, false);
test('oneOf order invariance', { oneOf: [string, { type: 'null' }] }, { oneOf: [{ type: 'null' }, string] }, false, false);
for (const parameterLocation of ['path', 'query', 'header', 'cookie']) {
  const parameterGraph = snapshot(string, 'RESPONSE', { ParameterRoot: { properties: { nested: { $ref: '#/components/schemas/NestedParameter' } } }, NestedParameter: string });
  parameterGraph.operations[0].parameters.push({ in: parameterLocation, name: 'input', schema: { $ref: '#/components/schemas/ParameterRoot' } });
  assert.equal(schemaUsage(parameterGraph).ParameterRoot, 'REQUEST_ONLY');
  assert.equal(schemaUsage(parameterGraph).NestedParameter, 'REQUEST_ONLY');
  proofs.push(`parameter ${parameterLocation} transitive request root`);
}
console.log(`Final regression PASS: ${count} directional/parameter cases; ${proofs.length} named proofs.`);

const exclusiveAB = { oneOf: [{ type: 'string', enum: ['A'] }, { type: 'string', enum: ['B'] }] };
const exclusiveOverlap = { oneOf: [{ type: 'string', enum: ['A', 'B'] }, { type: 'string', enum: ['B'] }] };
test('oneOf overlap reverse', exclusiveOverlap, exclusiveAB, false, true);
test('oneOf finite disjoint widening', exclusiveAB, { oneOf: [...exclusiveAB.oneOf, { type: 'string', enum: ['C'] }] }, false, true);
test('oneOf finite disjoint narrowing', exclusiveAB, { oneOf: [{ type: 'string', enum: ['A'] }] }, true, false);
test('oneOf finite branch reordering', exclusiveAB, { oneOf: [...exclusiveAB.oneOf].reverse() }, false, false);
test('oneOf collective finite coverage', exclusiveAB, { oneOf: [{ type: 'string', enum: ['A', 'B'] }] }, false, false);
test('oneOf finite sibling constraint', exclusiveAB, { ...exclusiveAB, enum: ['A'] }, true, false);
test('oneOf finite referenced overlap', { oneOf: [{ $ref: '#/components/schemas/Choices' }, { type: 'string', enum: ['B'] }] }, exclusiveAB, false, true, { Choices: { type: 'string', enum: ['A', 'B'] } });
// Infinite regex branches may overlap, and exact regex language inclusion is
// outside this comparator's proof rules. Conservative findings are intentional.
test('oneOf infinite overlap unproven', { oneOf: [{ type: 'string', pattern: '^a' }, { type: 'string', pattern: '^b' }] }, { oneOf: [{ type: 'string', pattern: '^[ab]' }, { type: 'string', pattern: '^b' }] }, true, true);
console.log(`Corrected oneOf suite PASS: ${count} cases; ${proofs.length} named proofs.`);
