import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  clearGlobalMutationConflict,
  configureMutationAuthority,
  executeMutationCommand,
  getGlobalMutationConflictSnapshot,
  type BackendMutationCommand,
  type MutationAuthorityPort,
  type MutationCommandMetadata,
  type MutationOutcome,
} from "../../../src/shared/application";
import { ApplicationError } from "../../../src/shared/domain";

const root = repositoryRoot;
const captured: MutationCommandMetadata[] = [];
const successAuthority: MutationAuthorityPort = {
  async execute<TPayload, TResult>(
    command: BackendMutationCommand<TPayload>,
    metadata: MutationCommandMetadata,
  ): Promise<MutationOutcome<TResult>> {
    captured.push(metadata);
    return {
      data: { id: command.aggregateId, updatedAt: "2099-01-01T00:00:00.000Z" } as TResult,
      commandId: "cmd_test",
      commandType: command.commandType,
      aggregateType: command.aggregateType,
      aggregateId: command.aggregateId,
      idempotencyKey: metadata.idempotencyKey,
      correlationId: metadata.correlationId ?? "corr_test",
      occurredAt: new Date().toISOString(),
      version: 'W/"7"',
      emittedEvents: [],
      audit: { authority: "backend", evidenceIds: [] },
    };
  },
};
configureMutationAuthority(successAuthority);
await executeMutationCommand(
  { commandType: "lead.change-work-state", aggregateType: "lead", aggregateId: "lead-1", payload: { leadWorkState: "CONTACTING" } },
  { idempotencyKey: "idem_test", correlationId: "corr_test", expectedVersion: 'W/"6"' },
);
assert.equal(captured[0]?.expectedVersion, 'W/"6"');
assert.equal(captured[0]?.idempotencyKey, "idem_test");
assert.equal(captured[0]?.correlationId, "corr_test");

clearGlobalMutationConflict();
configureMutationAuthority({
  async execute() {
    throw new ApplicationError({
      code: "VERSION_CONFLICT",
      message: "The record changed on the server.",
      category: "CONFLICT",
      details: { expectedVersion: 'W/"6"', actualVersion: 'W/"7"', changedFields: ["stage"] },
    });
  },
});
await assert.rejects(() => executeMutationCommand(
  { commandType: "deal.change-stage", aggregateType: "deal", aggregateId: "deal-1", payload: { stage: "PROPOSAL" } },
  { idempotencyKey: "idem_conflict", correlationId: "corr_conflict", expectedVersion: 'W/"6"' },
));
assert.equal(getGlobalMutationConflictSnapshot()?.commandType, "deal.change-stage");
assert.equal(getGlobalMutationConflictSnapshot()?.aggregateId, "deal-1");
clearGlobalMutationConflict();

const boundaries = [
  {
    path: "src/modules/leads/application/commands/leadApiCommands.ts",
    required: [/requireLeadVersion/, /expectedVersion/, /projectAndInvalidate/, /getLeadApiRuntime\(\)\.commands/],
    sharedCommandCalls: 0,
  },
  {
    path: "src/modules/deals/public/deals.ts",
    required: [/versionedMetadata/, /requireDeal/, /projectDeal/, /getDealApiRuntime\(\)\.commands/],
    sharedCommandCalls: 0,
  },
  {
    path: "src/modules/quotes/public/quotes.ts",
    required: [/versionedOptions/, /requireQuote/, /projectQuote/, /getQuoteApiRuntime\(\)\.commands/],
    sharedCommandCalls: 0,
  },
  {
    path: "src/modules/orders/public/orders.ts",
    required: [/readMutationVersion/, /withOrderVersion/, /projectAuthoritativeOrderResult/, /executeOrderMutation/, /relationshipRefKey/],
    sharedCommandCalls: 1,
  },
] as const;
for (const boundary of boundaries) {
  const source = fs.readFileSync(path.join(root, boundary.path), "utf8");
  for (const pattern of boundary.required) assert.match(source, pattern, `${boundary.path} is missing ${pattern}.`);
  const sharedCommandCalls = source.match(/return\s+executeSharedMutationCommand\(/g) ?? [];
  assert.equal(sharedCommandCalls.length, boundary.sharedCommandCalls, `${boundary.path} has an unexpected shared mutation wrapper count.`);
}

const bindingSource = fs.readFileSync(path.join(root, "src/shared/application/mutation/mutationAuthorityBinding.ts"), "utf8");
for (const aggregate of ["lead", "deal", "quote", "order"]) assert.ok(bindingSource.includes(`"${aggregate}"`));
assert.match(bindingSource, /publishGlobalMutationConflict/);
const shellSource = fs.readFileSync(path.join(root, "src/app/shell/layout/AppShell.tsx"), "utf8");
assert.match(shellSource, /GlobalMutationConflictHost/);

console.log("Commercial concurrency metadata OK: Lead, Deal, Quote and Order attach version evidence, project authoritative responses, and surface global conflict recovery.");
