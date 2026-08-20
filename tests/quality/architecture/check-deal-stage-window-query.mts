import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = repositoryRoot;
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");
const hook = read("src/modules/deals/presentation/hooks/useDealStageWindows.ts");
const controller = read("src/modules/deals/presentation/hooks/useDealPipelineController.ts");
const page = read("src/modules/deals/presentation/pages/DealPipelinePage.tsx");

assert.ok(hook.includes('getModuleDataAuthority("deals").queries.list<Deal>'), "Kanban windows must query the Deal backend authority directly.");
assert.ok(hook.includes("filters:") && hook.includes("stage,"), "Every Deal window request must be scoped to one stage.");
assert.ok(hook.includes("pageInfo.nextCursor") && hook.includes("loadMore"), "Each stage must own cursor-based incremental loading.");
assert.ok(hook.includes("DEAL_STAGE_WINDOW_MISMATCH"), "Frontend must reject records returned in the wrong stage window.");
assert.ok(hook.includes("DEAL_STAGE_WINDOW_CURSOR_REQUIRED"), "A stage with more records must provide its own next cursor.");
assert.ok(hook.includes("workspace.workspaceId"), "Stage windows must reset when workspace authority changes.");
assert.ok(controller.includes('useDeals({ loadAuthoritative: viewMode !== "kanban" })'), "Kanban must not start the transitional full-collection loader.");
assert.ok(controller.includes("useDealStageWindows({") && controller.includes('enabled: viewMode === "kanban"'), "Deal controller must enable stage windows only for Kanban.");
assert.ok(page.includes("stageWindowQuery.loadedCount(stage)") && page.includes("stageWindowQuery.totalCount(stage)"), "Kanban column headers must distinguish loaded and total records.");
assert.ok(page.includes("stageWindowQuery.loadMore(stage)"), "Each Kanban column must expose independent load-more behavior.");

console.log("Deal stage-window query contracts: PASS (per-stage authority, independent cursors, workspace reset, bounded Kanban windows)");
