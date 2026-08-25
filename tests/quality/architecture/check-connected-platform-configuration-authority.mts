import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import { walkFiles } from "../../../scripts/quality/core/filesystem.mjs";

/**
 * MA-01 / MA-09 invariant for browser-persisted platform configuration (M12).
 *
 * Integration connections, developer webhooks and CRM object schemas are held by platform
 * singletons backed by `BrowserStorageAdapter`. Those repositories have no runtime-mode
 * awareness: without a guard they write to browser storage in connected mode exactly as in
 * demo mode, while the corresponding *reads* come from the backend. A backend read paired
 * with a browser write, presented as workspace configuration, is the precise shape MA-01
 * forbids — and unlike a module business port there is no connected binding to fail closed,
 * so nothing else in the system would catch it.
 *
 * Everything below is derived rather than listed:
 *
 *  - the operation set comes from `CONNECTED_UNAVAILABLE_CONFIGURATION_OPERATIONS`;
 *  - whether each is legitimately unavailable comes from OpenAPI contract status;
 *  - the write sites come from the runtime sources that consult the availability module;
 *  - the presentation callers come from whoever calls those writes.
 *
 * The OpenAPI check runs in both directions on purpose. If the backend ships
 * `createIntegrationConnection`, this gate fails and forces the frontend to route to the new
 * operation instead of keeping a refusal that has quietly become wrong.
 */

const root = repositoryRoot;
const relative = (file: string) => path.relative(root, file).split(path.sep).join("/");
const sourceFiles = walkFiles(path.join(root, "src"))
  .map((file: string) => file.split(path.sep).join("/"))
  .filter((file: string) => /\.tsx?$/u.test(file));
const read = new Map<string, string>(sourceFiles.map((file) => [file, fs.readFileSync(file, "utf8")]));
const sourceOf = (relativePath: string): string => {
  const absolute = [...read.keys()].find((file) => relative(file) === relativePath);
  assert.ok(absolute, relativePath + " must be readable.");
  return read.get(absolute)!;
};

/** Text of a balanced run starting at `open`. */
function balanced(text: string, open: number, pair: "()" | "{}"): string {
  const [start, end] = pair.split("") as [string, string];
  let depth = 0;
  for (let index = open; index < text.length; index += 1) {
    if (text[index] === start) depth += 1;
    else if (text[index] === end) {
      depth -= 1;
      if (depth === 0) return text.slice(open, index + 1);
    }
  }
  return text.slice(open);
}

const AVAILABILITY_MODULE = "src/platform/connected-configuration/connectedConfigurationAvailability.ts";
const COMPOSITION_FILE = "src/app/composition/connected/connectedPlatformConfigurationServices.ts";
const availabilitySource = sourceOf(AVAILABILITY_MODULE);

// ---------------------------------------------------------------------------
// 1. The declared operation set, read from the availability module itself.
// ---------------------------------------------------------------------------

const declaredOperations = [...availabilitySource.matchAll(/export const ([A-Z][A-Z0-9_]*_OPERATION) = "([^"]+)";/gu)]
  .map((match) => ({ constant: match[1], label: match[2] }));
assert.ok(
  declaredOperations.length >= 3,
  "The availability module must declare its configuration operation labels.",
);

const listMatch = /export const CONNECTED_UNAVAILABLE_CONFIGURATION_OPERATIONS = \[([\s\S]*?)\] as const;/u
  .exec(availabilitySource);
assert.ok(listMatch, "The availability module must publish the operation set the composition declares.");
const listedConstants = [...listMatch[1].matchAll(/([A-Z][A-Z0-9_]*_OPERATION)/gu)].map((match) => match[1]);
assert.deepEqual(
  listedConstants.slice().sort(),
  declaredOperations.map((entry) => entry.constant).sort(),
  "Every declared configuration operation constant must appear in CONNECTED_UNAVAILABLE_CONFIGURATION_OPERATIONS. A "
    + "constant left out of the set is never declared by the composition, so its write would stay reachable in "
    + "connected mode while still looking guarded.",
);

// ---------------------------------------------------------------------------
// 2. The connected composition declares the whole set, for connected mode only.
// ---------------------------------------------------------------------------

const composition = sourceOf(COMPOSITION_FILE);
assert.match(
  composition,
  /CONNECTED_UNAVAILABLE_CONFIGURATION_OPERATIONS/u,
  COMPOSITION_FILE + " must declare the derived operation set rather than a hand-written list.",
);
assert.match(
  composition,
  /declareUnavailableConnectedWorkflow\(\s*operation\s*\)/u,
  COMPOSITION_FILE + " must declare each operation into the shared availability registry.",
);

const applicationComposition = sourceOf("src/app/composition/applicationComposition.ts");
const declarationCall = /if \(mode === "connected"\) declareConnectedPlatformConfigurationUnavailability\(\);/u;
assert.match(
  applicationComposition,
  declarationCall,
  "applicationComposition must declare platform configuration unavailability for connected mode only, so demo "
    + "configuration behaviour is unchanged.",
);
const declarationIndex = applicationComposition.search(declarationCall);
const bundleIndex = applicationComposition.search(/const services = mode === "connected"/u);
assert.ok(
  declarationIndex >= 0 && declarationIndex < bundleIndex,
  "The declaration must run before the service bundle is built, so nothing constructed during composition can "
    + "observe a half-populated availability registry.",
);

// ---------------------------------------------------------------------------
// 3. Canonical grounding: each guarded domain really has no authoritative write.
//
// Derived from OpenAPI, so the refusal cannot fossilize. The day a write operation becomes
// PRODUCTION_CONTRACT_READY, this fails and the refusal must be replaced by real routing.
// ---------------------------------------------------------------------------

interface OpenApiOperation {
  operationId?: string;
  "x-contract-status"?: string;
}
interface OpenApiDocument {
  paths: Record<string, Record<string, OpenApiOperation | undefined>>;
}
const openapi = JSON.parse(fs.readFileSync(path.join(root, "docs/api/openapi.json"), "utf8")) as OpenApiDocument;
const operationStatus = new Map<string, string>();
for (const methods of Object.values(openapi.paths)) {
  for (const operation of Object.values(methods)) {
    if (operation && operation.operationId) {
      operationStatus.set(operation.operationId, operation["x-contract-status"] ?? "UNCLASSIFIED");
    }
  }
}

/**
 * Backend write operations that would make each guarded domain authoritative.
 *
 * An empty list is itself an assertion: it says OpenAPI publishes no such operation at all,
 * and section 3 below proves that separately rather than trusting the empty list.
 */
const authoritativeWriteCandidates: Record<string, readonly string[]> = {
  "Integration connection save": ["createIntegrationConnection", "updateIntegrationConnection"],
  "Integration connection disconnect": ["disconnectIntegrationConnection"],
  "Integration connection verify": ["verifyIntegrationConnection"],
  "CRM object schema save": ["createCrmObjectField", "updateCrmObjectField", "deleteCrmObjectField"],
  "Developer webhook configuration save": [],
};

for (const { label } of declaredOperations) {
  const candidates = authoritativeWriteCandidates[label];
  assert.ok(
    candidates !== undefined,
    label + " is declared unavailable but this gate does not know which backend operation would make it available. "
      + "Add its write operations so the refusal stays grounded in canonical contract status.",
  );
  for (const operationId of candidates) {
    const status = operationStatus.get(operationId);
    assert.ok(status !== undefined, operationId + " must exist in OpenAPI.");
    assert.notEqual(
      status,
      "PRODUCTION_CONTRACT_READY",
      operationId + " is now PRODUCTION_CONTRACT_READY, so \"" + label + "\" must route to it instead of refusing. "
        + "A refusal that outlives its blocker silently removes a shipped capability.",
    );
  }
  if (candidates.length === 0) {
    const webhookOperations = [...operationStatus.keys()].filter((operationId) => /webhook/iu.test(operationId));
    assert.deepEqual(
      webhookOperations,
      [],
      "\"" + label + "\" is declared unavailable because OpenAPI publishes no webhook operation in either direction. "
        + "One now exists, so the refusal must be replaced by real routing.",
    );
  }
}

// A guarded read-side domain must still be backend-readable, or the whole premise is wrong.
for (const readOperation of ["listIntegrationConnections", "listCrmObjectSchemas"]) {
  assert.equal(
    operationStatus.get(readOperation),
    "PRODUCTION_CONTRACT_READY",
    readOperation + " must stay PRODUCTION_CONTRACT_READY. The MA-01 hazard this gate closes is a backend read "
      + "paired with a browser write; if the read is no longer authoritative the classification must be revisited.",
  );
}

// ---------------------------------------------------------------------------
// 4. Every browser-persisted write for a declared operation fails closed.
//
// The runtimes are found by who consults the availability module, not by name.
// ---------------------------------------------------------------------------

const guardedRuntimes = sourceFiles
  .map(relative)
  .filter((file) => file !== AVAILABILITY_MODULE && file !== COMPOSITION_FILE)
  .filter((file) => file.startsWith("src/platform/"))
  .filter((file) => sourceOf(file).includes("connectedConfigurationAvailability"));
assert.ok(
  guardedRuntimes.length >= 3,
  "At least the integration, developer-configuration and CRM configuration runtimes must consult the availability "
    + "module.",
);

const writeExport = /export (?:const|function) ((?:save|disconnect|verify|delete|remove)[A-Za-z0-9_]*)/gu;
const guardedWriteNames = new Set<string>();

for (const file of guardedRuntimes) {
  const text = sourceOf(file);
  assert.match(
    text,
    /new BrowserStorageAdapter\(\)/u,
    file + " consults the configuration availability module, so it is expected to be a browser-persisted runtime.",
  );
  // The guard must be the real imported assertion, not a same-named local or an alias.
  //
  // M12 §19 found that renaming the import specifier leaves every call site textually
  // intact, so a name-only check would still pass while the guard no longer resolves.
  const importSpecifier = new RegExp(
    "import\\s*\\{[^}]*\\bassertConfigurationOperationAvailable\\b(?!\\s+as\\b)[^}]*\\}\\s*from\\s*[\"'][^\"']*connectedConfigurationAvailability[\"']",
    "u",
  );
  assert.match(
    text,
    importSpecifier,
    file + " must import assertConfigurationOperationAvailable unaliased from the availability module. An aliased or "
      + "locally shadowed guard leaves the call sites looking correct while resolving to something else.",
  );
  const writes = [...text.matchAll(writeExport)];
  assert.ok(writes.length > 0, file + " must export at least one configuration write.");
  for (const write of writes) {
    guardedWriteNames.add(write[1]);
    const open = text.indexOf("{", write.index! + write[0].length);
    assert.ok(open > 0, file + " -> " + write[1] + " must have a body that can be inspected.");
    const body = balanced(text, open, "{}");
    const guard = body.search(/assertConfigurationOperationAvailable\(/u);
    const repositoryCall = body.search(/repository\./u);
    assert.ok(
      guard >= 0,
      file + " -> " + write[1] + " writes browser-persisted configuration, so it must call "
        + "assertConfigurationOperationAvailable and fail closed in connected mode.",
    );
    assert.ok(
      repositoryCall < 0 || guard < repositoryCall,
      file + " -> " + write[1] + " must assert availability BEFORE it touches the repository, so connected mode "
        + "persists nothing at all.",
    );
  }
}

// ---------------------------------------------------------------------------
// 5. Every presentation caller refuses first, with safe product copy.
// ---------------------------------------------------------------------------

const predicateCall = /is(?:IntegrationConfigurationWrite|DeveloperWebhookSave|CrmObjectSchemaSave)Unavailable\s*\(/u;
const callers = sourceFiles
  .map(relative)
  .filter((file) => file.startsWith("src/workspaces/") || file.includes("/presentation/"))
  .filter((file) => [...guardedWriteNames].some((name) => new RegExp("\\b" + name + "\\s*\\(", "u").test(sourceOf(file))));
assert.ok(callers.length > 0, "The configuration writes must have at least one presentation caller to protect.");

for (const file of callers) {
  const text = sourceOf(file);
  assert.match(
    text,
    predicateCall,
    file + " calls a browser-persisted configuration write, so it must consult the matching availability predicate "
      + "and tell the user the action is unavailable instead of writing to this browser in connected mode.",
  );
  assert.match(
    text,
    /unavailableFeatureMessage\(/u,
    file + " must render the refusal through unavailableFeatureMessage, so the user never sees the internal "
      + "operation label.",
  );
  // The guard must be a real guard, not merely a mention.
  //
  // M11 proved that a text-level check is satisfied by dead code: adding `&& false` to a
  // preflight leaves every token in place while removing the refusal. So the predicate must
  // be the *entire* test of an `if` whose body returns, and such a statement must precede
  // every write call.
  const guardStatements: number[] = [];
  for (const opening of text.matchAll(/if\s*\(/gu)) {
    const testStart = text.indexOf("(", opening.index!);
    const test = balanced(text, testStart, "()");
    const inner = test.slice(1, -1).trim();
    if (!predicateCall.test(inner)) continue;
    assert.ok(
      /^is[A-Za-z0-9_]*Unavailable\s*\(\s*\)$/u.test(inner),
      file + " guards a configuration write with `if (" + inner + ")`. The availability predicate must be the whole "
        + "condition: conjoining it with anything else lets the refusal be disabled without removing a single "
        + "reference to it.",
    );
    const bodyStart = text.indexOf("{", testStart + test.length);
    assert.ok(bodyStart > 0, file + " availability guard must have a block body.");
    const body = balanced(text, bodyStart, "{}");
    assert.match(
      body,
      /\breturn\b/u,
      file + " availability guard must return, so the write below it cannot run when the operation is unavailable.",
    );
    guardStatements.push(opening.index!);
  }
  assert.ok(
    guardStatements.length > 0,
    file + " mentions an availability predicate but never uses it as a refusing guard.",
  );

  for (const name of guardedWriteNames) {
    for (const call of text.matchAll(new RegExp("\\b" + name + "\\s*\\(", "gu"))) {
      // Skip the import specifier itself.
      const line = text.slice(text.lastIndexOf("\n", call.index!) + 1, call.index!);
      if (/^\s*(import|export)\b/u.test(line)) continue;
      assert.ok(
        guardStatements.some((guard) => guard < call.index!),
        file + " calls " + name + " before any refusing availability guard runs. The preflight must precede the "
          + "write so connected mode refuses instead of persisting configuration in one browser.",
      );
    }
  }
}

console.log(
  "quality.connected-platform-configuration-authority: " + declaredOperations.length + " browser-persisted "
    + "configuration operations declared by the connected composition, " + guardedRuntimes.length
    + " runtimes failing closed, " + callers.length + " presentation callers refusing first.",
);
