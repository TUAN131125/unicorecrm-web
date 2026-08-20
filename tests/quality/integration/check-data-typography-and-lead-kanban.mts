import { walkAllFiles } from "../../../scripts/quality/core/filesystem.mjs";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");

const dataSurfaceFiles = walkAllFiles(path.join(repositoryRoot, "src"))
  .filter((file) => file.endsWith(".tsx"))
  .filter((file) => {
    const normalized = file.replaceAll("\\", "/").toLowerCase();
    const name = path.basename(normalized);
    return name.includes("table") || name.includes("list") || name.includes("kanban") || normalized.includes("/list/");
  });

for (const file of dataSurfaceFiles) {
  const source = fs.readFileSync(file, "utf8");
  for (const forbidden of ["font-black", "font-extrabold", "font-bold"]) {
    assert.equal(source.includes(forbidden), false, `${file} must not use ${forbidden} in dense table/list/Kanban surfaces.`);
  }
}

const badge = read("src/shared/components/ui/Badge.tsx");
assert.ok(badge.includes('data-ui-badge="true"'), "Badges must opt out of neutral data-text overrides.");
assert.ok(badge.includes("font-semibold"), "Badge typography must remain semibold rather than heavy bold.");
assert.equal(badge.includes("font-bold tracking-normal uppercase"), false, "Badges must not force heavy uppercase typography globally.");

const button = read("src/shared/components/ui/Button.tsx");
assert.ok((button.match(/data-ui-button="true"/g) || []).length >= 2, "Button and IconButton must preserve explicit action colors inside data surfaces.");

const table = read("src/shared/components/ui/Table.tsx");
for (const marker of [
  'data-data-surface="table"',
  'data-data-row="true"',
  "font-normal text-slate-950",
  "font-medium text-slate-700",
]) {
  assert.ok(table.includes(marker), `Shared table typography contract missing ${marker}.`);
}

const css = read("src/index.css");
for (const marker of [
  "CRM typography hierarchy",
  "--crm-data-text: #0f172a",
  'table:not([data-typography-opt-out])',
  '[data-data-surface="list"]',
  '[data-ui-badge="true"]',
  '[data-ui-button="true"]',
]) {
  assert.ok(css.includes(marker), `Global data typography contract missing ${marker}.`);
}
assert.equal(css.includes('[data-data-surface="list"] [data-ui-button="true"],'), false, "Dense-list typography must not override the action button foreground itself.");
assert.equal(css.includes(':where(table:not([data-typography-opt-out])) [data-ui-button="true"],'), false, "Table typography must not override the action button foreground itself.");
assert.ok(css.includes('[data-ui-button="true"] svg') && css.includes('stroke: currentColor'), "Action icons must inherit the semantic white foreground used by success/danger buttons.");

const board = read("src/modules/leads/presentation/components/LeadKanbanBoard.tsx");
for (const marker of [
  "LeadKanbanDropTarget",
  'draggable={canDrag}',
  "event.dataTransfer.setData",
  "onDragOver",
  "onDrop",
  'data-kanban-column={status}',
  'data-kanban-card="lead"',
  'event.altKey && event.key === "ArrowRight"',
  "RowActionPortal",
  "rowActionAnchorEl",
  'data-kanban-responsive-columns="true"',
  "gridTemplateColumns",
]) {
  assert.ok(board.includes(marker), `Lead Kanban drag-and-drop contract missing ${marker}.`);
}

const listPage = read("src/modules/leads/presentation/pages/LeadListPage.tsx");
for (const marker of [
  "handleKanbanMove",
  "leadActions.changeWorkState(leadId, target)",
  "requestStartVerifying",
  "leadActions.startVerification",
  "LeadTransitionRequirementsModal",
  "navigate(`/leads/${leadId}/qualify`)",
  "onMoveLead={handleKanbanMove}",
]) {
  assert.ok(listPage.includes(marker), `Lead Kanban lifecycle integration missing ${marker}.`);
}

assert.equal(board.includes("w-[290px]"), false, "Lead Kanban columns must not keep a fixed width after sidebar resizing.");

const transitionPolicy = read("src/modules/leads/domain/rules/leadProgressiveProfile.ts");
assert.ok(transitionPolicy.includes("DEFAULT_LEAD_PROGRESSIVE_PROFILE_POLICY"), "Lead transition requirements must be represented by a configurable policy.");
assert.equal(transitionPolicy.includes('required.push("companyName", "painPoint", "nextFollowUpAt")'), false, "Verification enrichment fields must not be hardcoded into the domain profile rule.");

const transitionModal = read("src/modules/leads/presentation/components/lead-transition/LeadTransitionRequirementsModal.tsx");
const transitionForm = read("src/modules/leads/presentation/components/lead-transition/LeadVerificationRequirementsForm.tsx");
assert.ok(transitionModal.includes("LeadVerificationRequirementsForm"), "Transition modal must compose a separate requirements form.");
assert.ok(transitionForm.includes("requiredFields.includes"), "Transition requirement fields must be rendered from policy results rather than page hardcoding.");
assert.equal(fs.existsSync("src/modules/leads/presentation/components/LeadVerificationReadinessModal.tsx"), false, "The page-coupled verification modal must remain removed.");

const e2e = read("tests/e2e/lead-scale-experience.spec.ts");
assert.ok(e2e.includes("Lead Kanban supports lifecycle-safe drag and drop"), "Lead Kanban must retain a browser drag-and-drop regression scenario.");
assert.ok(e2e.includes("dragTo"), "Lead Kanban browser regression must execute a real drag operation.");

console.log(`Data typography and Lead Kanban contracts: PASS (${dataSurfaceFiles.length} dense UI files audited)`);
