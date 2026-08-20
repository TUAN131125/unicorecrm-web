function byId(items, key) {
  return new Map(items.map((item) => [item[key], item]));
}

function schemaKind(schema) {
  if (schema?.$ref) return `ref:${schema.$ref}`;
  if (schema?.type) return `type:${Array.isArray(schema.type) ? schema.type.join("|") : schema.type}`;
  if (schema?.enum) return "enum";
  if (schema?.oneOf) return "oneOf";
  if (schema?.anyOf) return "anyOf";
  if (schema?.allOf) return "allOf";
  return "object";
}

function compareSchema(previous, current, location, findings) {
  if (previous === current) return;
  if (previous === null || previous === undefined) return;
  if (current === null || current === undefined) {
    findings.push(`${location} was removed.`);
    return;
  }
  if (typeof previous !== "object" || typeof current !== "object") {
    if (previous !== current) findings.push(`${location} changed from ${JSON.stringify(previous)} to ${JSON.stringify(current)}.`);
    return;
  }
  if (schemaKind(previous) !== schemaKind(current)) {
    findings.push(`${location} changed schema kind from ${schemaKind(previous)} to ${schemaKind(current)}.`);
    return;
  }
  for (const key of ["$ref", "ref", "type", "format"]) {
    const previousValue = previous[key];
    const currentValue = current[key];
    const unchanged = Array.isArray(previousValue) && Array.isArray(currentValue)
      ? previousValue.length === currentValue.length && previousValue.every((value, index) => value === currentValue[index])
      : previousValue === currentValue;
    if (previousValue !== undefined && !unchanged) {
      findings.push(`${location}.${key} changed from ${JSON.stringify(previousValue)} to ${JSON.stringify(currentValue)}.`);
    }
  }
  if (Array.isArray(previous.enum)) {
    const currentValues = new Set(current.enum ?? []);
    for (const value of previous.enum) if (!currentValues.has(value)) findings.push(`${location} removed enum value ${JSON.stringify(value)}.`);
  }
  const previousRequired = new Set(previous.required ?? []);
  const currentRequired = new Set(current.required ?? []);
  for (const name of currentRequired) if (!previousRequired.has(name)) findings.push(`${location}.${name} became required.`);
  const previousProperties = previous.properties ?? {};
  const currentProperties = current.properties ?? {};
  for (const [name, schema] of Object.entries(previousProperties)) {
    if (!(name in currentProperties)) findings.push(`${location}.${name} was removed.`);
    else compareSchema(schema, currentProperties[name], `${location}.${name}`, findings);
  }
  if (previous.items) compareSchema(previous.items, current.items, `${location}[]`, findings);
  if (previous.additionalProperties === true && current.additionalProperties === false) {
    findings.push(`${location} no longer allows additional properties.`);
  }
  for (const key of ["minimum", "minLength", "minItems"]) {
    if (typeof previous[key] === "number" && typeof current[key] === "number" && current[key] > previous[key]) {
      findings.push(`${location}.${key} was tightened from ${previous[key]} to ${current[key]}.`);
    }
  }
  for (const key of ["maximum", "maxLength", "maxItems"]) {
    if (typeof previous[key] === "number" && typeof current[key] === "number" && current[key] < previous[key]) {
      findings.push(`${location}.${key} was tightened from ${previous[key]} to ${current[key]}.`);
    }
  }
  if (previous.pattern !== undefined && current.pattern !== previous.pattern) findings.push(`${location}.pattern changed.`);
}

export function findBreakingChanges(baseline, current) {
  const findings = [];
  const baselineOperations = byId(baseline.operations ?? [], "operationId");
  const currentOperations = byId(current.operations ?? [], "operationId");
  for (const [operationId, previous] of baselineOperations) {
    const next = currentOperations.get(operationId);
    if (!next) {
      findings.push(`Operation ${operationId} was removed.`);
      continue;
    }
    if (previous.method !== next.method || previous.path !== next.path) {
      findings.push(`Operation ${operationId} changed route from ${previous.method} ${previous.path} to ${next.method} ${next.path}.`);
    }
    const previousParameters = new Map((previous.parameters ?? []).map((parameter) => [`${parameter.in}:${parameter.name}`, parameter]));
    const currentParameters = new Map((next.parameters ?? []).map((parameter) => [`${parameter.in}:${parameter.name}`, parameter]));
    for (const [key, parameter] of previousParameters) {
      const currentParameter = currentParameters.get(key);
      if (!currentParameter) findings.push(`Operation ${operationId} removed parameter ${key}.`);
      else {
        if (!parameter.required && currentParameter.required) findings.push(`Operation ${operationId} parameter ${key} became required.`);
        compareSchema(parameter.schema, currentParameter.schema, `Operation ${operationId} parameter ${key}`, findings);
      }
    }
    for (const [key, parameter] of currentParameters) {
      if (!previousParameters.has(key) && parameter.required) findings.push(`Operation ${operationId} added required parameter ${key}.`);
    }
    if (previous.requestBody === null && next.requestBody?.required) findings.push(`Operation ${operationId} added a required request body.`);
    if (previous.requestBody && !next.requestBody) findings.push(`Operation ${operationId} removed its request body contract.`);
    if (previous.requestBody && next.requestBody && !previous.requestBody.required && next.requestBody.required) {
      findings.push(`Operation ${operationId} request body became required.`);
    }
    if (previous.requestBody && next.requestBody && previous.requestBody.schema !== next.requestBody.schema) {
      findings.push(`Operation ${operationId} changed request schema from ${previous.requestBody.schema} to ${next.requestBody.schema}.`);
    }
    if (previous.success?.status !== next.success?.status || previous.success?.schema !== next.success?.schema) {
      findings.push(`Operation ${operationId} changed its success response contract.`);
    }
  }

  for (const [name, previousSchema] of Object.entries(baseline.schemas ?? {})) {
    const currentSchema = current.schemas?.[name];
    if (!currentSchema) findings.push(`Schema ${name} was removed.`);
    else compareSchema(previousSchema, currentSchema, `Schema ${name}`, findings);
  }
  return [...new Set(findings)].sort();
}

export function assertNoBreakingChanges(baseline, current) {
  const findings = findBreakingChanges(baseline, current);
  if (findings.length > 0) {
    throw new Error(`OpenAPI breaking changes require explicit baseline approval:\n- ${findings.join("\n- ")}`);
  }
  return findings;
}
