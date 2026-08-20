import { walkAllFiles } from "../../../scripts/quality/core/filesystem.mjs";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import path from "node:path";
import { readPresentationComposition } from "../../../scripts/lib/presentationCompositionSource.mts";

const root = repositoryRoot;
const read = (relativePath: string) => readPresentationComposition(path.join(root, relativePath), "utf8");

const css = read("src/index.css");
const tasks = read("src/modules/tasks/presentation/pages/TaskListPage.tsx");
const taskDetail = read("src/modules/tasks/presentation/pages/TaskDetailPage.tsx");
const supportDetail = read("src/modules/support/presentation/pages/SupportCaseDetailPage.tsx");
const customerHeader = read("src/modules/customers/presentation/detail/CustomerRecordHeader.tsx");

assert.ok(css.includes("Overflow resilience for record/list surfaces"), "Shared record/list surfaces must keep overflow resilience styles.");
assert.ok(css.includes("overflow-wrap: anywhere"), "User-entered headings must support unbroken strings.");
assert.ok(css.includes("Source-wide text clipping resilience"), "Source-wide text clipping resilience styles must remain active.");
assert.ok(css.includes("#root :where(.truncate, [class*=\"line-clamp-\"])"), "Legacy clipping utilities must be neutralized defensively.");
assert.ok(tasks.includes("group min-w-0 overflow-hidden rounded-2xl"), "Task cards must contain long content inside the card.");
assert.ok(tasks.includes("[overflow-wrap:anywhere]"), "Task list titles must wrap unbroken content.");
assert.ok(taskDetail.includes("[overflow-wrap:anywhere]"), "Task detail titles must wrap unbroken content.");
assert.ok(supportDetail.includes("[overflow-wrap:anywhere]"), "Support detail titles must wrap unbroken content.");
assert.ok(customerHeader.includes("[overflow-wrap:anywhere]"), "Customer identity titles must wrap unbroken content.");

const riskyFiles = [
  "src/workspaces/crm/presentation/pages/DashboardPage.tsx",
  "src/modules/deals/presentation/pages/DealDetailPage.tsx",
  "src/modules/contacts/presentation/detail/tabs/ContactCareCasesTab.tsx",
];
for (const file of riskyFiles) {
  assert.ok(read(file).includes("[overflow-wrap:anywhere]"), `${file} must guard user-entered card titles.`);
}

const sourceRoot = path.join(root, "src");
const tsxFiles = walkAllFiles(sourceRoot, {
  include: (_filePath, entryName) => entryName.endsWith(".tsx"),
});

const uncovered: string[] = [];
const dynamicTitlePattern = /<(?:h[1-4]|button|a)\b[^>]*>[^\n]*\{[^}]*\.(?:title|name|displayName|subject)\b[^}]*\}/;
for (const file of tsxFiles) {
  const lines = readPresentationComposition(file, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    if (!dynamicTitlePattern.test(line)) return;
    if (/\bt\(|\btx\(/.test(line)) return;
    if (/(break-words|overflow-wrap:anywhere|crm-overflow-safe|crm-text-wrap)/.test(line)) return;
    uncovered.push(`${path.relative(root, file)}:${index + 1}`);
  });
}
assert.deepEqual(uncovered, [], `Dynamic user-entered headings/actions require overflow protection: ${uncovered.join(", ")}`);

const forbiddenClippingUtilities: string[] = [];
for (const file of tsxFiles) {
  const source = readPresentationComposition(file, "utf8");
  if (/\btruncate\b|\bline-clamp-[1-9]\b|\btext-ellipsis\b/.test(source)) {
    forbiddenClippingUtilities.push(path.relative(root, file));
  }
}
assert.deepEqual(
  forbiddenClippingUtilities,
  [],
  `User-visible source must not use ellipsis or line clamps: ${forbiddenClippingUtilities.join(", ")}`,
);

const buttonSource = read("src/shared/components/ui/Button.tsx");
assert.ok(buttonSource.includes("whitespace-nowrap"), "Shared Button labels must keep their natural one-line width.");
assert.ok(buttonSource.includes('xs: "h-8') && buttonSource.includes('sm: "h-10') && buttonSource.includes('md: "h-11'), "Shared Button sizes must retain fixed control heights.");
assert.equal(buttonSource.includes("crm-text-wrap"), false, "Shared Button labels must not inherit record-text wrapping rules.");
assert.equal(/\btruncate\b|\bline-clamp-[1-9]\b|\btext-ellipsis\b/.test(buttonSource), false, "Shared Button must not clip labels.");
const sharedButtonCss = css.slice(css.indexOf('#root [data-ui-button="true"]'), css.indexOf('#root :where([data-list-page-archetype="v1"]'));
assert.equal(sharedButtonCss.includes("height: auto"), false, "Global CSS must not erase component-owned button heights.");
assert.ok(sharedButtonCss.includes("white-space: nowrap"), "Global button label safety must preserve natural action width.");
const tableHeaderSource = read("src/components/crm/TableResizeHeader.tsx");
assert.ok(tableHeaderSource.includes("whitespace-normal") && tableHeaderSource.includes("overflow-visible"), "Resizable table headings must remain fully readable.");

console.log(`Overflow resilience contracts: PASS (${tsxFiles.length} TSX files scanned)`);
