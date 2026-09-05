import http from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

const DEFAULT_HOST = "127.0.0.1";
const TOKEN_MEMBERSHIPS = new Map([
  ["connected-fixture-token-alpha", new Set(["workspace-alpha"])],
  ["connected-fixture-token-beta", new Set(["workspace-beta"])],
  ["connected-fixture-token-multi", new Set(["workspace-alpha", "workspace-beta"])],
]);
const RESOURCE_PATHS = [
  "/commercial-evidence",
  "/contacts",
  "/customers",
  "/deals",
  "/invoices",
  "/leads",
  "/orders",
  "/organizations",
  "/payments",
  "/products",
  "/quotes",
  "/returns",
  "/shipping",
  "/support/cases",
  "/tasks",
];

export function createConnectedApiTestHost(options = {}) {
  const state = createState(options.seed, options.contractMode ?? "projection");
  const server = http.createServer((request, response) => {
    void handleRequest(request, response, state).catch((error) => {
      sendError(response, 500, "TEST_HOST_FAILURE", error instanceof Error ? error.message : String(error), {
        retryable: false,
      });
    });
  });

  return {
    state,
    async start() {
      if (server.listening) return addressOf(server);
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(options.port ?? 0, options.host ?? DEFAULT_HOST, () => {
          server.off("error", reject);
          resolve();
        });
      });
      return addressOf(server);
    },
    async stop() {
      if (!server.listening) return;
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      if (typeof server.closeAllConnections === "function") server.closeAllConnections();
    },
  };
}

function createState(seedOverride, contractMode) {
  const workspaces = new Map();
  const seeds = seedOverride ?? (contractMode === "openapi" ? defaultOpenApiSeed() : defaultSeed());
  for (const [workspaceId, resources] of Object.entries(seeds)) {
    const resourceMap = new Map();
    for (const resourcePath of RESOURCE_PATHS) {
      const records = resources[resourcePath] ?? [];
      resourceMap.set(resourcePath, new Map(records.map((data) => [data.id, { data: structuredClone(data), version: 1 }])));
    }
    workspaces.set(workspaceId, resourceMap);
  }
  return {
    contractMode,
    workspaces,
    idempotency: new Map(),
    requestCounts: new Map(),
    audit: new Map(),
  };
}

async function handleRequest(request, response, state) {
  setCorsHeaders(response);
  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  const url = new URL(request.url ?? "/", "http://connected.test");
  if (request.method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, { status: "ok", authority: "connected-api-test-host" });
    return;
  }

  const principal = authenticate(request, response);
  if (!principal) return;
  const workspaceId = authorizeWorkspace(request, response, principal);
  if (!workspaceId) return;

  if (request.method === "GET" && url.pathname === "/test/retry-once") {
    handleRetryOnce(request, response, state, workspaceId, url);
    return;
  }
  if (request.method === "GET" && url.pathname === "/test/state") {
    const resources = state.workspaces.get(workspaceId);
    sendJson(response, 200, {
      workspaceId,
      counts: Object.fromEntries([...resources.entries()].map(([resource, records]) => [resource, records.size])),
    });
    return;
  }
  if (request.method === "GET" && url.pathname.startsWith("/access/effective-record-access/")) {
    const resourceKey = decodeURIComponent(url.pathname.slice("/access/effective-record-access/".length));
    sendJson(response, 200, {
      workspaceId,
      resourceKey,
      ...(url.searchParams.get("recordId") ? { recordId: url.searchParams.get("recordId") } : {}),
      canRead: true,
      canUpdate: true,
      canDelete: false,
      canExport: true,
      canApprove: true,
      allowedCommands: (url.searchParams.get("commands") ?? "").split(",").filter(Boolean),
      fieldAccess: {},
      decisionReasons: [{ code: "FIXTURE_ALLOWED", effect: "ALLOW", source: "connected-test-host" }],
      evaluatedAt: new Date().toISOString(),
    });
    return;
  }
  if (request.method === "GET" && url.pathname.startsWith("/integrations/capability-health/")) {
    const capabilityKey = decodeURIComponent(url.pathname.slice("/integrations/capability-health/".length));
    sendJson(response, 200, {
      workspaceId,
      capabilityKey,
      status: "HEALTHY",
      accessMode: "READ_ONLY",
      sourceOfTruth: "EXTERNAL",
      reasonCodes: [],
      evaluatedAt: new Date().toISOString(),
    });
    return;
  }
  if (request.method === "GET" && url.pathname === "/audit/events") {
    sendJson(response, 200, {
      workspaceId,
      items: structuredClone(state.audit.get(workspaceId) ?? []),
    });
    return;
  }
  if (request.method === "POST" && url.pathname.startsWith("/workflows/")) {
    await handleWorkflow(request, response, state, workspaceId, principal.token, url.pathname);
    return;
  }

  const match = matchResource(url.pathname);
  if (!match) {
    sendError(response, 404, "RESOURCE_NOT_FOUND", `No connected test route owns ${url.pathname}.`);
    return;
  }
  const records = state.workspaces.get(workspaceId)?.get(match.resourcePath);
  if (!records) {
    sendError(response, 404, "RESOURCE_NOT_FOUND", `Workspace ${workspaceId} has no ${match.resourcePath} store.`);
    return;
  }

  if (request.method === "GET" && !match.id) {
    let items = [...records.values()].map((entry) => structuredClone(entry.data));
    if (state.contractMode === "openapi" && match.resourcePath === "/leads") {
      const search = url.searchParams.get("search")?.trim().toLowerCase();
      const workState = url.searchParams.get("workState");
      const ownerId = url.searchParams.get("ownerId");
      if (search) items = items.filter((item) => `${item.id} ${item.displayName} ${item.phone ?? ""}`.toLowerCase().includes(search));
      if (workState) items = items.filter((item) => item.leadWorkState === workState);
      if (ownerId) items = items.filter((item) => item.ownerId === ownerId);
      const offset = Number(url.searchParams.get("cursor")?.replace("offset:", "") ?? 0);
      const limit = Math.max(1, Math.min(250, Number(url.searchParams.get("limit") ?? 50)));
      const pageItems = items.slice(offset, offset + limit);
      const hasNextPage = offset + limit < items.length;
      sendJson(response, 200, {
        items: pageItems,
        pageInfo: {
          hasNextPage,
          ...(hasNextPage ? { nextCursor: `offset:${offset + limit}` } : {}),
          totalCount: items.length,
        },
      });
      return;
    }
    sendJson(response, 200, { items, pageInfo: { hasNextPage: false, totalCount: items.length } });
    return;
  }
  if (request.method === "GET" && match.id && !match.operation) {
    const entry = records.get(match.id);
    if (!entry) {
      sendError(response, 404, "RESOURCE_NOT_FOUND", `${match.resourcePath} record ${match.id} was not found.`);
      return;
    }
    response.setHeader("ETag", `\"${entry.version}\"`);
    sendJson(response, 200, structuredClone(entry.data));
    return;
  }
  if (request.method === "POST" || (request.method === "PUT" && state.contractMode === "openapi" && match.resourcePath === "/leads")) {
    if (state.contractMode === "openapi" && match.resourcePath === "/leads") {
      await handleOpenApiLeadMutation(request, response, state, workspaceId, principal.token, match, records);
    } else {
      await handleMutation(request, response, state, workspaceId, principal.token, match, records);
    }
    return;
  }

  sendError(response, 405, "METHOD_NOT_ALLOWED", `${request.method} is not supported for ${url.pathname}.`);
}

function authenticate(request, response) {
  const authorization = request.headers.authorization?.trim() ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : "";
  const memberships = TOKEN_MEMBERSHIPS.get(token);
  if (!memberships) {
    sendError(response, 401, "AUTHENTICATION_REQUIRED", "The connected test host requires a valid bearer token.", {
      retryable: false,
    });
    return undefined;
  }
  return { token, memberships };
}

function authorizeWorkspace(request, response, principal) {
  const raw = request.headers["x-workspace-id"];
  const workspaceId = Array.isArray(raw) ? raw[0] : raw;
  if (!workspaceId?.trim()) {
    sendError(response, 400, "WORKSPACE_CONTEXT_REQUIRED", "X-Workspace-Id is required.");
    return undefined;
  }
  if (!principal.memberships.has(workspaceId)) {
    sendError(response, 403, "WORKSPACE_ACCESS_DENIED", `The bearer token cannot access ${workspaceId}.`);
    return undefined;
  }
  return workspaceId;
}

async function handleOpenApiLeadMutation(request, response, state, workspaceId, token, match, records) {
  const body = await readJsonBody(request, response);
  if (body === INVALID_BODY) return;
  const idempotencyKey = request.headers["idempotency-key"]?.toString().trim();
  if (!idempotencyKey) {
    sendError(response, 400, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key is required for connected mutations.");
    return;
  }
  const fingerprint = mutationFingerprint(request.method, request.url ?? "", body);
  const scope = `${token}\u0000${workspaceId}\u0000${idempotencyKey}`;
  const existing = state.idempotency.get(scope);
  if (existing) {
    if (existing.fingerprint !== fingerprint) {
      sendError(response, 409, "IDEMPOTENCY_KEY_REUSED", "The idempotency key was reused with a different request payload.");
      return;
    }
    for (const [name, value] of Object.entries(existing.headers)) response.setHeader(name, value);
    sendJson(response, existing.status, structuredClone(existing.payload));
    return;
  }

  if (match.operation === "qualify") {
    const entry = records.get(match.id);
    if (!entry) {
      sendError(response, 404, "RESOURCE_NOT_FOUND", `Lead ${match.id} was not found.`);
      return;
    }
    const expectedVersion = parseIfMatch(request.headers["if-match"]);
    if (expectedVersion === undefined || expectedVersion !== entry.version) {
      sendError(response, 412, "RESOURCE_VERSION_CONFLICT", `Expected version ${expectedVersion ?? "missing"}, current version ${entry.version}.`, {
        details: { expectedVersion, currentVersion: entry.version },
      });
      return;
    }
    const now = new Date().toISOString();
    const dealId = `fixture-deal-${randomUUID()}`;
    entry.data = { ...entry.data, leadWorkState: "CLOSED", qualificationOutcome: "OPPORTUNITY", dealRef: dealId, qualifiedDealId: dealId, version: entry.version + 1, updatedAt: now };
    entry.version += 1;
    const payload = {
      lead: structuredClone(entry.data),
      deal: {
        id: dealId,
        title: typeof body.dealTitle === "string" && body.dealTitle.trim() ? body.dealTitle.trim() : `Qualified ${entry.data.displayName}`,
        leadId: entry.data.id,
        stage: "OPEN",
        estimatedValue: structuredClone(entry.data.estimatedValue),
        version: 1,
        createdAt: now,
        updatedAt: now,
      },
    };
    const headers = { ETag: `"${entry.version}"` };
    state.idempotency.set(scope, { fingerprint, status: 200, payload, headers });
    for (const [name, value] of Object.entries(headers)) response.setHeader(name, value);
    sendJson(response, 200, payload);
    return;
  }

  if (["advance-work-state", "disqualify", "reopen"].includes(match.operation)) {
    const entry = records.get(match.id);
    if (!entry) {
      sendError(response, 404, "RESOURCE_NOT_FOUND", `Lead ${match.id} was not found.`);
      return;
    }
    const expectedVersion = parseIfMatch(request.headers["if-match"]);
    if (expectedVersion === undefined || expectedVersion !== entry.version) {
      sendError(response, 412, "RESOURCE_VERSION_CONFLICT", `Expected version ${expectedVersion ?? "missing"}, current version ${entry.version}.`, {
        details: { expectedVersion, currentVersion: entry.version },
      });
      return;
    }
    const now = new Date().toISOString();
    if (match.operation === "advance-work-state") {
      const target = body.targetWorkState;
      const allowed = entry.data.leadWorkState === target
        || (entry.data.leadWorkState === "NEW" && target === "CONTACTING")
        || (entry.data.leadWorkState === "CONTACTING" && target === "VERIFYING");
      if (!allowed || !["CONTACTING", "VERIFYING"].includes(target)) {
        sendError(response, 409, "LEAD_INVALID_TRANSITION", `Cannot advance Lead from ${entry.data.leadWorkState} to ${target}.`);
        return;
      }
      const profile = target === "VERIFYING" && body.verificationProfile && typeof body.verificationProfile === "object"
        ? body.verificationProfile
        : {};
      entry.data = { ...entry.data, ...profile, leadWorkState: target, version: entry.version + 1, updatedAt: now };
    } else if (match.operation === "disqualify") {
      if (entry.data.leadWorkState === "CLOSED") {
        sendError(response, 409, "LEAD_INVALID_TRANSITION", "A CLOSED Lead cannot be disqualified again.");
        return;
      }
      if (typeof body.reason !== "string" || !body.reason.trim() || typeof body.evidence !== "string" || !body.evidence.trim()) {
        sendError(response, 422, "LEAD_DISQUALIFICATION_EVIDENCE_REQUIRED", "Disqualification reason and evidence are required.", {
          fieldErrors: { reason: ["Reason is required."], evidence: ["Evidence is required."] },
        });
        return;
      }
      entry.data = {
        ...entry.data, leadWorkState: "CLOSED", qualificationOutcome: "DISQUALIFIED",
        version: entry.version + 1, updatedAt: now,
      };
    } else {
      if (entry.data.leadWorkState !== "CLOSED" || entry.data.qualificationOutcome !== "DISQUALIFIED") {
        sendError(response, 409, "LEAD_REOPEN_NOT_ALLOWED", "Only a CLOSED/DISQUALIFIED Lead can be reopened.");
        return;
      }
      entry.data = { ...entry.data, leadWorkState: "CONTACTING", version: entry.version + 1, updatedAt: now };
      delete entry.data.qualificationOutcome;
      delete entry.data.relationshipRef;
      delete entry.data.dealRef;
    }
    entry.version += 1;
    const action = match.operation === "advance-work-state" ? "advance-work-state" : match.operation;
    const payload = authoritativeLeadMutationPayload(action, entry.data, entry.version, now, token, workspaceId, state);
    const headers = { ETag: `"${entry.version}"` };
    state.idempotency.set(scope, { fingerprint, status: 200, payload, headers });
    for (const [name, value] of Object.entries(headers)) response.setHeader(name, value);
    sendJson(response, 200, structuredClone(payload));
    return;
  }

  const validationError = validateLeadProfileBody(body, request.method === "POST");
  if (validationError) {
    sendError(response, 422, "VALIDATION_FAILED", validationError.message, validationError.extras);
    return;
  }

  if (request.method === "PUT") {
    if (!match.id) {
      sendError(response, 405, "METHOD_NOT_ALLOWED", "Lead profile replacement requires a Lead ID.");
      return;
    }
    const entry = records.get(match.id);
    if (!entry) {
      sendError(response, 404, "RESOURCE_NOT_FOUND", `Lead ${match.id} was not found.`);
      return;
    }
    const expectedVersion = parseIfMatch(request.headers["if-match"]);
    if (expectedVersion === undefined || expectedVersion !== entry.version) {
      sendError(response, 412, "RESOURCE_VERSION_CONFLICT", `Expected version ${expectedVersion ?? "missing"}, current version ${entry.version}.`, {
        details: { expectedVersion, currentVersion: entry.version },
      });
      return;
    }
    const now = new Date().toISOString();
    entry.version += 1;
    entry.data = {
      ...leadProfileDocument(body),
      id: entry.data.id,
      leadWorkState: entry.data.leadWorkState,
      ...(entry.data.qualificationOutcome === undefined ? {} : { qualificationOutcome: entry.data.qualificationOutcome }),
      ...(entry.data.relationshipRef === undefined ? {} : { relationshipRef: entry.data.relationshipRef }),
      ...(entry.data.dealRef === undefined ? {} : { dealRef: entry.data.dealRef }),
      score: entry.data.score,
      activityProjection: "NOT_INCLUDED",
      version: entry.version,
      createdAt: entry.data.createdAt,
      updatedAt: now,
    };
    const payload = authoritativeLeadMutationPayload("replace", entry.data, entry.version, now, token, workspaceId, state);
    const headers = { ETag: `"${entry.version}"` };
    state.idempotency.set(scope, { fingerprint, status: 200, payload, headers });
    for (const [name, value] of Object.entries(headers)) response.setHeader(name, value);
    sendJson(response, 200, structuredClone(payload));
    return;
  }

  if (match.id) {
    sendError(response, 405, "METHOD_NOT_ALLOWED", `OpenAPI fixture does not support POST at ${request.url}.`);
    return;
  }
  const now = new Date().toISOString();
  const id = `fixture-lead-${randomUUID()}`;
  const document = {
    ...leadProfileDocument(body, "connected-user"),
    id,
    leadWorkState: "NEW",
    score: 50,
    activityProjection: "NOT_INCLUDED",
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
  records.set(id, { data: document, version: 1 });
  const payload = authoritativeLeadMutationPayload("create", document, 1, now, token, workspaceId, state);
  const headers = { ETag: '"1"' };
  state.idempotency.set(scope, { fingerprint, status: 201, payload, headers });
  for (const [name, value] of Object.entries(headers)) response.setHeader(name, value);
  sendJson(response, 201, structuredClone(payload));
}

function validateLeadProfileBody(body, interactiveCreate) {
  const fieldErrors = {};
  if (typeof body.displayName !== "string" || !body.displayName.trim()) fieldErrors.displayName = ["Display name is required."];
  if (interactiveCreate && ![body.phone, body.workPhone, body.otherPhone, body.email, body.personalEmail, body.zaloId, body.facebook]
    .some((value) => typeof value === "string" && value.trim())) fieldErrors.contactChannel = ["A contact channel is required."];
  if (!interactiveCreate && (typeof body.ownerId !== "string" || !body.ownerId.trim())) fieldErrors.ownerId = ["Owner ID is required."];
  return Object.keys(fieldErrors).length === 0 ? undefined : {
    message: "The Lead profile payload is invalid.",
    extras: { fieldErrors, businessBlockers: ["LEAD_PROFILE_REQUIRED_FIELDS"] },
  };
}

function leadProfileDocument(body, defaultOwnerId) {
  const fields = [
    "salutation", "title", "department", "phone", "workPhone", "otherPhone", "email", "personalEmail", "zaloId", "facebook",
    "preferredChannel", "doNotCall", "doNotEmail", "companyName", "companySize", "industry", "businessType", "website", "taxCode",
    "companyAddress", "country", "province", "district", "ward", "contactAddress", "campaignId", "assignedTeam", "decisionRole", "priority",
    "budgetRange", "purchaseTimeline", "painPoint", "nextFollowUpAt", "followUpNote", "tags", "description", "internalNotes", "customFields",
  ];
  const result = {
    displayName: body.displayName.trim(),
    ...(typeof body.source === "string" && body.source.trim() ? { source: body.source.trim() } : {}),
    ownerId: typeof body.ownerId === "string" && body.ownerId.trim() ? body.ownerId.trim() : defaultOwnerId,
    ...(body.estimatedValue === undefined ? {} : { estimatedValue: structuredClone(body.estimatedValue) }),
    interestedProducts: Array.isArray(body.interestedProducts)
      ? body.interestedProducts.map((item) => ({
          id: `fixture-interest-${randomUUID()}`,
          productId: item.productId,
          productNameSnapshot: item.productId,
          interestLevel: item.interestLevel,
          ...(item.estimatedQuantity === undefined ? {} : { estimatedQuantity: item.estimatedQuantity }),
          ...(item.expectedBudget === undefined ? {} : { expectedBudget: structuredClone(item.expectedBudget) }),
          ...(item.note === undefined ? {} : { note: item.note }),
          createdAt: new Date().toISOString(),
        }))
      : [],
  };
  for (const field of fields) if (body[field] !== undefined) result[field] = structuredClone(body[field]);
  return result;
}

function authoritativeLeadMutationPayload(action, document, version, occurredAt, token, workspaceId, state) {
  const commandId = `fixture-command-${randomUUID()}`;
  const correlationId = `fixture-correlation-${randomUUID()}`;
  const auditEvidenceId = `fixture-audit-${randomUUID()}`;
  const payload = {
    commandId,
    correlationId,
    aggregateId: document.id,
    aggregateType: "Lead",
    version,
    occurredAt,
    outcome: "COMMITTED",
    emittedEventIds: [`fixture-event-${randomUUID()}`],
    auditEvidenceIds: [auditEvidenceId],
    result: structuredClone(document),
  };
  appendAudit(state, workspaceId, {
    id: auditEvidenceId, workspaceId, resourceKey: "leads", recordId: document.id,
    action: `lead.${action}`, actorId: token, occurredAt, correlationId,
  });
  return payload;
}

async function handleMutation(request, response, state, workspaceId, token, match, records) {
  const body = await readJsonBody(request, response);
  if (body === INVALID_BODY) return;
  const idempotencyKey = request.headers["idempotency-key"]?.toString().trim();
  if (!idempotencyKey) {
    sendError(response, 400, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key is required for connected mutations.");
    return;
  }
  const fingerprint = mutationFingerprint(request.method, request.url ?? "", body);
  const idempotencyScope = `${token}\u0000${workspaceId}\u0000${idempotencyKey}`;
  const existing = state.idempotency.get(idempotencyScope);
  if (existing) {
    if (existing.fingerprint !== fingerprint) {
      sendError(response, 409, "IDEMPOTENCY_KEY_REUSED", "The idempotency key was reused with a different request payload.");
      return;
    }
    for (const [name, value] of Object.entries(existing.headers)) response.setHeader(name, value);
    sendJson(response, existing.status, structuredClone(existing.payload));
    return;
  }

  const isCreate = !match.id;
  const candidate = normalizeMutationPayload(body);
  if (match.resourcePath === "/leads" && (!candidate.name || typeof candidate.name !== "string" || !candidate.name.trim())) {
    sendError(response, 422, "VALIDATION_FAILED", "The Lead payload is invalid.", {
      fieldErrors: { name: ["Name is required."] },
      businessBlockers: ["LEAD_NAME_REQUIRED"],
    });
    return;
  }

  let id = match.id;
  let entry;
  if (isCreate) {
    id = typeof candidate.id === "string" && candidate.id.trim() ? candidate.id.trim() : `fixture-${match.resourcePath.slice(1).replaceAll("/", "-")}-${randomUUID()}`;
    entry = { data: createRecord(match.resourcePath, id, candidate, workspaceId), version: 1 };
    records.set(id, entry);
  } else {
    entry = records.get(id);
    if (!entry) {
      sendError(response, 404, "RESOURCE_NOT_FOUND", `${match.resourcePath} record ${id} was not found.`);
      return;
    }
    const expectedVersion = parseIfMatch(request.headers["if-match"]);
    if (expectedVersion !== undefined && expectedVersion !== entry.version) {
      sendError(response, 412, "RESOURCE_VERSION_CONFLICT", `Expected version ${expectedVersion}, current version ${entry.version}.`, {
        details: { expectedVersion, currentVersion: entry.version },
      });
      return;
    }
    entry = {
      data: {
        ...entry.data,
        ...candidate,
        id,
        updatedAt: new Date().toISOString(),
      },
      version: entry.version + 1,
    };
    records.set(id, entry);
  }

  const correlationId = request.headers["x-correlation-id"]?.toString() || `corr-${randomUUID()}`;
  const commandId = `cmd-${randomUUID()}`;
  const evidenceId = `audit-${randomUUID()}`;
  const occurredAt = new Date().toISOString();
  const payload = {
    data: structuredClone(entry.data),
    commandId,
    correlationId,
    occurredAt,
    version: entry.version,
    emittedEvents: [{ type: `${match.resourcePath.slice(1)}.${match.operation ?? "created"}`, aggregateId: id }],
    auditEvidenceIds: [evidenceId],
  };
  const headers = { ETag: `\"${entry.version}\"` };
  state.idempotency.set(idempotencyScope, { fingerprint, status: isCreate ? 201 : 200, payload, headers });
  appendAudit(state, workspaceId, {
    id: evidenceId,
    workspaceId,
    resourceKey: match.resourcePath.slice(1),
    recordId: id,
    category: "DATA_CHANGE",
    outcome: "SUCCEEDED",
    action: match.operation ?? "create",
    actor: { id: token, type: "USER", displayName: "Connected fixture actor" },
    occurredAt,
    source: "connected-api-test-host",
    changedFields: Object.keys(candidate),
    correlationId,
  });
  for (const [name, value] of Object.entries(headers)) response.setHeader(name, value);
  sendJson(response, isCreate ? 201 : 200, payload);
}

async function handleWorkflow(request, response, state, workspaceId, token, pathname) {
  const body = await readJsonBody(request, response);
  if (body === INVALID_BODY) return;
  const idempotencyKey = request.headers["idempotency-key"]?.toString().trim();
  if (!idempotencyKey) {
    sendError(response, 400, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key is required for connected workflow commands.");
    return;
  }
  const fingerprint = mutationFingerprint(request.method, request.url ?? "", body);
  const scope = `${token}\u0000${workspaceId}\u0000${idempotencyKey}`;
  const existing = state.idempotency.get(scope);
  if (existing) {
    if (existing.fingerprint !== fingerprint) {
      sendError(response, 409, "IDEMPOTENCY_KEY_REUSED", "The idempotency key was reused with a different workflow payload.");
      return;
    }
    sendJson(response, existing.status, structuredClone(existing.payload));
    return;
  }
  const segments = pathname.split("/").filter(Boolean);
  const aggregateId = segments.length >= 4 ? decodeURIComponent(segments[2]) : `${segments[1]}-collection`;
  const commandType = `${segments[1]}.${segments.at(-1)}`;
  const occurredAt = new Date().toISOString();
  const payload = {
    data: { accepted: true, aggregateId, commandType, payload: body },
    commandId: `cmd-${randomUUID()}`,
    commandType,
    aggregateType: segments[1],
    aggregateId,
    idempotencyKey,
    correlationId: request.headers["x-correlation-id"]?.toString() || `corr-${randomUUID()}`,
    occurredAt,
    version: 1,
    emittedEvents: [{ type: `${commandType}.accepted`, aggregateId }],
    audit: { authority: "backend", evidenceIds: [`audit-${randomUUID()}`] },
  };
  state.idempotency.set(scope, { fingerprint, status: 200, payload, headers: {} });
  sendJson(response, 200, payload);
}

function handleRetryOnce(request, response, state, workspaceId, url) {
  const status = Number(url.searchParams.get("status") ?? "429");
  const key = `${workspaceId}:${status}:${request.headers["x-request-id"] ?? "default"}`;
  const count = (state.requestCounts.get(key) ?? 0) + 1;
  state.requestCounts.set(key, count);
  if (count === 1) {
    if (status === 429) response.setHeader("Retry-After", "0");
    sendError(response, status, status === 429 ? "RATE_LIMITED" : "TRANSIENT_FAILURE", "Retryable connected test response.", {
      retryable: true,
    });
    return;
  }
  sendJson(response, 200, { ok: true, attempts: count, status });
}

function matchResource(pathname) {
  const resourcePath = RESOURCE_PATHS
    .filter((candidate) => pathname === candidate || pathname.startsWith(`${candidate}/`))
    .sort((left, right) => right.length - left.length)[0];
  if (!resourcePath) return undefined;
  const suffix = pathname.slice(resourcePath.length).split("/").filter(Boolean).map(decodeURIComponent);
  return {
    resourcePath,
    id: suffix[0],
    operation: suffix[1],
  };
}

function createRecord(resourcePath, id, candidate, workspaceId) {
  if (resourcePath === "/leads") {
    return {
      id,
      name: candidate.name.trim(),
      title: candidate.title ?? "Connected lead",
      companyName: candidate.companyName ?? "Connected Fixture Co",
      email: candidate.email ?? `${id}@example.test`,
      phone: candidate.phone ?? "0000000000",
      source: candidate.source ?? "Connected fixture",
      score: candidate.score ?? 50,
      leadWorkState: candidate.leadWorkState ?? "NEW",
      ownerId: candidate.ownerId ?? "connected-user",
      interestedProducts: candidate.interestedProducts ?? [],
      createdAt: candidate.createdAt ?? new Date().toISOString(),
      activities: candidate.activities ?? [],
      workspaceId,
      ...candidate,
      id,
    };
  }
  return { id, workspaceId, ...candidate };
}

function normalizeMutationPayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return {};
  if (body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)) return body.payload;
  return body;
}

function parseIfMatch(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return undefined;
  const normalized = raw.trim().replace(/^W\//u, "").replace(/^"|"$/gu, "");
  const version = Number(normalized);
  return Number.isInteger(version) ? version : undefined;
}

function mutationFingerprint(method, url, body) {
  return createHash("sha256").update(`${method}\n${url}\n${stableJson(body)}`).digest("hex");
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

const INVALID_BODY = Symbol("invalid-body");
async function readJsonBody(request, response) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    sendError(response, 400, "INVALID_JSON", "Request body must be valid JSON.");
    return INVALID_BODY;
  }
}

function appendAudit(state, workspaceId, entry) {
  const entries = state.audit.get(workspaceId) ?? [];
  entries.unshift(entry);
  state.audit.set(workspaceId, entries);
}

function sendError(response, status, code, message, extras = {}) {
  sendJson(response, status, {
    error: {
      code,
      message,
      userMessage: message,
      retryable: extras.retryable ?? [408, 429, 502, 503, 504].includes(status),
      correlationId: response.getHeader("X-Correlation-Id") ?? `corr-${randomUUID()}`,
      ...(extras.details === undefined ? {} : { details: extras.details }),
      ...(extras.fieldErrors === undefined ? {} : { fieldErrors: extras.fieldErrors }),
      ...(extras.businessBlockers === undefined ? {} : { businessBlockers: extras.businessBlockers }),
    },
  });
}

function sendJson(response, status, payload) {
  if (!response.hasHeader("X-Request-Id")) response.setHeader("X-Request-Id", `fixture-${randomUUID()}`);
  if (!response.hasHeader("X-Correlation-Id")) response.setHeader("X-Correlation-Id", `fixture-${randomUUID()}`);
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  response.end(body);
}

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  response.setHeader(
    "Access-Control-Allow-Headers",
    "Authorization,Content-Type,X-Workspace-Id,X-Request-Id,X-Correlation-Id,Idempotency-Key,If-Match",
  );
  response.setHeader("Access-Control-Expose-Headers", "ETag,X-Request-Id,X-Correlation-Id");
}

function addressOf(server) {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Connected API test host did not bind a TCP address.");
  return {
    host: address.address,
    port: address.port,
    baseUrl: `http://${address.address.includes(":") ? `[${address.address}]` : address.address}:${address.port}`,
  };
}

function defaultOpenApiSeed() {
  const createdAt = "2026-07-24T00:00:00.000Z";
  const lead = (id, displayName) => ({
    id,
    displayName,
    email: `${id}@example.test`,
    estimatedValue: { amount: "1000.00", currency: "VND" },
    leadWorkState: "NEW",
    source: "CONNECTED_FIXTURE",
    score: 50,
    ownerId: "connected-user",
    interestedProducts: [],
    activityProjection: "NOT_INCLUDED",
    version: 1,
    createdAt,
    updatedAt: createdAt,
  });
  return {
    "workspace-alpha": { "/leads": [lead("openapi-alpha-lead", "OpenAPI Alpha Lead")] },
    "workspace-beta": { "/leads": [lead("openapi-beta-lead", "OpenAPI Beta Lead")] },
  };
}

function defaultSeed() {
  return {
    "workspace-alpha": {
      "/leads": [seedLead("connected-alpha-lead", "Connected Alpha Lead", "workspace-alpha")],
    },
    "workspace-beta": {
      "/leads": [seedLead("connected-beta-lead", "Connected Beta Lead", "workspace-beta")],
    },
  };
}

function seedLead(id, name, workspaceId) {
  return {
    id,
    name,
    title: "Integration Manager",
    companyName: `${name} Company`,
    email: `${id}@example.test`,
    phone: "0000000000",
    source: "Connected test host",
    score: 80,
    leadWorkState: "NEW",
    ownerId: "connected-user",
    interestedProducts: [],
    createdAt: "2026-07-24T00:00:00.000Z",
    activities: [],
    workspaceId,
  };
}

function parseCliArguments(argv) {
  const valueAfter = (name, fallback) => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] ?? fallback : fallback;
  };
  const port = Number(valueAfter("--port", "4010"));
  if (!Number.isInteger(port) || port < 0 || port > 65_535) throw new Error(`Invalid --port ${port}.`);
  return { port, host: valueAfter("--host", DEFAULT_HOST), contractMode: valueAfter("--contract-mode", "projection") };
}

async function runCli() {
  const host = createConnectedApiTestHost(parseCliArguments(process.argv.slice(2)));
  const address = await host.start();
  console.log(JSON.stringify({ event: "connected-api-test-host.ready", ...address }));
  const shutdown = async () => {
    await host.stop();
    process.exitCode = 0;
  };
  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}
