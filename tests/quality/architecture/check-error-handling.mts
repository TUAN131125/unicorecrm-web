import { walkAllFiles } from "../../../scripts/quality/core/filesystem.mjs";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  ApplicationError,
  classifyApplicationErrorCategory,
  normalizeApplicationError,
} from "@/shared/domain";
import { MutationCommandError } from "@/shared/application";
import { ApiClientError } from "@/platform/api";
import {
  classifyMutationFailure,
  presentApplicationError,
} from "@/shared/operations";
import { createAuthoritativeResource } from "@/shared/application";

const root = repositoryRoot;
const read = (relativePath: string): string => fs.readFileSync(path.join(root, relativePath), "utf8");

assert.equal(classifyApplicationErrorCategory({ code: "FIELD_REQUIRED" }), "VALIDATION");
assert.equal(classifyApplicationErrorCategory({ code: "AUTHENTICATION_REQUIRED" }), "AUTHENTICATION");
assert.equal(classifyApplicationErrorCategory({ code: "PERMISSION_DENIED" }), "AUTHORIZATION");
assert.equal(classifyApplicationErrorCategory({ code: "CONTACT_NOT_FOUND" }), "NOT_FOUND");
assert.equal(classifyApplicationErrorCategory({ code: "INVOICE_VERSION_CONFLICT" }), "CONFLICT");
assert.equal(classifyApplicationErrorCategory({ code: "DEAL_NOT_WON" }), "BUSINESS_RULE");
assert.equal(classifyApplicationErrorCategory({ code: "PROVIDER_CREATE_FAILED" }), "INTEGRATION");
assert.equal(classifyApplicationErrorCategory({ code: "REQUEST_TIMEOUT" }), "TIMEOUT");
assert.equal(classifyApplicationErrorCategory({ code: "ANY", status: 503 }), "INFRASTRUCTURE");

const serverDiagnostic = new ApiClientError({
  code: "SERVER_UNAVAILABLE",
  message: "SQL connection pool exhausted at host internal-db-01",
  status: 503,
  correlationId: "corr-safe-message",
  retryable: true,
});
const safeServerPresentation = presentApplicationError(serverDiagnostic, { locale: "vi" });
assert.equal(safeServerPresentation.error.category, "INFRASTRUCTURE");
assert.equal(safeServerPresentation.action, "RETRY");
assert.equal(safeServerPresentation.message.includes("internal-db-01"), false, "Raw server diagnostics must not be exposed to operators.");
assert.equal(safeServerPresentation.correlationId, "corr-safe-message");

const userSafeApiError = new ApiClientError({
  code: "CUSTOMER_CREDIT_BLOCKED",
  message: "Credit policy rule 91 rejected the request.",
  userMessage: "Customer credit policy requires approval.",
  status: 422,
});
assert.equal(presentApplicationError(userSafeApiError).message, "Customer credit policy requires approval.");

const commandError = new MutationCommandError({
  code: "ORDER_VERSION_CONFLICT",
  message: "The Order changed on the server.",
  blockers: ["REFRESH_REQUIRED"],
  correlationId: "corr-order-conflict",
});
assert.ok(commandError instanceof ApplicationError);
const mutationFailure = classifyMutationFailure(commandError);
assert.equal(mutationFailure.state, "CONFLICTED");
assert.equal(mutationFailure.code, "ORDER_VERSION_CONFLICT");
assert.equal(mutationFailure.category, "CONFLICT");
assert.equal(mutationFailure.recoveryAction, "REFRESH");
assert.equal(mutationFailure.correlationId, "corr-order-conflict");

const cancelled = normalizeApplicationError(new DOMException("cancelled", "AbortError"));
assert.equal(cancelled.category, "CANCELLED");
assert.equal(presentApplicationError(cancelled).surface, "SILENT");

const resource = createAuthoritativeResource(async () => {
  throw new Error("Sensitive browser runtime diagnostic");
});
await resource.load();
const resourceSnapshot = resource.getSnapshot();
assert.equal(resourceSnapshot.state, "ERROR");
assert.ok(resourceSnapshot.error instanceof ApplicationError);
assert.equal(resourceSnapshot.error?.code, "UNEXPECTED_ERROR");

function walk(directory: string): string[] {
  return walkAllFiles(directory, { include: (_filePath, entryName) => /\.(ts|tsx)$/u.test(entryName) });
}

const presentationFiles = [
  ...walk(path.join(root, "src/modules")),
  ...walk(path.join(root, "src/components/ai")),
].filter((file) => file.includes(`${path.sep}presentation${path.sep}`) || file.includes(`${path.sep}components${path.sep}ai${path.sep}`));

const rawErrorMessagePattern = /\b([A-Za-z_$][\w$]*)\s+instanceof\s+Error\s*\?\s*\1\.message/u;
const rawErrorStringPattern = /String\((?:error|caught|err|approvalError)\)/u;
const messageControlFlowPattern = /(?:error\.message|\bmessage)\s*(?:\.(?:includes|startsWith|endsWith)\s*\(|===|!==)/u;

for (const file of presentationFiles) {
  const source = fs.readFileSync(file, "utf8");
  const relative = path.relative(root, file).replaceAll(path.sep, "/");
  assert.equal(rawErrorMessagePattern.test(source), false, `${relative} must use the shared error presentation mapper instead of raw Error.message.`);
  assert.equal(rawErrorStringPattern.test(source), false, `${relative} must not render String(error) directly.`);
  assert.equal(messageControlFlowPattern.test(source), false, `${relative} must branch on error.code/category, not message text.`);
}

const mutationStateSource = read("src/shared/operations/mutationState.ts");
for (const forbidden of ["validationPatterns", "conflictPatterns", "businessPatterns", ".test(message)"]) {
  assert.equal(mutationStateSource.includes(forbidden), false, `Mutation classification must not restore message heuristic ${forbidden}.`);
}
for (const marker of ["normalizeApplicationError", "mutationStateForCategory", "recoveryAction", "category"]) {
  assert.ok(mutationStateSource.includes(marker), `Mutation failure mapping is missing ${marker}.`);
}

const orderCreationSource = read("src/workflows/order-creation/index.ts");
assert.ok(orderCreationSource.includes('code: "DEAL_NOT_WON"'));
assert.equal(orderCreationSource.includes("DEAL_NOT_WON:"), false, "Order creation must not encode structured details into message text.");
const orderConfirmationSource = read("src/workflows/order-confirmation/index.ts");
assert.ok(orderConfirmationSource.includes('errorCode: "CREDIT_APPROVAL_REQUIRED"'));
assert.ok(orderConfirmationSource.includes("errorDetails"));
assert.equal(orderConfirmationSource.includes("CREDIT_APPROVAL_REQUIRED:"), false, "Order confirmation must not encode approval details into message text.");
const productCsvSource = read("src/modules/products/application/import-export/productCsv.ts");
assert.ok(productCsvSource.includes('code: "CSV_EMPTY"'));
assert.equal(productCsvSource.includes('throw new Error("CSV_EMPTY")'), false);

const fetchClientSource = read("src/platform/api/client/FetchHttpClient.ts");
assert.ok(fetchClientSource.includes("source.userMessage"), "HTTP error envelopes must support a separate operator-safe userMessage.");
const authoritativeResourceSource = read("src/shared/application/authoritativeResource.ts");
assert.ok(authoritativeResourceSource.includes("normalizeApplicationError(error)"), "Authoritative resources must retain normalized errors.");

const packageJson = JSON.parse(read("package.json")) as { scripts?: Record<string, string> };
assert.equal(packageJson.scripts?.["check:error-handling"], undefined, "Individual error-handling aliases must remain retired.");
const qualityPipeline = JSON.parse(read("scripts/quality/quality-pipeline.json")) as { gates: Array<{ id: string }>; groups: Array<{ gates: string[] }> };
assert.ok(qualityPipeline.gates.some((gate) => gate.id === "quality.error-handling"));
assert.ok(qualityPipeline.groups.some((group) => group.gates.includes("quality.error-handling")));

console.log(`Error taxonomy and UI handling: PASS (${presentationFiles.length} presentation files protected).`);
