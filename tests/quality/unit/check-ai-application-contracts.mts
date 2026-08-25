import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { walkAllFiles } from "../../../scripts/quality/core/filesystem.mjs";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";

import {
  aiActionIntentEffect,
  aiEvidenceForIntent,
  buildSanitizedAiRequestContext,
  containsBlockedFieldKey,
  defaultAiContextScope,
  evaluateDemoAiActionDecision,
  executeGovernedAiActionIntent,
  isSafeAiRoute,
  parseAiActionIntent,
  resolveAiFocusedEntityRef,
  resolveAiInteractionState,
  toAiActionIntent,
  toStoredActionType,
  type AiActionIntent,
  type AiWorkspaceScope,
} from "@/ai";
import { DEFAULT_AI_GOVERNANCE_POLICY, normalizeAiGovernancePolicy } from "@/ai/governance";
import {
  ConnectedAiRuntime,
} from "@/ai/runtime/ConnectedAiRuntime";
import { DemoAiRuntime } from "@/ai/runtime/DemoAiRuntime";
import { getAiRuntimeMode, isConnectedAiRuntime } from "@/ai/runtime/aiRuntimeBinding";
import { BrowserAiConversationStore, aiConversationStorageKey } from "@/ai/infrastructure/BrowserAiConversationStore";
import {
  buildContactAiContext,
  buildCustomerAiContext,
  buildGlobalAiContext,
  buildOrganizationAiContext,
  UNSUPPORTED_FOCUSED_AI_ENTITIES,
  type GlobalAiState,
} from "@/workspaces/crm/ai-context/application/aiContextBuilder";
import { getAiSuggestedTaskIntentKey } from "@/workflows/work-activation";
import { getTaskActivitySnapshot, getTaskSnapshot } from "@/modules/tasks";
import type { StoragePort } from "@/platform/persistence";

const root = repositoryRoot;
const read = (relativePath: string): string => fs.readFileSync(path.join(root, relativePath), "utf8");

class MemoryStorage implements StoragePort {
  readonly values = new Map<string, unknown>();
  get<T>(key: string): T | null { return (this.values.get(key) ?? null) as T | null; }
  set<T>(key: string, value: T): void { this.values.set(key, JSON.parse(JSON.stringify(value))); }
  remove(key: string): void { this.values.delete(key); }
}

const scopeA: AiWorkspaceScope = { workspaceId: "ws-a", workspaceKey: "alpha", actorId: "member-1", actorName: "Member One" };
const scopeB: AiWorkspaceScope = { workspaceId: "ws-b", workspaceKey: "beta", actorId: "member-1", actorName: "Member One" };
const scopeAOther: AiWorkspaceScope = { ...scopeA, actorId: "member-2", actorName: "Member Two" };
const policy = normalizeAiGovernancePolicy(DEFAULT_AI_GOVERNANCE_POLICY);

/**
 * M11 (DF-03) — locate an AI-activated Task by what the activation actually persists.
 *
 * `getTaskSnapshot(getAiSuggestedTaskIntentKey(id))` cannot answer this question. Task
 * ids have been server-assigned since M3: `createTaskCommand` drops the caller-supplied
 * `id` before dispatch, so that lookup returns `undefined` whether or not a Task was
 * created, and every assertion built on it passes vacuously.
 *
 * `dedupeKey` and `sourceRef` are the authoritative markers `activateAiSuggestedTask`
 * writes, so they identify the Task without pretending to know its id.
 */
const findAiSuggestedTask = (suggestionId: string) => getTaskActivitySnapshot().tasks.find(
  (task) => task.dedupeKey === `ai-task:${suggestionId}`
    || (task.sourceRef?.type === "AI_SUGGESTION" && task.sourceRef.id === suggestionId),
);

// ---------------------------------------------------------------------------
// 1. Typed AI action intents: closed union, no arbitrary command names.
// ---------------------------------------------------------------------------
assert.equal(parseAiActionIntent({ type: "DELETE_CUSTOMER", id: "c1" }), undefined, "Unknown intent discriminators must be rejected.");
assert.equal(parseAiActionIntent({ type: "NAVIGATE", route: "https://evil.test/steal" }), undefined, "External destinations are not executable AI routes.");
assert.equal(parseAiActionIntent({ type: "NAVIGATE", route: "//evil.test" }), undefined, "Protocol-relative routes must be rejected.");
assert.equal(isSafeAiRoute("/customers/c-1"), true);
assert.equal(isSafeAiRoute("javascript:alert(1)"), false);
assert.equal(parseAiActionIntent({ type: "CREATE_TASK", title: "No suggestion id", evidenceRefs: [] }), undefined);
const parsedTaskIntent = parseAiActionIntent({
  type: "CREATE_TASK",
  suggestionId: "sug-1",
  title: "  Call the buyer  ",
  evidenceRefs: ["conversation:thread-1", 42],
  priority: "NOT_A_PRIORITY",
});
assert.equal(parsedTaskIntent?.type, "CREATE_TASK");
assert.equal(parsedTaskIntent && parsedTaskIntent.type === "CREATE_TASK" ? parsedTaskIntent.title : "", "Call the buyer");
assert.deepEqual(
  parsedTaskIntent && parsedTaskIntent.type === "CREATE_TASK" ? parsedTaskIntent.evidenceRefs : [],
  ["conversation:thread-1"],
  "Non-string evidence entries must be dropped.",
);
assert.equal(
  parsedTaskIntent && parsedTaskIntent.type === "CREATE_TASK" ? "priority" in parsedTaskIntent : true,
  false,
  "An unsupported priority must not survive parsing.",
);

// Existing navigate/copy suggested actions keep working through the typed union.
assert.deepEqual(
  toAiActionIntent({ actionType: "navigate", route: "/deals/d-1" }),
  { type: "NAVIGATE", route: "/deals/d-1" },
);
assert.deepEqual(
  toAiActionIntent({ actionType: "copy", payload: "Hello" }),
  { type: "COPY", payload: "Hello" },
);
assert.deepEqual(
  toAiActionIntent({ actionType: "draft", payload: "Body" }),
  { type: "DRAFT_MESSAGE", channel: "MESSAGE", body: "Body" },
);
assert.deepEqual(toAiActionIntent({ actionType: "none" }), { type: "NONE" });
assert.equal(toStoredActionType({ type: "NAVIGATE", route: "/deals" }), "navigate");
assert.equal(aiActionIntentEffect({ type: "NAVIGATE", route: "/deals" }), "CLIENT");
assert.equal(aiActionIntentEffect({ type: "CREATE_TASK", suggestionId: "s", title: "t", evidenceRefs: [] }), "CRM_COMMAND");

// ---------------------------------------------------------------------------
// 2. Governance: blocked decisions prevent execution; approval is explicit.
// ---------------------------------------------------------------------------
const createTaskIntent: AiActionIntent = {
  type: "CREATE_TASK",
  suggestionId: `contract_${Date.now()}`,
  title: "AI contract task",
  assigneeId: "member-1",
  dueAt: new Date(Date.now() + 3_600_000).toISOString(),
  evidenceRefs: ["conversation:thread-contract"],
};

const deniedCapability = evaluateDemoAiActionDecision({
  scope: scopeA,
  intent: createTaskIntent,
  policy: { ...policy, autonomyLevel: "L2_INTERNAL_ACT" },
  requestId: "req-denied",
  capabilityGranted: false,
  persist: false,
});
assert.equal(deniedCapability.allowed, false, "A missing capability must block an AI action.");
assert.equal(deniedCapability.authority, "demo", "Browser governance is never backend authority.");
assert.ok(deniedCapability.reasons.length > 0, "A blocked decision must carry reasons for the UI.");

const blockedExecution = await executeGovernedAiActionIntent(
  { scope: scopeA, intent: createTaskIntent, capabilityGranted: false },
  deniedCapability,
);
assert.equal(blockedExecution.status, "BLOCKED");
assert.equal(blockedExecution.createdTask, undefined, "A blocked AI action must not create a Task.");
assert.equal(findAiSuggestedTask(createTaskIntent.suggestionId), undefined, "No Task may exist after a blocked decision.");

const externalSendPolicy = { ...policy, autonomyLevel: "L3_CONTROLLED_EXTERNAL" as const, requireApprovalFor: ["INTERNAL_UPDATE" as const] };
const withoutApproval = evaluateDemoAiActionDecision({
  scope: scopeA,
  intent: createTaskIntent,
  policy: externalSendPolicy,
  requestId: "req-approval-missing",
  persist: false,
});
assert.equal(withoutApproval.requiresApproval, true);
assert.equal(withoutApproval.allowed, false, "An approval-required action must not be allowed without approval.");
const approvalRequiredResult = await executeGovernedAiActionIntent(
  { scope: scopeA, intent: createTaskIntent },
  withoutApproval,
);
assert.equal(approvalRequiredResult.status, "APPROVAL_REQUIRED");
assert.equal(findAiSuggestedTask(createTaskIntent.suggestionId), undefined, "No Task may exist while approval is still outstanding.");

const withApproval = evaluateDemoAiActionDecision({
  scope: scopeA,
  intent: createTaskIntent,
  policy: externalSendPolicy,
  requestId: "req-approval-given",
  approval: { approved: true, approvedBy: "member-1" },
  persist: false,
});
assert.equal(withApproval.allowed, true, "Explicit approval must unblock an approval-required action.");

// Positive control for the two assertions above. They are only meaningful if the finder
// can actually see an activated Task: executing the approved intent must make exactly the
// same lookup succeed. Without this, "no Task exists" would again be unfalsifiable.
const approvedExecution = await executeGovernedAiActionIntent(
  { scope: scopeA, intent: createTaskIntent, approval: { approved: true, approvedBy: "member-1" } },
  withApproval,
);
assert.equal(approvedExecution.status, "EXECUTED", "An approved AI action must execute.");
const activatedTask = findAiSuggestedTask(createTaskIntent.suggestionId);
assert.ok(activatedTask, "The approved AI action must create a Task the semantic finder can locate.");
assert.equal(activatedTask.sourceRef?.type, "AI_SUGGESTION", "An AI-activated Task must keep its AI provenance.");

// RC-01 restated as an executed fact rather than an assumption: the deterministic intent
// key is an idempotency/dedupe value, never the aggregate id the runtime assigned.
const aiIntentKey = getAiSuggestedTaskIntentKey(createTaskIntent.suggestionId);
assert.notEqual(activatedTask.id, aiIntentKey, "The AI intent key must never become the Task aggregate id.");
assert.equal(
  getTaskSnapshot(aiIntentKey),
  undefined,
  "Looking a Task up by its client-side intent key must stay unresolvable — that is why it cannot be used as an assertion subject.",
);

// Evidence references are preserved end to end.
const evidence = aiEvidenceForIntent(createTaskIntent, ["assignee:member-1"]);
assert.ok(evidence.includes("conversation:thread-contract"), "Suggestion evidence must survive.");
assert.ok(evidence.includes(`ai-suggestion:${createTaskIntent.suggestionId}`), "The suggestion id must be recorded as evidence.");
assert.ok(evidence.includes("assignee:member-1"), "Caller evidence must be merged.");

// ---------------------------------------------------------------------------
// 3. CREATE_TASK goes through the canonical work-activation boundary.
// ---------------------------------------------------------------------------
const actionServiceSource = read("src/ai/application/aiActionApplicationService.ts");
assert.ok(actionServiceSource.includes('import("@/workflows/work-activation")'), "AI task activation must use the canonical workflow boundary.");
for (const forbidden of ["createTaskSnapshot", "taskActivityRepository", "createTaskCommand", "replaceTaskActivitySnapshot"]) {
  assert.equal(actionServiceSource.includes(forbidden), false, `The AI action service must not reach Task state directly (${forbidden}).`);
}
const workActivationSource = read("src/workflows/work-activation/index.ts");
assert.ok(workActivationSource.includes("activateAiSuggestedTask"), "work-activation must own the AI task activation command.");
assert.ok(workActivationSource.includes('type: "AI_SUGGESTION"'), "AI-created Tasks must keep sourceRef.type = AI_SUGGESTION.");
assert.ok(workActivationSource.includes("dedupeKey: `ai-task:${input.suggestionId}`"), "AI task dedupe behavior must be preserved.");
assert.ok(workActivationSource.includes("correlationId: `ai:${input.suggestionId}`"), "AI task correlation identifiers must be preserved.");

for (const component of ["src/components/ai/AiChatPanel.tsx", "src/components/ai/AiSuggestedActions.tsx", "src/components/ai/AiAssistantDrawer.tsx"]) {
  const source = read(component);
  for (const forbidden of ["createTaskCommand", "createTaskSnapshot", "askCrmAi", "localStorage"]) {
    assert.equal(source.includes(forbidden), false, `${component} must not own ${forbidden}; AI UI depends on the AI runtime boundary.`);
  }
}

// ---------------------------------------------------------------------------
// 4. Connected runtime calls the admitted read-only advisory extension and
// keeps every mutation tool fail-closed.
// ---------------------------------------------------------------------------
const connectedSource = read("src/ai/runtime/ConnectedAiRuntime.ts");
for (const forbidden of ["DemoAiRuntime", "askCrmAi", "localStorage", "BrowserStorageAdapter", "openai", "anthropic", "gemini"]) {
  assert.equal(connectedSource.toLowerCase().includes(forbidden.toLowerCase()), false, `Connected AI runtime must not reference ${forbidden}.`);
}
const connectedRequests: Array<{ operationId: string; path: string; body?: unknown; contractAuthority?: string }> = [];
const connected = new ConnectedAiRuntime({
  request: async <T,>(input: { operationId: string; path: string; body?: unknown; contractAuthority?: string }): Promise<T> => {
    connectedRequests.push(input);
    return {
      executionId: "ai_exec_contract",
      summary: "Lead is ready for a follow-up.",
      suggestedNextAction: "Call the lead tomorrow.",
      attentionPoints: ["Confirm the budget."],
      advisory: true,
      contextReferences: { leadId: "lead-1" },
      provider: { name: "DevelopmentDeterministic", model: "deterministic-v1" },
    } as T;
  },
});
assert.equal(connected.mode, "connected");
const connectedThread = await connected.createConversation(scopeA, { title: "t", welcomeMessage: "w" });
assert.deepEqual((await connected.listConversations(scopeA)).map((thread) => thread.id), [connectedThread.id]);
assert.deepEqual(await connected.listConversations(scopeB), [], "Connected presentation threads must be workspace scoped.");

const advisory = await connected.ask({
  scope: scopeA,
  conversationId: connectedThread.id,
  question: "What should I do next?",
  locale: "en",
  requestedContextScope: ["FOCUSED_RECORD"],
  focusedEntity: { entityType: "lead", entityId: "lead-1" },
});
assert.equal(advisory.decision.allowed, true);
assert.equal(advisory.decision.authority, "backend");
assert.match(advisory.message.content, /Read-only advisory/u);
assert.match(advisory.message.content, /DevelopmentDeterministic/u);
assert.equal(connectedRequests[0]?.operationId, "requestAiAdvisory");
assert.equal(connectedRequests[0]?.path, "/ai/advisories");
assert.equal(connectedRequests[0]?.contractAuthority, "semantic-extension");
assert.deepEqual(connectedRequests[0]?.body, {
  question: "What should I do next?",
  locale: "en",
  contextReferences: { leadId: "lead-1" },
});
assert.equal(JSON.stringify(connectedRequests[0]?.body).includes("localContext"), false);
assert.equal(JSON.stringify(connectedRequests[0]?.body).includes("workspaceId"), false, "Trusted workspace authority must stay in the request header.");

await assert.rejects(
  connected.ask({ scope: scopeA, conversationId: connectedThread.id, question: "global", locale: "en", requestedContextScope: [] }),
  (error: unknown) => error instanceof Error && "code" in error && error.code === "AI_CONTEXT_UNAVAILABLE",
  "The backend extension requires a focused Lead, Deal or Task and must not receive browser-composed record collections.",
);
for (const operation of [
  () => connected.getGovernanceDecision(scopeA, { type: "NONE" }),
  () => connected.executeAction({ scope: scopeA, intent: createTaskIntent }),
]) {
  await assert.rejects(
    operation(),
    (error: unknown) => error instanceof Error && "code" in error && error.code === "CONTRACT_OPERATION_BLOCKED",
    "Connected AI mutation operations must fail closed instead of treating advisory output as authority.",
  );
}

// Demo composition never presents itself as the connected runtime.
assert.equal(getAiRuntimeMode(), "demo");
assert.equal(isConnectedAiRuntime(), false);
const compositionSource = read("src/app/composition/applicationComposition.ts");
assert.ok(compositionSource.includes("configureConnectedAiRuntime"), "Composition must select the connected AI runtime.");
assert.ok(compositionSource.includes("resetAiRuntime"), "Composition must restore the demo AI runtime outside connected mode.");

// ---------------------------------------------------------------------------
// 5. Data classification: connected requests carry no CRM records.
// ---------------------------------------------------------------------------
const state: GlobalAiState = {
  leads: [],
  customers: [],
  contacts: [],
  deals: [],
  quotes: [],
  orders: [],
  cases: [],
  products: [],
  organizations: [],
  tasks: [],
  actorId: "member-1",
};
const globalContext = buildGlobalAiContext(state);
const sanitized = buildSanitizedAiRequestContext({ context: globalContext, policy });
assert.equal(policy.allowedDataClasses.includes("FINANCIAL"), false, "The default policy does not allow the FINANCIAL data class.");
assert.equal(sanitized.commercial, undefined, "Unauthorized financial context must not be included in a connected request.");
assert.ok(sanitized.redactedFieldKeys.includes("accessToken"), "Blocked field keys must travel with the request contract.");
const financialSanitized = buildSanitizedAiRequestContext({
  context: globalContext,
  policy: { ...policy, allowedDataClasses: [...policy.allowedDataClasses, "FINANCIAL"] },
});
assert.notEqual(financialSanitized.commercial, undefined, "An authorized policy may include commercial totals.");

const askPayload = connectedRequests[0]?.body;
assert.equal(JSON.stringify(askPayload).includes('"leads":['), false, "Connected requests must not transmit CRM record collections.");
assert.equal(containsBlockedFieldKey(askPayload, ["accessToken", "password"]), false, "No credential-like key may appear in a connected payload.");
assert.equal(containsBlockedFieldKey({ nested: { accessToken: "x" } }, ["accessToken"]), true);

// ---------------------------------------------------------------------------
// 6. Conversations are scoped by workspace and actor.
// ---------------------------------------------------------------------------
const storage = new MemoryStorage();
const store = new BrowserAiConversationStore(storage);
const demoRuntime = new DemoAiRuntime(store);
const threadA = await demoRuntime.createConversation(scopeA, { title: "New conversation", welcomeMessage: "hello" });
assert.equal(threadA.workspaceId, "ws-a");
assert.equal(threadA.actorId, "member-1");
assert.deepEqual((await demoRuntime.listConversations(scopeB)).map((item) => item.id), [], "Another workspace must not see workspace A conversations.");
assert.deepEqual((await demoRuntime.listConversations(scopeAOther)).map((item) => item.id), [], "Another actor must not see the first actor's conversations.");
assert.deepEqual((await demoRuntime.listConversations(scopeA)).map((item) => item.id), [threadA.id]);
assert.ok(storage.values.has(aiConversationStorageKey(scopeA)), "Demo conversations must use a workspace/actor-scoped storage key.");
assert.equal([...storage.values.keys()].some((key) => key === "centrix_ai_chat_threads_v1"), false, "The global AI thread key must not be used.");

await demoRuntime.appendMessage(scopeA, threadA.id, { id: "u1", role: "user", content: "Summarize", createdAt: new Date().toISOString() });
const afterAppend = await demoRuntime.getConversation(scopeA, threadA.id);
assert.equal(afterAppend?.messages.length, 2);
assert.equal(afterAppend?.title, "Summarize", "The first user message still names the conversation.");
await demoRuntime.deleteConversation(scopeA, threadA.id);
assert.deepEqual(await demoRuntime.listConversations(scopeA), []);

// Pre-scoping global threads are adopted once into the active scope, then removed.
const unscopedStorage = new MemoryStorage();
unscopedStorage.set("centrix_ai_chat_threads_v1", [{
  id: "legacy-1",
  title: "Legacy conversation",
  messages: [{ id: "m1", role: "assistant", content: "old", createdAt: new Date().toISOString() }],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}]);
const adoptingStore = new BrowserAiConversationStore(unscopedStorage);
const migrated = adoptingStore.list(scopeA);
assert.equal(migrated.length, 1, "Existing local conversations must be adopted, not lost.");
assert.equal(migrated[0]?.workspaceId, "ws-a");
assert.equal(unscopedStorage.get("centrix_ai_chat_threads_v1"), null, "The unscoped key must be removed after adoption.");

// ---------------------------------------------------------------------------
// 7. Focused AI context owners.
// ---------------------------------------------------------------------------
const now = new Date().toISOString();
const organizationState: GlobalAiState = {
  ...state,
  organizations: [{
    id: "org-1",
    workspaceId: "ws-a",
    displayName: "Contoso Vietnam",
    contactRefs: [{ type: "CONTACT", id: "contact-1" }],
    primaryContactId: "contact-1",
    createdAt: now,
  }],
  contacts: [{
    id: "contact-1",
    workspaceId: "ws-a",
    name: "Nguyen An",
    fullName: "Nguyen An",
    status: "active",
    createdAt: now,
  }],
};
const organizationContext = buildOrganizationAiContext("org-1", organizationState);
assert.equal(organizationContext.focusedItem?.entityType, "organization", "Organization must be a first-class focused AI entity.");
assert.equal(resolveAiFocusedEntityRef(organizationContext)?.entityId, "org-1");
assert.deepEqual(
  (organizationContext.focusedItem?.relatedItems?.contacts as Array<{ id: string }> | undefined)?.map((item) => item.id),
  ["contact-1"],
  "Organization context must read related Contacts through the public boundary.",
);
assert.equal(buildOrganizationAiContext("missing", organizationState).focusedItem, undefined, "An unknown Organization must not fabricate a focus.");

const contactContext = buildContactAiContext("contact-1", organizationState);
assert.equal(contactContext.focusedItem?.entityType, "contact", "Contact must have a dedicated AI context builder.");
assert.deepEqual(
  (contactContext.focusedItem?.relatedItems?.organizations as Array<{ id: string }> | undefined)?.map((item) => item.id),
  ["org-1"],
);
assert.deepEqual([...UNSUPPORTED_FOCUSED_AI_ENTITIES], ["payment", "invoice", "shipping", "return", "product"]);

const contextBuilderSource = read("src/workspaces/crm/ai-context/application/aiContextBuilder.ts");
assert.ok(contextBuilderSource.includes("buildCustomer360ReadModel(customer)"), "Customer AI context must keep reusing Customer 360.");
assert.ok(contextBuilderSource.includes("TODO(ai-context): payment"), "Unsupported focused entities must remain documented gaps.");
assert.equal(typeof buildCustomerAiContext, "function");

const hookSource = read("src/workspaces/crm/ai-context/presentation/useGlobalAiContext.ts");
assert.ok(hookSource.includes("buildOrganizationAiContext(focus.id, state)"), "The route-aware AI hook must focus Organization detail routes.");
assert.ok(hookSource.includes("buildContactAiContext(focus.id, state)"), "The route-aware AI hook must focus Contact detail routes.");

// ---------------------------------------------------------------------------
// 8. UX preservation and provider isolation.
// ---------------------------------------------------------------------------
assert.ok(read("src/components/ai/AiAssistantButton.tsx").includes("floating-ai-assistant-btn"), "The floating assistant button must stay intact.");
assert.ok(read("src/components/ai/AiAssistantDrawer.tsx").includes('data-ai-layout="chat-history"'), "The drawer layout must stay intact.");
assert.ok(read("src/components/ai/AiChatPanel.tsx").includes('data-ai-chat-panel="v3"'), "The chat panel surface must stay intact.");

const aiSources = ["src/ai", "src/components/ai", "src/workspaces/crm/ai-context"]
  .flatMap((directory) => walkAllFiles(path.join(root, directory)))
  .filter((file: string) => /\.(?:ts|tsx)$/u.test(file));
const providerLeaks: string[] = [];
for (const file of aiSources) {
  const source = fs.readFileSync(file, "utf8");
  if (/api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com|OPENAI_API_KEY|ANTHROPIC_API_KEY|GEMINI_API_KEY|AZURE_OPENAI/u.test(source)) {
    providerLeaks.push(path.relative(root, file).replaceAll(path.sep, "/"));
  }
}
assert.deepEqual(providerLeaks, [], `Frontend AI code must never reference a model provider endpoint or credential: ${providerLeaks.join(", ")}`);

console.log("AI application contracts: PASS — typed intents, scoped conversations, governed actions, fail-closed connected runtime and provider isolation verified");
