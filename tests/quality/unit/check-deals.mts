import { walkAllFiles } from "../../../scripts/quality/core/filesystem.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  archiveDeal,
  saveDeal,
  updateDeal,
  updateManyDeals,
} from "@/modules/deals/application/commands/dealRepositoryCommands";
import {
  appendDealActivity,
  changeDealStage,
  createCanonicalDeal,
  markDealLost,
  markDealWon,
  reassignDeal,
} from "@/modules/deals/application/commands/dealCommands";
import { getDealStats, queryDeals } from "@/modules/deals/application/queries/dealQueries";
import { InMemoryDealRepository } from "@/modules/deals/infrastructure/InMemoryDealRepository";
import { DealStage, type Deal } from "@/modules/deals/domain/model/deal.types";
import { DEFAULT_DEAL_STAGES } from "@/modules/deals/domain/rules/dealStages";
import { DEAL_MODULE_MANIFEST } from "@/modules/deals/manifest";
import { BrowserDealStageRepository } from "@/modules/deals/infrastructure/BrowserDealStageRepository";
import { PreferenceStore } from "@/platform/preferences";
import { ModuleRegistry } from "@/platform/module-registry/ModuleRegistry";

const seed: Deal[] = [
  createDeal("deal-1", "ERP Rollout", DealStage.DISCOVERY, "u1", 100_000_000),
  createDeal("deal-2", "CRM Upgrade", DealStage.PROPOSAL, "u2", 50_000_000),
];

const listeners = new Map<string, Set<(payload: unknown) => void>>();
const repository = new InMemoryDealRepository(seed, {
  publish: (eventName, payload) => listeners.get(eventName)?.forEach((listener) => listener(payload)),
  subscribe: (eventName, listener) => {
    const bucket = listeners.get(eventName) ?? new Set();
    bucket.add(listener as (payload: unknown) => void);
    listeners.set(eventName, bucket);
    return () => bucket.delete(listener as (payload: unknown) => void);
  },
});

let observedCount = 0;
const unsubscribe = repository.subscribe((deals) => { observedCount = deals.length; });
createCanonicalDeal(repository, createDeal("deal-3", "Support Renewal", DealStage.QUALIFIED, "u1", 20_000_000));
assert.equal(repository.list().length, 3);
assert.equal(observedCount, 3);
unsubscribe();

// A follow-up task is optional for an active Deal.
assert.doesNotThrow(() => createCanonicalDeal(
  new InMemoryDealRepository([], { publish: () => {}, subscribe: () => () => {} }),
  {
    ...createDeal("optional-next-action", "No task yet", DealStage.DISCOVERY, "u1", 1),
    nextActionAt: undefined,
    nextActionSummary: undefined,
    nextActionRef: undefined,
  },
));

updateDeal(repository, "deal-2", (deal) => ({ ...deal, amount: 75_000_000 }));
assert.equal(repository.getById("deal-2")?.amount, 75_000_000);

const updatedMany = updateManyDeals(repository, ["deal-1", "deal-2"], (deal) => ({ ...deal, ownerId: "u9" }));
assert.equal(updatedMany, 2);
assert.equal(repository.getById("deal-1")?.ownerId, "u9");

changeDealStage(repository, "deal-1", DealStage.NEGOTIATION);
assert.equal(repository.getById("deal-1")?.stage, DealStage.NEGOTIATION);

// Generic stage transitions cannot silently close the Deal.
assert.throws(() => changeDealStage(repository, "deal-1", DealStage.WON), /markDealWon/i);
assert.throws(() => changeDealStage(repository, "deal-1", DealStage.LOST), /markDealLost/i);

// WON requires explicit commercial commitment evidence.
assert.throws(
  () => saveDeal(repository, { ...createDeal("won-invalid", "Won without evidence", DealStage.WON, "u1", 1), nextActionAt: undefined }),
  /evidence/i,
);
markDealWon(repository, "deal-1", {
  type: "QUOTE_ACCEPTED",
  sourceId: "quote-accepted-1",
  occurredAt: "2026-07-07T10:00:00.000Z",
});
assert.equal(repository.getById("deal-1")?.stage, DealStage.WON);
assert.equal(repository.getById("deal-1")?.winEvidence?.type, "QUOTE_ACCEPTED");
assert.equal(repository.getById("deal-1")?.nextActionAt, undefined);

// LOST always records a reason and recycle decision; recyclable outcomes require revisitAt.
assert.throws(
  () => markDealLost(repository, "deal-2", {
    reason: "Timing",
    recycleDecision: "RECYCLE",
    occurredAt: "2026-07-08T00:00:00.000Z",
  }),
  /revisitAt/i,
);
markDealLost(repository, "deal-2", {
  reason: "Timing",
  recycleDecision: "RECYCLE",
  revisitAt: "2026-10-01T09:00:00.000Z",
  occurredAt: "2026-07-08T00:00:00.000Z",
});
assert.equal(repository.getById("deal-2")?.stage, DealStage.LOST);
assert.equal(repository.getById("deal-2")?.recycleEligible, true);
assert.equal(repository.getById("deal-2")?.revisitAt, "2026-10-01T09:00:00.000Z");

appendDealActivity(repository, "deal-3", {
  id: "activity-1",
  type: "note",
  title: "Follow up",
  description: "Buyer reviewed proposal",
  createdAt: "2026-07-06T12:00:00.000Z",
  author: "Tester",
});
assert.equal(repository.getById("deal-3")?.activities?.[0]?.id, "activity-1");

reassignDeal(repository, "deal-3", { ownerId: "u7", reason: "Coverage reassignment" });
assert.equal(repository.getById("deal-3")?.ownerId, "u7");

assert.equal(queryDeals(repository.list(), { search: "crm upgrade" }).length, 1);
assert.equal(queryDeals(repository.list(), { ownerId: "u7" }).length, 1);
const stats = getDealStats(repository.list(), DEFAULT_DEAL_STAGES);
assert.equal(stats.total, 3);
assert.equal(stats.open, 1);

// Repository command remains available for non-lifecycle fields.
archiveDeal(repository, "deal-3", { reason: "Retention policy contract", actorId: "tester", actorName: "Tester", now: "2026-07-09T00:00:00.000Z" });
assert.equal(repository.list().length, 3, "Archiving a Deal must retain the record.");
assert.equal(repository.getById("deal-3")?.archivedAt, "2026-07-09T00:00:00.000Z");

const registry = new ModuleRegistry().register(DEAL_MODULE_MANIFEST);
assert.equal(registry.get("deals")?.routes.length, 2);

// Stage configuration persistence is isolated behind a repository and normalizes legacy configs.
const memory = new Map<string, unknown>();
const stageRepository = new BrowserDealStageRepository(
  new PreferenceStore({
    get: <T,>(key: string) => (memory.get(key) as T | undefined) ?? null,
    set: <T,>(key: string, value: T) => { memory.set(key, value); },
    remove: (key: string) => { memory.delete(key); },
  }, ""),
  { publish: () => undefined, subscribe: () => () => undefined },
);
const customStages = DEFAULT_DEAL_STAGES.map((stage) => ({ ...stage }));
customStages[0] = { ...customStages[0], labelEn: "Qualified Opportunity" };
stageRepository.replace(customStages);
assert.equal(stageRepository.list()[0]?.labelEn, "Qualified Opportunity");
assert.equal(stageRepository.reset()[0]?.labelEn, "Discovery");

// Corrupt or partial browser snapshots must normalize instead of crashing the Deal route.
memory.set("unicore_deal_pipelines", { invalid: true });
assert.equal(stageRepository.listPipelines().length, 1);
assert.equal(stageRepository.list()[0]?.code, DealStage.DISCOVERY);
memory.set("unicore_deal_pipelines", [{
  id: "legacy-pipeline",
  name: { vi: "Pipeline cũ" },
  active: true,
  isDefault: true,
  stages: [{ code: "NEW", labelVi: "Mới", order: 1 }],
}]);
const normalizedLegacyPipelines = stageRepository.listPipelines();
assert.equal(normalizedLegacyPipelines[0]?.id, "legacy-pipeline");
assert.equal(normalizedLegacyPipelines[0]?.stages[0]?.code, DealStage.DISCOVERY);
assert.ok(normalizedLegacyPipelines[0]?.stages.some((stage) => stage.code === DealStage.WON));
assert.ok(normalizedLegacyPipelines[0]?.stages.some((stage) => stage.code === DealStage.LOST));

const presentationRoot = path.resolve("src/modules/deals/presentation");
for (const file of walkAllFiles(presentationRoot)) {
  if (!/\.(ts|tsx)$/.test(file)) continue;
  const source = fs.readFileSync(file, "utf8");
  assert.equal(/\blocalStorage\s*\./.test(source), false, `${file} must not access browser storage directly`);
}

console.log("Deal module checks: OK");

function createDeal(
  id: string,
  name: string,
  stage: DealStage,
  ownerId: string,
  amount: number,
): Deal {
  return {
    id,
    name,
    buyerRef: { type: "CONTACT", id: `contact-${id}` },
    stage,
    amount,
    opportunityScore: 50,
    ownerId,
    expectedCloseDate: "2026-08-01",
    nextActionAt: "2026-07-10T09:00:00.000Z",
    nextActionSummary: "Follow up",
    nextActionRef: { type: "MANUAL" },
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    interestedProducts: [],
    lineItems: [],
    activities: [],
  };
}

