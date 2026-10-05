import { isDeepStrictEqual } from "node:util";

const refName = (schema) => schema?.$ref?.split("/").at(-1) ?? schema?.ref;
const reference = (name) => typeof name === "string" ? { $ref: `#/components/schemas/${name}` } : name;
const sorted = (values) => [...new Set(values)].sort();

// Roles include parameters and transitive composition/map/array edges.
export function schemaUsage(snapshot) {
  const usage = new Map(Object.keys(snapshot.schemas ?? {}).map((name) => [name, new Set()]));
  function visit(schema, direction, seen) {
    if (!schema || typeof schema !== "object") return;
    const name = refName(schema);
    if (name && snapshot.schemas?.[name]) {
      usage.get(name).add(direction);
      if (!seen.has(name)) visit(snapshot.schemas[name], direction, new Set([...seen, name]));
    }
    for (const value of Object.values(schema.properties ?? {})) visit(value, direction, seen);
    visit(schema.items, direction, seen);
    visit(schema.additionalProperties, direction, seen);
    for (const key of ["allOf", "anyOf", "oneOf"]) for (const member of schema[key] ?? []) visit(member, direction, seen);
  }
  for (const operation of snapshot.operations ?? []) {
    for (const parameter of operation.parameters ?? []) visit(parameter.schema, "REQUEST", new Set());
    visit(reference(operation.requestBody?.schema), "REQUEST", new Set());
    visit(reference(operation.success?.schema), "RESPONSE", new Set());
  }
  return Object.fromEntries([...usage].map(([name, modes]) => [name, modes.size === 2 ? "SHARED" : modes.has("REQUEST") ? "REQUEST_ONLY" : modes.has("RESPONSE") ? "RESPONSE_ONLY" : "UNREACHABLE"]));
}

// Legacy inline snapshots recorded only type/format/pattern. Missing historical
// constraints are unknown, never proof of absence. Keep all available constraints
// and expose these gaps; referenced components retain complete historical schemas.
export function parameterCompatibilityViews(previous, current) {
  function canonical(schema) {
    if (!schema || typeof schema !== "object" || !Object.hasOwn(schema, "ref")) return schema;
    const result = {};
    for (const [key, value] of Object.entries(schema)) {
      if (value === null || value === undefined) continue;
      result[key === "ref" ? "$ref" : key] = key === "ref" && !value.startsWith("#/") ? `#/components/schemas/${value}` : value;
    }
    return result;
  }
  const old = canonical(previous), next = canonical(current);
  const unknownLegacyFields = Object.hasOwn(previous ?? {}, "ref") && !old?.$ref
    ? Object.keys(next ?? {}).filter((key) => !["type", "format", "pattern"].includes(key) && !Object.hasOwn(old, key)).sort() : [];
  return { previous: unknownLegacyFields.length ? { ...Object.fromEntries(unknownLegacyFields.map((key) => [key, next[key]])), ...old } : old,
    current: next, unknownLegacyFields, evidence: unknownLegacyFields.length ? "UNKNOWN_LEGACY_EVIDENCE" : "FULL_RECORDED_SCHEMA" };
}

function resolve(schema, schemas, seen = new Set()) {
  const name = refName(schema);
  if (!name || seen.has(name) || !schemas[name]) return schema;
  const { $ref, ref, ...siblings } = schema;
  return { ...resolve(schemas[name], schemas, new Set([...seen, name])), ...siblings };
}

function intersect(members) {
  const result = {};
  for (const member of members) {
    for (const [key, value] of Object.entries(member)) {
      if (key === "required") result.required = sorted([...(result.required ?? []), ...value]);
      else if (key === "properties") result.properties = { ...result.properties, ...Object.fromEntries(Object.entries(value).map(([name, schema]) => [name, result.properties?.[name] ? { allOf: [result.properties[name], schema] } : schema])) };
      else if (["minimum", "minLength", "minItems", "minProperties"].includes(key)) result[key] = Math.max(result[key] ?? -Infinity, value);
      else if (["maximum", "maxLength", "maxItems", "maxProperties"].includes(key)) result[key] = Math.min(result[key] ?? Infinity, value);
      else if (key === "enum" && result.enum) result.enum = result.enum.filter((item) => value.some((other) => isDeepStrictEqual(item, other)));
      else if (key === "additionalProperties" && result[key] === false) continue;
      else if (result[key] !== undefined && !isDeepStrictEqual(result[key], value)) return null;
      else result[key] = value;
    }
  }
  return result;
}

function expand(schema, schemas, seen = new Set()) {
  const name = refName(schema);
  if (name && seen.has(name)) return schema;
  const nextSeen = name ? new Set([...seen, name]) : seen;
  let result = resolve(schema, schemas);
  if (result?.allOf) {
    const { allOf, ...siblings } = result;
    const merged = intersect([siblings, ...allOf.map((member) => expand(member, schemas, nextSeen))]);
    if (merged) result = merged;
  }
  return result;
}
const types = (schema) => schema?.type === undefined ? null : new Set(Array.isArray(schema.type) ? schema.type : [schema.type]);
function branches(schema) {
  const composition = schema.anyOf ?? schema.oneOf;
  if (composition) {
    const { anyOf, oneOf, ...siblings } = schema;
    return composition.map((branch) => Object.keys(siblings).length ? { allOf: [siblings, branch] } : branch);
  }
  if (Array.isArray(schema.type)) return schema.type.map((type) => ({ ...schema, type, ...(schema.enum ? { enum: schema.enum.filter((value) => type === "null" ? value === null : value !== null) } : {}) }));
  return null;
}

// A finite composition is evaluated as a whole: oneOf accepts a value only
// when exactly one member accepts it. Candidate enumeration is an upper bound;
// membership filters overlaps and applies sibling constraints before inclusion.
function finiteCandidates(schema, schemas, seen = new Set()) {
  if (schema === false) return [];
  if (!schema || typeof schema !== 'object') return null;
  const name = refName(schema);
  if (name && seen.has(name)) return null;
  const nextSeen = name ? new Set([...seen, name]) : seen;
  schema = resolve(schema, schemas);
  if (Array.isArray(schema.enum)) return schema.enum;
  if (Object.hasOwn(schema, 'const')) return [schema.const];
  if (schema.type === 'null') return [null];
  for (const key of ['anyOf', 'oneOf']) if (schema[key]) {
    const members = schema[key].map(member => finiteCandidates(member, schemas, nextSeen));
    if (members.every(member => member !== null)) return members.flat();
  }
  if (schema.allOf) {
    const bounded = schema.allOf.map(member => finiteCandidates(member, schemas, nextSeen)).find(member => member !== null);
    if (bounded !== undefined) return bounded;
  }
  return null;
}

// Unknown keywords/recursive membership/format semantics do not count as proof.
function finiteMembership(schema, value, schemas, seen = new Set()) {
  if (schema === true) return true;
  if (schema === false) return false;
  if (!schema || typeof schema !== 'object') return undefined;
  const name = refName(schema);
  if (name && seen.has(name)) return undefined;
  const nextSeen = name ? new Set([...seen, name]) : seen;
  schema = resolve(schema, schemas);
  const supported = new Set(['type', 'enum', 'const', 'minimum', 'maximum', 'minLength', 'maxLength', 'pattern', 'allOf', 'anyOf', 'oneOf', 'description', 'title', 'example', 'examples']);
  if (Object.keys(schema).some(key => !supported.has(key))) return undefined;
  const allowed = types(schema);
  const valueType = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  if (allowed && !allowed.has(valueType) && !(typeof value === 'number' && Number.isInteger(value) && allowed.has('integer'))) return false;
  if (schema.enum && !schema.enum.some(item => isDeepStrictEqual(item, value))) return false;
  if (Object.hasOwn(schema, 'const') && !isDeepStrictEqual(schema.const, value)) return false;
  if (typeof value === 'number' && ((schema.minimum !== undefined && value < schema.minimum) || (schema.maximum !== undefined && value > schema.maximum))) return false;
  if (typeof value === 'string') {
    const length = [...value].length;
    if ((schema.minLength !== undefined && length < schema.minLength) || (schema.maxLength !== undefined && length > schema.maxLength)) return false;
    if (schema.pattern) { try { if (!new RegExp(schema.pattern, 'u').test(value)) return false; } catch { return undefined; } }
  }
  let unknown = false;
  for (const key of ['allOf', 'anyOf', 'oneOf']) if (schema[key]) {
    const matches = schema[key].map(member => finiteMembership(member, value, schemas, nextSeen));
    const yes = matches.filter(match => match === true).length;
    const maybe = matches.some(match => match === undefined);
    if (key === 'allOf' && matches.includes(false)) return false;
    if (key === 'anyOf' && yes === 0 && !maybe) return false;
    if (key === 'oneOf' && (yes > 1 || (yes === 0 && !maybe))) return false;
    if (maybe && (key !== 'anyOf' || yes === 0)) unknown = true;
  }
  return unknown ? undefined : true;
}

function finiteDomain(schema, schemas) {
  const candidates = finiteCandidates(schema, schemas);
  if (candidates === null) return null;
  const accepted = [];
  for (const value of candidates) {
    const member = finiteMembership(schema, value, schemas);
    if (member === undefined) return null;
    if (member && !accepted.some(other => isDeepStrictEqual(value, other))) accepted.push(value);
  }
  return accepted;
}

// Prove source domain is included in target domain. Request: old ⊆ new.
// Response: new ⊆ old. Unknown regex/composition relations fail conservatively.
function subset(source, target, sourceSchemas, targetSchemas, location, findings, active = new Set()) {
  if (isDeepStrictEqual(source, target) && sourceSchemas === targetSchemas) return;
  const pair = `${JSON.stringify(source)}|${JSON.stringify(target)}`;
  if (active.has(pair)) return;
  const nextActive = new Set([...active, pair]);
  source = expand(source, sourceSchemas); target = expand(target, targetSchemas);
  const fail = (rule) => findings.push(`${location}: ${rule}.`);
  if (source === false || target === true) return;
  if (target === false) { if (source !== false) fail("accepted domain is excluded"); return; }
  source = source === true || source == null ? {} : source;
  if (target == null) { fail("schema contract was removed"); return; }
  if (source.oneOf || target.oneOf) {
    const domain = finiteDomain(source, sourceSchemas);
    if (domain !== null) {
      const membership = domain.map(value => finiteMembership(target, value, targetSchemas));
      if (membership.every(match => match !== undefined)) {
        if (membership.includes(false)) fail('oneOf accepted domain is incompatible');
        return;
      }
    }
  }
  const sourceBranches = branches(source), targetBranches = branches(target);
  if (sourceBranches || targetBranches) {
    for (const branch of sourceBranches ?? [source]) {
      const candidates = (targetBranches ?? [target]).map((candidate) => {
        const issues = []; subset(branch, candidate, sourceSchemas, targetSchemas, location, issues, nextActive); return issues;
      });
      if (!candidates.some((issues) => issues.length === 0)) fail("composition member domain is incompatible");
    }
    // oneOf is exclusive: branch overlap can exclude formerly accepted values.
    // Prove disjointness by types or finite enums; otherwise changed exclusive
    // compositions fail conservatively rather than claiming regex/set equivalence.
    if (target.oneOf) {
      const members = target.oneOf.map((member) => expand(member, targetSchemas));
      const sourceMembers = (source.oneOf ?? []).map((member) => expand(member, sourceSchemas));
      const reorderedEqual = members.length === sourceMembers.length && members.every(member => sourceMembers.some(other => isDeepStrictEqual(member, other)));
      if (!reorderedEqual) for (let i = 0; i < members.length; i++) for (let j = i + 1; j < members.length; j++) {
        const a = members[i], b = members[j], at = types(a), bt = types(b);
        const disjointTypes = at && bt && ![...at].some(type => bt.has(type) || (type === 'integer' && bt.has('number')) || (type === 'number' && bt.has('integer')));
        const disjointEnums = a.enum && b.enum && !a.enum.some(value => b.enum.some(other => isDeepStrictEqual(value, other)));
        if (!disjointTypes && !disjointEnums) fail('oneOf exclusivity compatibility is not proven');
      }
    }
    return;
  }
  for (const key of ["allOf", "anyOf", "oneOf"]) if ((source[key] || target[key]) && !isDeepStrictEqual(source[key], target[key])) fail(`${key} compatibility is not proven`);
  const st = types(source), tt = types(target);
  if (tt && (!st || [...st].some((type) => !tt.has(type) && !(type === "integer" && tt.has("number"))))) fail("type domain is incompatible");
  if (target.enum && (!source.enum || source.enum.some((value) => !target.enum.some((other) => isDeepStrictEqual(value, other))))) fail("enum domain is incompatible");
  if (target.const !== undefined && !isDeepStrictEqual(source.const, target.const) && !(source.enum?.length === 1 && isDeepStrictEqual(source.enum[0], target.const))) fail("const domain is incompatible");
  for (const key of ["minimum", "minLength", "minItems", "minProperties"]) {
    let sourceBound = source[key] ?? (["minimum"].includes(key) ? -Infinity : 0);
    if (key === "minProperties") sourceBound = Math.max(sourceBound, new Set(source.required ?? []).size);
    const targetBound = key === "minProperties"
      ? Math.max(target[key] ?? 0, new Set(target.required ?? []).size) : target[key];
    // Canonicalize implicit required cardinality with explicit minProperties:
    // the same empty-object exclusion has one identity across historical edits.
    if (targetBound !== undefined && sourceBound < targetBound) fail(`${key} domain is incompatible`);
  }
  for (const key of ["maximum", "maxLength", "maxItems", "maxProperties"]) if (target[key] !== undefined && (source[key] ?? Infinity) > target[key]) fail(`${key} domain is incompatible`);
  for (const key of ["pattern", "format"]) if (target[key] !== undefined && source[key] !== target[key]) fail(`${key} compatibility is not proven`);
  const sourceRequired = new Set(source.required ?? []);
  for (const name of target.required ?? []) if (!sourceRequired.has(name)) fail(`${name} presence is not guaranteed`);
  const sp = source.properties ?? {}, tp = target.properties ?? {};
  const sa = source.additionalProperties ?? true, ta = target.additionalProperties ?? true;
  for (const name of sorted([...Object.keys(sp), ...Object.keys(tp)])) {
    const from = Object.hasOwn(sp, name) ? sp[name] : sa;
    const to = Object.hasOwn(tp, name) ? tp[name] : ta;
    if (from !== false) subset(from, to, sourceSchemas, targetSchemas, `${location}.${name}`, findings, nextActive);
  }
  if (sa !== false) subset(sa, ta, sourceSchemas, targetSchemas, `${location}.additionalProperties`, findings, nextActive);
  if (source.items || target.items) subset(source.items ?? true, target.items ?? true, sourceSchemas, targetSchemas, `${location}[]`, findings, nextActive);
  if (refName(source) || refName(target)) {
    if (!isDeepStrictEqual(source, target)) fail("unresolved reference compatibility is not proven");
  }
}

export function findBreakingChanges(baseline, current) {
  const findings = [], oldSchemas = baseline.schemas ?? {}, newSchemas = current.schemas ?? {};
  const oldRoles = schemaUsage(baseline), newRoles = schemaUsage(current);
  function compare(old, next, location, direction) {
    subset(direction === "REQUEST" ? old : next, direction === "REQUEST" ? next : old,
      direction === "REQUEST" ? oldSchemas : newSchemas, direction === "REQUEST" ? newSchemas : oldSchemas,
      `${location} [${direction}]`, findings);
  }
  const operations = new Map((current.operations ?? []).map((operation) => [operation.operationId, operation]));
  for (const old of baseline.operations ?? []) {
    const next = operations.get(old.operationId), location = `Operation ${old.operationId}`;
    if (!next) { findings.push(`${location} was removed.`); continue; }
    if (old.method !== next.method || old.path !== next.path) findings.push(`${location} changed route.`);
    const parameters = new Map((next.parameters ?? []).map((parameter) => [`${parameter.in}:${parameter.name}`, parameter]));
    for (const parameter of old.parameters ?? []) {
      const key = `${parameter.in}:${parameter.name}`, other = parameters.get(key);
      if (!other) { findings.push(`${location} removed parameter ${key}.`); continue; }
      if (!parameter.required && other.required) findings.push(`${location} parameter ${key} became required.`);
      const views = parameterCompatibilityViews(parameter.schema, other.schema);
      compare(views.previous, views.current, `${location} parameter ${key}`, "REQUEST");
    }
    for (const parameter of next.parameters ?? []) if (parameter.required && !(old.parameters ?? []).some((other) => other.in === parameter.in && other.name === parameter.name)) findings.push(`${location} added required parameter ${parameter.in}:${parameter.name}.`);
    if (!old.requestBody && next.requestBody?.required) findings.push(`${location} added required request body.`);
    if (old.requestBody && !next.requestBody) findings.push(`${location} removed request body contract.`);
    if (old.requestBody && next.requestBody) {
      if (!old.requestBody.required && next.requestBody.required) findings.push(`${location} request body became required.`);
      if (old.requestBody.schema !== next.requestBody.schema) compare(reference(old.requestBody.schema), reference(next.requestBody.schema), `${location} request`, "REQUEST");
    }
    if (old.success?.status !== next.success?.status) findings.push(`${location} changed success status.`);
    if (old.success?.schema !== next.success?.schema) compare(reference(old.success?.schema), reference(next.success?.schema), `${location} success`, "RESPONSE");
  }
  for (const [name, old] of Object.entries(oldSchemas)) {
    // Removed component names are safe when all operation/reference bindings
    // resolve to equivalent replacements; compare those bindings, not names.
    if (!Object.hasOwn(newSchemas, name)) continue;
    const roles = [oldRoles[name], newRoles[name]];
    for (const direction of ["REQUEST", "RESPONSE"]) if (roles.some((role) => role === "SHARED" || role === `${direction}_ONLY`)) compare(old, newSchemas[name], `Schema ${name}`, direction);
  }
  return sorted(findings);
}

export function assertNoBreakingChanges(baseline, current) {
  const findings = findBreakingChanges(baseline, current);
  if (findings.length) throw new Error(`OpenAPI breaking changes require explicit baseline approval:\n- ${findings.join("\n- ")}`);
  return findings;
}
